import { Router, type Request, type RequestHandler } from 'express';
import { randomBytes, createHash } from 'node:crypto';
import { rateLimit } from 'express-rate-limit';
import { Prisma, type BenchmarkJob, type BenchmarkRun } from '@prisma/client';
import {
  z,
  benchmarkCatalog,
  benchmarkJobInputSchema,
  benchmarkConfigSchema,
  benchmarkMeasurementSchema,
  detectedEnvironmentSchema,
  benchmarkJobSchema,
  benchmarkRunSchema,
  localAgentSchema,
  benchmarkExportSchema,
  telemetrySampleSchema,
} from '@corewise/types';
import { db } from '../../lib/db.js';
import { ApiError, validate } from '../../lib/errors.js';
import { requireUser } from '../auth/routes.js';
import { mlRequest } from '../ml/routes.js';
import { validateMeasurement } from './validation.js';
import { measuredRows, csv } from './export.js';
import { importDetectedProfile } from '../functional/import-hardware.js';

const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const id = (req: Request) => String(req.params.id);
const owned = (req: Request) => ({ id: id(req), userId: req.session.userId! });
function jobView(j: BenchmarkJob & { run?: { id: string } | null }) {
  return benchmarkJobSchema.parse({
    ...j,
    createdAt: j.createdAt.toISOString(),
    startedAt: j.startedAt?.toISOString() ?? null,
    completedAt: j.completedAt?.toISOString() ?? null,
    runId: j.run?.id ?? null,
  });
}
function runView(r: BenchmarkRun) {
  return benchmarkRunSchema.parse({ ...r, createdAt: r.createdAt.toISOString() });
}
async function save(req: Request) {
  await new Promise<void>((resolve, reject) =>
    req.session.save((e) => (e ? reject(e) : resolve())),
  );
}
const requireAgent: RequestHandler = async (req, _res, next) => {
  const agent = req.session.agentId
    ? await db.localAgent.findUnique({ where: { id: req.session.agentId } })
    : null;
  if (!agent || agent.revokedAt || agent.expiresAt <= new Date())
    return next(
      new ApiError(401, 'AGENT_UNAUTHORIZED', 'Runner credential expired or revoked. Pair again.'),
    );
  await db.localAgent.update({ where: { id: agent.id }, data: { lastSeenAt: new Date() } });
  next();
};
const jobInclude = { run: { select: { id: true } } } as const;
async function expire(userId: string) {
  await db.benchmarkJob.updateMany({
    where: {
      userId,
      status: { in: ['RUNNING', 'CANCEL_REQUESTED'] },
      leaseUntil: { lt: new Date() },
    },
    data: {
      status: 'FAILED',
      error: 'Runner lease expired; explicit new execution required.',
      completedAt: new Date(),
    },
  });
}

export function benchmarkRoutes() {
  const router = Router();
  router.use(requireUser);
  router.get('/catalog', (_req, res) => res.json({ data: benchmarkCatalog }));
  router.post('/pairing', async (req, res) => {
    const code = randomBytes(32).toString('base64url'),
      expiresAt = new Date(Date.now() + 600000);
    await db.agentPairing.create({
      data: { userId: req.session.userId!, codeHash: hash(code), expiresAt },
    });
    res.status(201).json({ data: { code, expiresAt: expiresAt.toISOString() } });
  });
  router.get('/agents', async (req, res) =>
    res.json({
      data: (
        await db.localAgent.findMany({
          where: { userId: req.session.userId! },
          orderBy: { createdAt: 'desc' },
        })
      ).map((a) =>
        localAgentSchema.parse({
          ...a,
          createdAt: a.createdAt.toISOString(),
          expiresAt: a.expiresAt.toISOString(),
          lastSeenAt: a.lastSeenAt?.toISOString() ?? null,
          revokedAt: a.revokedAt?.toISOString() ?? null,
        }),
      ),
    }),
  );
  router.post('/agents/:id/revoke', async (req, res) => {
    await db.localAgent.update({
      where: { id_userId: owned(req) },
      data: { revokedAt: new Date() },
    });
    await db.benchmarkJob.updateMany({
      where: {
        agentId: id(req),
        userId: req.session.userId!,
        status: { in: ['QUEUED', 'RUNNING', 'CANCEL_REQUESTED'] },
      },
      data: { status: 'CANCELLED', completedAt: new Date(), error: 'Runner revoked' },
    });
    res.status(204).end();
  });
  router.post('/jobs', validate(benchmarkJobInputSchema), async (req, res) => {
    const input = benchmarkJobInputSchema.parse(req.body),
      userId = req.session.userId!;
    const agent = await db.localAgent.findUnique({
      where: { id_userId: { id: input.agentId, userId } },
    });
    if (!agent) throw new ApiError(404, 'NOT_FOUND', 'Runner not found.');
    if (agent.revokedAt || agent.expiresAt <= new Date())
      throw new ApiError(409, 'AGENT_UNAVAILABLE', 'Runner expired or revoked.');
    await expire(userId);
    try {
      const j = await db.benchmarkJob.create({
        data: { userId, agentId: agent.id, config: input.config },
        include: jobInclude,
      });
      res.status(201).json({ data: jobView(j) });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
        throw new ApiError(
          409,
          'BENCHMARK_CONFLICT',
          'This runner already has a pending or running benchmark.',
        );
      throw e;
    }
  });
  router.get('/jobs', async (req, res) => {
    await expire(req.session.userId!);
    res.json({
      data: (
        await db.benchmarkJob.findMany({
          where: { userId: req.session.userId! },
          orderBy: { createdAt: 'desc' },
          include: jobInclude,
        })
      ).map(jobView),
    });
  });
  router.get('/jobs/:id', async (req, res) => {
    await expire(req.session.userId!);
    const j = await db.benchmarkJob.findUnique({
      where: { id_userId: owned(req) },
      include: jobInclude,
    });
    if (!j) throw new ApiError(404, 'NOT_FOUND', 'Benchmark job not found.');
    res.json({ data: jobView(j) });
  });
  router.post('/jobs/:id/cancel', async (req, res) => {
    const j = await db.benchmarkJob.findUnique({ where: { id_userId: owned(req) } });
    if (!j) throw new ApiError(404, 'NOT_FOUND', 'Job not found.');
    await db.benchmarkJob.updateMany({
      where: { id: j.id, userId: j.userId, status: { in: ['QUEUED', 'RUNNING'] } },
      data: {
        status: j.status === 'QUEUED' ? 'CANCELLED' : 'CANCEL_REQUESTED',
        ...(j.status === 'QUEUED' ? { completedAt: new Date() } : {}),
      },
    });
    res.status(204).end();
  });
  router.get('/runs', async (req, res) =>
    res.json({
      data: (
        await db.benchmarkRun.findMany({
          where: { userId: req.session.userId! },
          orderBy: { createdAt: 'desc' },
        })
      ).map(runView),
    }),
  );
  router.get('/runs/:id', async (req, res) => {
    const r = await db.benchmarkRun.findUnique({ where: { id_userId: owned(req) } });
    if (!r) throw new ApiError(404, 'NOT_FOUND', 'Run not found.');
    res.json({ data: runView(r) });
  });
  router.get('/export.csv', async (req, res) => {
    const runs = await db.benchmarkRun.findMany({
      where: { userId: req.session.userId! },
      orderBy: { createdAt: 'asc' },
    });
    const rows = runs.flatMap((r) => {
      const m = benchmarkMeasurementSchema.parse(r.measurement);
      return m.cpu.samplesMs.map((cpuTimeMs, i) => ({
        schema_version: 'cw-bench-1',
        run_id: r.id,
        workload: m.config.workload,
        size: m.config.size,
        dtype: m.config.dtype,
        scope: m.config.scope,
        sample: i + 1,
        cpu_time_ms: cpuTimeMs,
        gpu_time_ms: m.gpu?.samplesMs[i] ?? null,
        gpu_compute_ms: m.gpu?.computeMs[i] ?? null,
        h2d_ms: m.gpu?.h2dMs[i] ?? null,
        d2h_ms: m.gpu?.d2hMs[i] ?? null,
        valid: r.valid,
        provenance: 'MEASURED',
        environment: JSON.stringify(m.environment),
        config: JSON.stringify(m.config),
        methodology: m.methodology,
      }));
    });
    res
      .set('Content-Type', 'text/csv; charset=utf-8')
      .set('Content-Disposition', 'attachment; filename="corewise-measured-runs.csv"')
      .send(csv(rows));
  });
  router.post('/export-dataset', validate(benchmarkExportSchema), async (req, res) => {
    const input = benchmarkExportSchema.parse(req.body);
    const runs = await db.benchmarkRun.findMany({
      where: { userId: req.session.userId!, id: { in: input.runIds } },
    });
    if (runs.length !== new Set(input.runIds).size)
      throw new ApiError(404, 'NOT_FOUND', 'One or more owned benchmark runs were not found.');
    const result = measuredRows(
      runs.map((r) => ({ id: r.id, measurement: benchmarkMeasurementSchema.parse(r.measurement) })),
      input.capabilities,
    );
    res.json({
      data: {
        csv: csv(result.rows),
        rowCount: result.rows.length,
        excluded: result.excluded,
        trainingReady:
          result.rows.length >= 60 &&
          new Set(
            result.rows.map((r) =>
              JSON.stringify([
                r.hardware_id,
                r.workload_type,
                r.workload_size,
                r.operation_count,
                r.arithmetic_intensity,
                r.parallel_fraction,
                r.memory_mib,
                r.transfer_mib,
                r.precision,
                r.workload_unit,
              ]),
            ),
          ).size >= 6,
        provenance: 'MEASURED',
        schemaVersion: 'cw-features-1',
      },
    });
  });
  router.post('/datasets', validate(benchmarkExportSchema), async (req, res) => {
    const input = benchmarkExportSchema.parse(req.body);
    const runs = await db.benchmarkRun.findMany({
      where: { userId: req.session.userId!, id: { in: input.runIds } },
    });
    if (runs.length !== new Set(input.runIds).size)
      throw new ApiError(404, 'NOT_FOUND', 'Owned runs not found.');
    const result = measuredRows(
      runs.map((r) => ({ id: r.id, measurement: benchmarkMeasurementSchema.parse(r.measurement) })),
      input.capabilities,
    );
    if (result.excluded.length || result.rows.length < 60 || result.rows.length > 5000)
      throw new ApiError(
        422,
        'DATASET_NOT_READY',
        'Use valid paired end-to-end measurements, supply missing capability features and select 60–5000 samples. CPU-only runs remain in raw CSV history.',
      );
    const validated = z
      .object({
        rows: z.array(z.record(z.string(), z.unknown())),
        validation: z.record(z.string(), z.unknown()),
      })
      .parse(await mlRequest('/internal/datasets', { mode: 'CSV', csv: csv(result.rows) }));
    const dataset = await db.dataset.create({
      data: {
        userId: req.session.userId!,
        name: 'Measured local benchmarks',
        version: 'measured-cw-bench-1',
        schemaVersion: 'cw-features-1',
        provenance: 'MEASURED',
        rowCount: result.rows.length,
        rows: json(validated.rows),
        validation: json({
          ...validated.validation,
          source: 'paired local runner measurements',
          featureCapabilitySource: input.capabilities.source,
          benchmarkThreads: [
            ...new Set(
              runs.map((r) => benchmarkMeasurementSchema.parse(r.measurement).config.threads),
            ),
          ],
          detectedHardware: runs.map((r) => {
            const e = benchmarkMeasurementSchema.parse(r.measurement).environment;
            return {
              cpuModel: e.cpuModel,
              gpuModel: e.gpuRuntime?.model ?? e.gpus[0]?.model ?? null,
            };
          }),
        }),
      },
    });
    res
      .status(201)
      .json({ data: { id: dataset.id, rowCount: dataset.rowCount, provenance: 'MEASURED' } });
  });
  return router;
}

export function agentRoutes() {
  const router = Router();
  router.use((req, _res, next) => {
    if (
      !req.secure &&
      (process.env.NODE_ENV === 'production' ||
        !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.ip ?? ''))
    )
      return next(
        new ApiError(400, 'HTTPS_REQUIRED', 'Remote runner communication requires HTTPS.'),
      );
    next();
  });
  router.post(
    '/redeem',
    rateLimit({
      windowMs: 600000,
      limit: 20,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: { code: 'RATE_LIMITED', message: 'Too many pairing attempts.' } },
    }),
    validate(
      z
        .object({
          code: z.string().min(40).max(100),
          name: z.string().trim().min(1).max(120),
          environment: detectedEnvironmentSchema,
          registerHardware: z.boolean().default(false),
        })
        .strict(),
    ),
    async (req, res) => {
      const input = z
          .object({
            code: z.string(),
            name: z.string(),
            environment: detectedEnvironmentSchema,
            registerHardware: z.boolean().default(false),
          })
          .parse(req.body),
        token = randomBytes(48).toString('base64url');
      const agent = await db.$transaction(async (tx) => {
        const ticket = await tx.agentPairing.findUnique({ where: { codeHash: hash(input.code) } });
        if (!ticket || ticket.usedAt || ticket.expiresAt <= new Date())
          throw new ApiError(
            401,
            'PAIRING_INVALID',
            'Pairing code expired, invalid or already used.',
          );
        const used = await tx.agentPairing.updateMany({
          where: { id: ticket.id, usedAt: null, expiresAt: { gt: new Date() } },
          data: { usedAt: new Date() },
        });
        if (used.count !== 1)
          throw new ApiError(401, 'PAIRING_INVALID', 'Pairing code already used.');
        const paired = await tx.localAgent.create({
          data: {
            userId: ticket.userId,
            name: input.name,
            tokenHash: hash(token),
            environment: json(input.environment),
            expiresAt: new Date(Date.now() + 90 * 86400000),
            lastSeenAt: new Date(),
          },
        });
        if (input.registerHardware) {
          const owner = await tx.user.findUniqueOrThrow({ where: { id: ticket.userId } });
          await importDetectedProfile(tx, paired, input.name, !owner.defaultProfileId);
        }
        return paired;
      });
      res
        .status(201)
        .json({ data: { agentId: agent.id, token, expiresAt: agent.expiresAt.toISOString() } });
    },
  );
  router.post('/session', async (req, res) => {
    const authorization = req.get('authorization');
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
    const agent =
      token.length >= 40
        ? await db.localAgent.findUnique({ where: { tokenHash: hash(token) } })
        : null;
    if (!agent || agent.revokedAt || agent.expiresAt <= new Date())
      throw new ApiError(
        401,
        'AGENT_UNAUTHORIZED',
        'Runner credential invalid, revoked or expired.',
      );
    await new Promise<void>((resolve, reject) =>
      req.session.regenerate((e) => (e ? reject(e) : resolve())),
    );
    req.session.agentId = agent.id;
    await save(req);
    res.json({ data: { agentId: agent.id } });
  });
  router.use(requireAgent);
  router.post(
    '/telemetry',
    rateLimit({
      windowMs: 60000,
      limit: 60,
      keyGenerator: (req) => req.session.agentId!,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
    }),
    validate(telemetrySampleSchema),
    async (req, res) => {
      const sample = telemetrySampleSchema.parse(req.body),
        age = Date.now() - Date.parse(sample.capturedAt);
      if (age < -10000 || age > 30000)
        throw new ApiError(
          400,
          'STALE_TELEMETRY',
          'Send a current sample with a synchronized local clock.',
        );
      await db.localAgent.update({
        where: { id: req.session.agentId! },
        data: { latestTelemetry: json(sample), telemetryReceivedAt: new Date() },
      });
      res.json({ data: { accepted: true } });
    },
  );
  router.post('/claim', async (req, res) => {
    const agentId = req.session.agentId!;
    const j = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "LocalAgent" WHERE id=${agentId} FOR UPDATE`;
      const pending = await tx.benchmarkJob.findFirst({
        where: { agentId, status: 'QUEUED' },
        orderBy: { createdAt: 'asc' },
      });
      if (!pending) return null;
      const config = benchmarkConfigSchema.parse(pending.config);
      return tx.benchmarkJob.update({
        where: { id: pending.id },
        data: {
          status: 'RUNNING',
          startedAt: new Date(),
          leaseUntil: new Date(Date.now() + (config.timeoutSeconds + 90) * 1000),
        },
        include: jobInclude,
      });
    });
    res.json({ data: j ? jobView(j) : null });
  });
  router.get('/jobs/:id', async (req, res) => {
    const j = await db.benchmarkJob.findFirst({
      where: { id: id(req), agentId: req.session.agentId! },
      include: jobInclude,
    });
    if (!j) throw new ApiError(404, 'NOT_FOUND', 'Assigned job not found.');
    res.json({ data: jobView(j) });
  });
  const resultSchema = z.discriminatedUnion('status', [
    z.object({ status: z.literal('COMPLETED'), measurement: benchmarkMeasurementSchema }).strict(),
    z.object({ status: z.enum(['FAILED', 'CANCELLED']), error: z.string().max(2000) }).strict(),
  ]);
  router.post('/jobs/:id/result', validate(resultSchema), async (req, res) => {
    const input = resultSchema.parse(req.body),
      agentId = req.session.agentId!;
    const result = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "BenchmarkJob" WHERE id=${id(req)} AND "agentId"=${agentId} FOR UPDATE`;
      const j = await tx.benchmarkJob.findFirst({ where: { id: id(req), agentId } });
      if (!j) throw new ApiError(404, 'NOT_FOUND', 'Assigned job not found.');
      if (
        !['RUNNING', 'CANCEL_REQUESTED'].includes(j.status) ||
        !j.leaseUntil ||
        j.leaseUntil <= new Date()
      )
        throw new ApiError(
          409,
          'JOB_TERMINAL',
          'Job is terminal or its lease expired; results cannot be replaced.',
        );
      if (j.status === 'CANCEL_REQUESTED' || input.status !== 'COMPLETED') {
        const cancelled = j.status === 'CANCEL_REQUESTED' || input.status === 'CANCELLED';
        await tx.benchmarkJob.update({
          where: { id: j.id },
          data: {
            status: cancelled ? 'CANCELLED' : 'FAILED',
            error:
              input.status === 'COMPLETED' ? 'Cancelled before result acceptance' : input.error,
            completedAt: new Date(),
            leaseUntil: null,
          },
        });
        return null;
      }
      const measurement = validateMeasurement(
        input.measurement,
        benchmarkConfigSchema.parse(j.config),
      );
      const run = await tx.benchmarkRun.create({
        data: {
          userId: j.userId,
          agentId,
          jobId: j.id,
          measurement: json(measurement),
          valid: measurement.valid,
          provenance: 'MEASURED',
        },
      });
      await tx.benchmarkJob.update({
        where: { id: j.id },
        data: {
          status: measurement.valid ? 'COMPLETED' : 'INVALID',
          error: measurement.valid
            ? null
            : 'Numerical correctness validation failed; excluded from training.',
          completedAt: new Date(),
          leaseUntil: null,
        },
      });
      return run;
    });
    res.status(201).json({ data: result ? runView(result) : null });
  });
  return router;
}
