import { Router } from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { once } from 'node:events';
import { Prisma } from '@prisma/client';
import {
  z,
  agentConversationInputSchema,
  agentConversationSchema,
  agentMessageInputSchema,
  agentMessageSchema,
  agentEventSchema,
  agentStatusSchema,
  agentContextSchema,
  agentReferenceSchema,
} from '@corewise/types';
import { db } from '../../lib/db.js';
import { ApiError, validate } from '../../lib/errors.js';
import { requireUser } from '../auth/routes.js';
import { mlRequest } from '../ml/routes.js';
import { clean, hash, redact } from './safety.js';
import { executeTool, toolRequestSchema, unavailable } from './tools.js';
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const unavailableStatus = {
  configured: false,
  connection: 'UNCONFIGURED',
  provider: null,
  model: null,
  message: 'AI Assistant unavailable — configure an LLM provider.',
  limits: {
    toolCalls: 6,
    iterations: 8,
    contextMessages: 10,
    outputTokens: 1024,
    timeoutSeconds: 75,
  },
};
const conversationView = (r: { createdAt: Date; updatedAt: Date }) =>
  agentConversationSchema.parse({
    ...r,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  });
function messageView(r: {
  createdAt: Date;
  completedAt: Date | null;
  tools: { createdAt: Date }[];
}) {
  return agentMessageSchema.parse({
    ...r,
    createdAt: r.createdAt.toISOString(),
    completedAt: r.completedAt?.toISOString() ?? null,
    tools: r.tools.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() })),
  });
}
async function expire(userId: string) {
  await db.agentMessage.updateMany({
    where: { conversation: { userId }, status: 'STREAMING', expiresAt: { lt: new Date() } },
    data: {
      status: 'FAILED',
      error: 'Assistant request expired. Retry your message.',
      completedAt: new Date(),
      grantHash: null,
      csrfHash: null,
      sessionId: null,
    },
  });
}
export function assistantInternalRoutes() {
  const router = Router();
  router.post('/tools', async (req, res) => {
    const secret = process.env.ML_INTERNAL_TOKEN ?? '',
      supplied = req.get('authorization') ?? '';
    if (
      secret.length < 32 ||
      secret.startsWith('replace-with-') ||
      Buffer.byteLength(supplied) !== Buffer.byteLength(`Bearer ${secret}`) ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(`Bearer ${secret}`))
    )
      throw new ApiError(401, 'INTERNAL_UNAUTHORIZED', 'Internal authentication required.');
    const body = toolRequestSchema.safeParse(req.body);
    if (!body.success)
      throw new ApiError(422, 'TOOL_INPUT_INVALID', 'Tool or arguments are not allowed.');
    const grant = req.get('x-agent-grant') ?? '',
      csrf = req.get('x-csrf-token') ?? '';
    const message = await db.agentMessage.findUnique({
      where: { grantHash: hash(grant) },
      include: { conversation: true },
    });
    if (
      !message ||
      message.status !== 'STREAMING' ||
      !message.expiresAt ||
      message.expiresAt <= new Date() ||
      message.csrfHash !== hash(csrf) ||
      !message.sessionId
    )
      throw new ApiError(403, 'GRANT_INVALID', 'Turn authorization expired or invalid.');
    const session = await db.session.findUnique({ where: { id: message.sessionId } });
    const sessionData = session ? JSON.parse(session.data) : null;
    if (
      !session ||
      session.expiresAt <= new Date() ||
      session.userId !== message.conversation.userId ||
      sessionData.userId !== message.conversation.userId ||
      sessionData.agentId ||
      typeof sessionData.authExpiresAt !== 'number' ||
      !Number.isFinite(sessionData.authExpiresAt) ||
      sessionData.authExpiresAt <= Date.now()
    )
      throw new ApiError(403, 'GRANT_INVALID', 'Authenticated user session is no longer valid.');
    const claimed = await db.agentMessage.updateMany({
      where: {
        id: message.id,
        status: 'STREAMING',
        toolCount: { lt: 6 },
        expiresAt: { gt: new Date() },
      },
      data: { toolCount: { increment: 1 } },
    });
    if (!claimed.count) throw new ApiError(429, 'TOOL_BUDGET', 'Turn tool budget exhausted.');
    const started = Date.now();
    let result;
    try {
      result = await executeTool(
        message.conversation.userId,
        body.data.name,
        body.data.arguments,
        message.context,
      );
    } catch (e) {
      result = unavailable(
        e instanceof ApiError
          ? redact(e.message)
          : e instanceof z.ZodError
            ? 'Invalid tool inputs.'
            : 'Tool failed. No result was fabricated.',
      );
    }
    // Recheck after an expensive calculation so cancelled turns cannot persist/send later results.
    const current = await db.agentMessage.findFirst({
      where: { id: message.id, status: 'STREAMING', expiresAt: { gt: new Date() } },
    });
    if (!current) throw new ApiError(409, 'TURN_ENDED', 'Turn ended.');
    await db.agentToolCall.create({
      data: {
        messageId: message.id,
        name: body.data.name,
        arguments: json(clean(body.data.arguments)),
        result: json(result),
        status: result.available ? 'COMPLETED' : 'FAILED',
        durationMs: Date.now() - started,
      },
    });
    res.json(result);
  });
  return router;
}
export function assistantRoutes() {
  const router = Router();
  router.use(['/status', '/conversations'], requireUser);
  router.get('/status', async (_req, res) => {
    let data;
    try {
      data = await mlRequest('/internal/agent/status', {});
    } catch {
      data = {
        ...unavailableStatus,
        connection: 'ERROR',
        message: 'AI Assistant unavailable — private agent service is unreachable.',
      };
    }
    res.json(agentStatusSchema.parse({ data }));
  });
  router.post('/conversations', validate(agentConversationInputSchema), async (req, res) => {
    const input = agentConversationInputSchema.parse(req.body);
    const userId = req.session.userId!;
    const r = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
      if ((await tx.agentConversation.count({ where: { userId } })) >= 100)
        throw new ApiError(
          429,
          'CONVERSATION_LIMIT',
          'Delete an older conversation before creating another (limit 100).',
        );
      return tx.agentConversation.create({ data: { userId, title: redact(input.title) } });
    });
    res.status(201).json({ data: conversationView(r) });
  });
  router.get('/conversations', async (req, res) => {
    await expire(req.session.userId!);
    res.json({
      data: (
        await db.agentConversation.findMany({
          where: { userId: req.session.userId! },
          orderBy: { updatedAt: 'desc' },
          take: 100,
        })
      ).map(conversationView),
    });
  });
  router.use('/conversations/:id', async (req, res, next) => {
    const r = await db.agentConversation.findUnique({
      where: { id_userId: { id: String(req.params.id), userId: req.session.userId! } },
    });
    if (!r) throw new ApiError(404, 'NOT_FOUND', 'Conversation not found.');
    res.locals.conversation = r;
    next();
  });
  router.get('/conversations/:id', (_req, res) =>
    res.json({ data: conversationView(res.locals.conversation) }),
  );
  router.delete('/conversations/:id', async (req, res) => {
    await db.agentConversation.delete({
      where: { id_userId: { id: String(req.params.id), userId: req.session.userId! } },
    });
    res.status(204).end();
  });
  router.get('/conversations/:id/messages', async (req, res) => {
    await expire(req.session.userId!);
    const rows = await db.agentMessage.findMany({
      where: { conversationId: String(req.params.id) },
      orderBy: { sequence: 'desc' },
      take: 100,
      include: { tools: { orderBy: { createdAt: 'asc' } } },
    });
    res.json({ data: rows.reverse().map(messageView) });
  });
  // Both routes use the same secure SSE protocol; there is no separate unbounded send path.
  router.post(
    ['/conversations/:id/messages', '/conversations/:id/stream'],
    validate(agentMessageInputSchema),
    async (req, res) => {
      const input = agentMessageInputSchema.parse(req.body),
        userId = req.session.userId!,
        conversationId = String(req.params.id);
      const context = agentContextSchema.parse(input.context);
      if (
        context.hardwareProfileId &&
        !(await db.hardwareProfile.findFirst({ where: { id: context.hardwareProfileId, userId } }))
      )
        throw new ApiError(404, 'NOT_FOUND', 'Hardware profile not found.');
      if (
        context.workloadId &&
        !(await db.workload.findFirst({ where: { id: context.workloadId, userId } }))
      )
        throw new ApiError(404, 'NOT_FOUND', 'Workload not found.');
      const configured = agentStatusSchema.parse({
        data: await mlRequest('/internal/agent/status', {}),
      }).data;
      if (!configured.configured)
        throw new ApiError(503, 'PROVIDER_UNAVAILABLE', unavailableStatus.message);
      await expire(userId);
      const grant = randomBytes(32).toString('base64url'),
        csrf = req.get('x-csrf-token')!;
      const assistant = await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
        if (
          await tx.agentMessage.count({ where: { conversation: { userId }, status: 'STREAMING' } })
        )
          throw new ApiError(
            409,
            'TURN_ACTIVE',
            'Another assistant response is running. Stop it first.',
          );
        if (
          (await tx.agentMessage.count({
            where: {
              conversation: { userId },
              role: 'ASSISTANT',
              createdAt: { gt: new Date(Date.now() - 60000) },
            },
          })) >= 8
        )
          throw new ApiError(429, 'RATE_LIMITED', 'Assistant limit: eight turns per minute.');
        const firstMessage = !(await tx.agentMessage.count({ where: { conversationId } }));
        await tx.agentMessage.create({
          data: {
            conversationId,
            role: 'USER',
            content: redact(input.content),
            context: json(context),
          },
        });
        await tx.agentConversation.update({
          where: { id: conversationId },
          data: {
            updatedAt: new Date(),
            ...(firstMessage && res.locals.conversation.title === 'New conversation'
              ? { title: redact(input.content).slice(0, 80) }
              : {}),
          },
        });
        return tx.agentMessage.create({
          data: {
            conversationId,
            role: 'ASSISTANT',
            content: '',
            status: 'STREAMING',
            context: json(context),
            grantHash: hash(grant),
            csrfHash: hash(csrf),
            sessionId: req.sessionID,
            expiresAt: new Date(Date.now() + 90000),
            provider: configured.provider,
            model: configured.model,
          },
        });
      });
      const abort = new AbortController();
      let text = '',
        complete = false,
        failure: string | undefined,
        usage: unknown;
      const references = new Map<string, z.infer<typeof agentReferenceSchema>>();
      const close = () => {
        if (!complete) abort.abort();
      };
      res.on('close', close);
      const timer = setTimeout(() => abort.abort(), 80000);
      res.status(200).set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-store, no-transform',
        'X-Accel-Buffering': 'no',
        Connection: 'keep-alive',
      });
      res.flushHeaders();
      async function send(event: unknown) {
        const parsed = agentEventSchema.parse(event);
        if (res.destroyed) return;
        if (!res.write(`event: ${parsed.type}\ndata: ${JSON.stringify(parsed)}\n\n`))
          await once(res, 'drain', { signal: abort.signal });
      }
      try {
        await send({ type: 'start', messageId: assistant.id });
        const history = await db.agentMessage.findMany({
          where: { conversationId, status: 'COMPLETED', id: { not: assistant.id } },
          orderBy: { sequence: 'desc' },
          take: 10,
        });
        const messages = history
          .reverse()
          .map((m) => ({ role: m.role, content: redact(m.content.slice(-4000)) }));
        const upstream = await fetch(
          `${process.env.ML_ORIGIN ?? 'http://127.0.0.1:8000'}/internal/agent/stream`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.ML_INTERNAL_TOKEN}`,
            },
            body: JSON.stringify({ messages, context, grant, csrf }),
            signal: abort.signal,
          },
        );
        if (!upstream.ok || !upstream.body) throw Error('Agent service failed.');
        const reader = upstream.body.getReader(),
          decoder = new TextDecoder();
        let buffer = '',
          sawEnd = false;
        while (!sawEnd) {
          const chunk = await reader.read();
          if (chunk.done) break;
          buffer += decoder.decode(chunk.value, { stream: true });
          if (buffer.length > 100000) throw Error('Agent event exceeded size limit.');
          let boundary;
          while ((boundary = buffer.indexOf('\n\n')) >= 0) {
            const frame = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            const line = frame.split('\n').find((l) => l.startsWith('data: '));
            if (!line) continue;
            const event = agentEventSchema.parse(clean(JSON.parse(line.slice(6))));
            if (event.type === 'chunk') {
              text += event.text;
              if (text.length > 16000) throw Error('Response limit exceeded.');
              await send(event);
            } else if (event.type === 'tool') {
              // Structured cards/references come from persisted Express tool results, never LLM citations.
              if (event.result) {
                const persisted = await db.agentToolCall.findFirst({
                  where: { messageId: assistant.id, name: event.name },
                  orderBy: { createdAt: 'desc' },
                });
                if (!persisted) throw Error('Unverified tool event.');
                event.result = z.object({ result: z.unknown() }).parse(persisted)
                  .result as typeof event.result;
                for (const r of event.result!.references) references.set(`${r.type}:${r.id}`, r);
              }
              await send(event);
            } else if (event.type === 'metadata') {
              usage = event.usage;
              await send(event);
            } else if (event.type === 'error') {
              failure = event.message;
              await send(event);
              sawEnd = true;
              break;
            } else if (event.type === 'complete') {
              complete = true;
              sawEnd = true;
              break;
            }
          }
        }
        await reader.cancel();
        if (!complete && !failure) throw Error('Agent stream ended before completion.');
      } catch {
        failure = abort.signal.aborted
          ? 'Response cancelled or timed out.'
          : 'Assistant request failed. Retry your message.';
        if (!res.destroyed)
          await send({ type: 'error', code: 'AGENT_FAILED', message: failure }).catch(() => {});
      } finally {
        clearTimeout(timer);
        abort.abort();
        res.off('close', close);
        const status = complete ? 'COMPLETED' : res.destroyed ? 'CANCELLED' : 'FAILED';
        await db.agentMessage.updateMany({
          where: { id: assistant.id },
          data: {
            content: redact(text),
            status,
            error: failure ?? null,
            usage: usage ? json(clean(usage)) : Prisma.DbNull,
            references: json([...references.values()]),
            completedAt: new Date(),
            grantHash: null,
            csrfHash: null,
            sessionId: null,
          },
        });
        if (complete && !res.destroyed) await send({ type: 'complete', messageId: assistant.id });
        res.end();
      }
    },
  );
  return router;
}
