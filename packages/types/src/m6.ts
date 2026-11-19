import { z } from 'zod';
export const agentContextSchema = z
  .object({
    hardwareProfileId: z.string().min(1).max(100).optional(),
    workloadId: z.string().min(1).max(100).optional(),
  })
  .strict();
export const agentMessageInputSchema = z
  .object({ content: z.string().trim().min(1).max(4000), context: agentContextSchema.default({}) })
  .strict();
export const agentConversationInputSchema = z
  .object({ title: z.string().trim().min(1).max(100).default('New conversation') })
  .strict();
export const agentReferenceSchema = z.object({
  type: z.string(),
  id: z.string(),
  label: z.string(),
  href: z.string().startsWith('/'),
  provenance: z.string(),
});
export const agentToolResultSchema = z.object({
  available: z.boolean(),
  provenance: z.string(),
  units: z.record(z.string(), z.string()),
  references: z.array(agentReferenceSchema),
  data: z.unknown(),
  notice: z.string().optional(),
});
export const agentToolCallSchema = z.object({
  id: z.string(),
  name: z.string(),
  arguments: z.unknown(),
  result: agentToolResultSchema.nullable(),
  status: z.string(),
  durationMs: z.number(),
  createdAt: z.string(),
});
export const agentMessageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  role: z.enum(['USER', 'ASSISTANT']),
  content: z.string(),
  status: z.enum(['STREAMING', 'COMPLETED', 'FAILED', 'CANCELLED']),
  error: z.string().nullable(),
  provider: z.string().nullable(),
  model: z.string().nullable(),
  usage: z.unknown(),
  references: z.array(agentReferenceSchema),
  context: agentContextSchema,
  createdAt: z.string(),
  completedAt: z.string().nullable(),
  tools: z.array(agentToolCallSchema),
});
export const agentConversationSchema = z.object({
  id: z.string(),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const agentConversationListSchema = z.object({ data: z.array(agentConversationSchema) });
export const agentConversationResponseSchema = z.object({ data: agentConversationSchema });
export const agentMessagesSchema = z.object({ data: z.array(agentMessageSchema) });
export const agentStatusSchema = z.object({
  data: z.object({
    configured: z.boolean(),
    connection: z.enum(['UNCONFIGURED', 'NOT_CHECKED', 'CONNECTED', 'ERROR']),
    provider: z.string().nullable(),
    model: z.string().nullable(),
    message: z.string(),
    limits: z.object({
      toolCalls: z.number(),
      iterations: z.number(),
      contextMessages: z.number(),
      outputTokens: z.number(),
      timeoutSeconds: z.number(),
    }),
  }),
});
export const agentEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('start'), messageId: z.string() }),
  z.object({
    type: z.literal('tool'),
    name: z.string(),
    status: z.enum(['STARTED', 'COMPLETED', 'FAILED']),
    result: agentToolResultSchema.optional(),
  }),
  z.object({ type: z.literal('chunk'), text: z.string().max(16000) }),
  z.object({
    type: z.literal('metadata'),
    provider: z.string(),
    model: z.string(),
    usage: z.unknown().optional(),
  }),
  z.object({ type: z.literal('complete'), messageId: z.string().optional() }),
  z.object({ type: z.literal('error'), code: z.string(), message: z.string() }),
]);
export type AgentEvent = z.infer<typeof agentEventSchema>;
export type AgentMessage = z.infer<typeof agentMessageSchema>;
export type AgentConversation = z.infer<typeof agentConversationSchema>;
