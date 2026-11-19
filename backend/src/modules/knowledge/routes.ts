import { Router } from 'express';
import { z } from '@corewise/types';
import { db } from '../../lib/db.js';
import { ApiError, validate } from '../../lib/errors.js';
import { requireUser } from '../auth/routes.js';
import { hash } from '../assistant/safety.js';
import { documentInput, ingest, searchKnowledge, searchSchema } from './service.js';
export function knowledgeRoutes() {
  const r = Router();
  r.use(requireUser);
  const visible = (userId: string) => ({
    OR: [
      { ownerId: userId, visibility: 'PRIVATE' },
      { ownerId: null, visibility: 'PUBLIC', sourceType: 'PROJECT_DOCUMENTATION' },
    ],
  });
  r.post('/search', validate(searchSchema), async (req, res) =>
    res.json({ data: await searchKnowledge(req.session.userId!, req.body) }),
  );
  r.get('/documents', async (req, res) =>
    res.json({
      data: await db.knowledgeDocument.findMany({
        where: visible(req.session.userId!),
        select: {
          id: true,
          title: true,
          sourceType: true,
          sourceId: true,
          visibility: true,
          provenance: true,
          embeddingModel: true,
          embeddingRevision: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      }),
    }),
  );
  r.post('/documents', validate(documentInput), async (req, res) => {
    const input = documentInput.parse(req.body);
    res.status(201).json({
      data: await ingest(req.session.userId!, {
        ...input,
        sourceId: input.sourceId ?? hash(`${input.title}\n${input.text}`),
        sourceType: 'NOTE',
        provenance: 'USER_ENTERED',
      }),
    });
  });
  r.post(
    '/sources',
    validate(
      z
        .object({
          sourceType: z.enum(['REPORT', 'WORKLOAD']),
          sourceId: z.string().min(1).max(120),
        })
        .strict(),
    ),
    async (req, res) => {
      const input = req.body as { sourceType: 'REPORT' | 'WORKLOAD'; sourceId: string };
      const source =
        input.sourceType === 'REPORT'
          ? await db.generatedReport.findFirst({
              where: { id: input.sourceId, userId: req.session.userId! },
              select: { title: true, type: true, sourceCount: true, sourceReferences: true },
            })
          : await db.workload.findFirst({
              where: { id: input.sourceId, userId: req.session.userId! },
              select: {
                name: true,
                category: true,
                inputSize: true,
                inputUnit: true,
                description: true,
              },
            });
      if (!source) throw new ApiError(404, 'NOT_FOUND', 'Owned source not found.');
      const title = 'title' in source ? source.title : source.name;
      res.status(201).json({
        data: await ingest(req.session.userId!, {
          ...input,
          title,
          text: JSON.stringify(source),
          provenance: 'SAVED_SOURCE_SUMMARY',
        }),
      });
    },
  );
  r.get('/documents/:id', async (req, res) => {
    const source = await db.knowledgeDocument.findFirst({
      where: { id: String(req.params.id), ...visible(req.session.userId!) },
      include: {
        chunks: {
          select: { chunkIndex: true, text: true, contentHash: true },
          orderBy: { chunkIndex: 'asc' },
        },
      },
    });
    if (!source) throw new ApiError(404, 'NOT_FOUND', 'Visible knowledge source not found.');
    const { ownerId: _, ...data } = source;
    void _;
    res.json({ data });
  });
  r.post('/documents/:id/reindex', validate(z.object({}).strict()), async (req, res) => {
    const d = await db.knowledgeDocument.findFirst({
      where: { id: String(req.params.id), ownerId: req.session.userId!, visibility: 'PRIVATE' },
    });
    if (!d) throw new ApiError(404, 'NOT_FOUND', 'Owned document not found.');
    res.json({
      data: await ingest(
        req.session.userId!,
        {
          title: d.title,
          text: d.text,
          sourceType: d.sourceType as 'NOTE' | 'REPORT' | 'WORKLOAD',
          sourceId: d.sourceId,
          provenance: d.provenance,
        },
        true,
      ),
    });
  });
  r.delete('/documents/:id', async (req, res) => {
    const result = await db.knowledgeDocument.deleteMany({
      where: { id: String(req.params.id), ownerId: req.session.userId!, visibility: 'PRIVATE' },
    });
    if (!result.count) throw new ApiError(404, 'NOT_FOUND', 'Owned document not found.');
    res.status(204).end();
  });
  return r;
}
