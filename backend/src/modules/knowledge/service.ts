import { randomUUID, createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { z } from '@corewise/types';
import { db } from '../../lib/db.js';
import { ApiError } from '../../lib/errors.js';
import { mlRequest } from '../ml/routes.js';
import { redact } from '../assistant/safety.js';
export const MODEL = 'sentence-transformers/all-MiniLM-L6-v2';
export const REVISION = '1110a243fdf4706b3f48f1d95db1a4f5529b4d41';
const digest = (text: string) => createHash('sha256').update(text).digest('hex');
export const sourceTypes = ['NOTE', 'REPORT', 'WORKLOAD', 'PROJECT_DOCUMENTATION'] as const;
export const searchSchema = z
  .object({
    query: z.string().trim().min(2).max(1000),
    limit: z.number().int().min(1).max(6).default(4),
    sourceType: z.enum(sourceTypes).optional(),
  })
  .strict();
export function safeText(text: string) {
  if (
    redact(text) !== text ||
    /postgres(?:ql)?:\/\/|[\w.+-]+@[\w.-]+\.[a-z]{2,}|["']?(?:password|api[_ -]?key|token|secret|authorization|cookie)["']?\s*[:=]/i.test(
      text,
    )
  )
    throw new ApiError(
      422,
      'SENSITIVE_CONTENT',
      'Remove credentials, connection strings and personal contact details before indexing.',
    );
  for (const name of [
    'DIRECT_URL',
    'DATABASE_URL',
    'DIRECT_URL',
    'NEON_API_KEY',
    'GROQ_API_KEY',
    'SESSION_SECRET',
    'ML_INTERNAL_TOKEN',
  ])
    if (process.env[name] && process.env[name]!.length >= 8 && text.includes(process.env[name]!))
      throw new ApiError(422, 'SENSITIVE_CONTENT', 'Private configuration cannot be indexed.');
  return text;
}
const vector = z
  .array(z.number().finite())
  .length(384)
  .refine((v) => v.reduce((s, x) => s + x * x, 0) > 1e-12, 'Nonzero vector required');
const embeddingsSchema = z.object({
  model: z.literal(MODEL),
  revision: z.literal(REVISION),
  dimension: z.literal(384),
  chunks: z
    .array(
      z.object({
        text: z.string().min(1).max(24000),
        contentHash: z.string().length(64),
        embedding: vector,
      }),
    )
    .min(1)
    .max(64),
});
export async function embed(text: string, mode: 'document' | 'query') {
  const parsed = embeddingsSchema.safeParse(
    await mlRequest('/internal/knowledge/embed', { text: safeText(text), mode }),
  );
  if (!parsed.success)
    throw new ApiError(
      503,
      'EMBEDDING_INVALID',
      'Embedding response does not match the pinned model and dimension.',
    );
  const result = parsed.data;
  if (mode === 'query' && result.chunks.length !== 1)
    throw new ApiError(503, 'EMBEDDING_INVALID', 'Embedding query response is invalid.');
  return result;
}
export const documentInput = z
  .object({
    title: z.string().trim().min(1).max(120),
    text: z.string().trim().min(10).max(24000),
    sourceId: z.string().min(1).max(120).optional(),
  })
  .strict();
type Document = {
  title: string;
  text: string;
  sourceId: string;
  sourceType: (typeof sourceTypes)[number];
  provenance: string;
};
export async function ingest(ownerId: string | null, input: Document, reindex = false) {
  const visibility = ownerId ? 'PRIVATE' : 'PUBLIC';
  if (!ownerId && input.sourceType !== 'PROJECT_DOCUMENTATION')
    throw new ApiError(
      403,
      'PRIVATE_SOURCE',
      'Only operator-curated project documentation can be public.',
    );
  safeText(input.title);
  safeText(input.text);
  const contentHash = digest('cw-token-offset-192-32-v1\n' + input.text);
  const where = { ownerId, visibility, sourceType: input.sourceType, sourceId: input.sourceId };
  const old = await db.knowledgeDocument.findFirst({ where });
  if (
    !reindex &&
    old?.contentHash === contentHash &&
    old.title === input.title &&
    old.embeddingRevision === REVISION
  )
    return { id: old.id, duplicate: true };
  const embedded = await embed(input.text, 'document');
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(where)}, 0))::text`;
      const existing = await tx.knowledgeDocument.findFirst({ where });
      const data = {
        ...input,
        ownerId,
        visibility,
        contentHash,
        embeddingModel: MODEL,
        embeddingRevision: REVISION,
        embeddingDimension: 384,
      };
      const document = existing
        ? await tx.knowledgeDocument.update({ where: { id: existing.id }, data })
        : await tx.knowledgeDocument.create({ data });
      await tx.knowledgeChunk.deleteMany({ where: { documentId: document.id } });
      await tx.$executeRaw(
        Prisma.sql`INSERT INTO "KnowledgeChunk" ("id","documentId","chunkIndex","text","contentHash","embedding") VALUES ${Prisma.join(embedded.chunks.map((c, i) => Prisma.sql`(${randomUUID()},${document.id},${i},${c.text},${digest(c.text)},${JSON.stringify(c.embedding)}::vector)`))}`,
      );
      return { id: document.id, duplicate: false, chunkCount: embedded.chunks.length };
    },
    { timeout: 20000 },
  );
}
export async function searchKnowledge(userId: string, args: unknown) {
  const input = searchSchema.parse(args);
  const embedded = await embed(input.query, 'query');
  const v = JSON.stringify(embedded.chunks[0]!.embedding);
  const filter = input.sourceType
    ? Prisma.sql`AND d."sourceType"=${input.sourceType}`
    : Prisma.empty;
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SET LOCAL statement_timeout = '5000ms'`;
      return tx.$queryRaw<
        Array<{
          id: string;
          documentId: string;
          title: string;
          text: string;
          sourceType: string;
          sourceId: string;
          visibility: string;
          provenance: string;
          similarity: number;
        }>
      >(Prisma.sql`
      SELECT c."id",d."id" AS "documentId",d."title",c."text",d."sourceType",d."sourceId",d."visibility",d."provenance",1-(c."embedding" <=> ${v}::vector) AS similarity
      FROM "KnowledgeChunk" c JOIN "KnowledgeDocument" d ON d."id"=c."documentId"
      WHERE ((d."ownerId"=${userId} AND d."visibility"='PRIVATE') OR (d."ownerId" IS NULL AND d."visibility"='PUBLIC' AND d."sourceType"='PROJECT_DOCUMENTATION'))
      AND d."embeddingModel"=${MODEL} AND d."embeddingRevision"=${REVISION} AND d."embeddingDimension"=384 ${filter}
      AND 1-(c."embedding" <=> ${v}::vector)>=0.15
      ORDER BY c."embedding" <=> ${v}::vector,c."id" LIMIT ${input.limit}`);
    },
    { timeout: 10000 },
  );
}
