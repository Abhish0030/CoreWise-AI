import { Router } from 'express';
import { z, explanationInputSchema, explanationSchema } from '@corewise/types';
import type { ModelExplanation } from '@prisma/client';
import { db } from '../../lib/db.js';
import { ApiError, validate } from '../../lib/errors.js';
import { requireUser } from '../auth/routes.js';
import { mlRequest } from '../ml/routes.js';
function serialize(r: ModelExplanation) {
  return explanationSchema.parse({
    ...r,
    createdAt: r.createdAt.toISOString(),
    startedAt: r.startedAt?.toISOString() ?? null,
    completedAt: r.completedAt?.toISOString() ?? null,
  });
}
async function expire(userId: string) {
  await db.modelExplanation.updateMany({
    where: { userId, status: 'RUNNING', leaseUntil: { lt: new Date() } },
    data: {
      status: 'FAILED',
      error: 'SHAP worker lease expired. Retry this explanation request.',
      completedAt: new Date(),
    },
  });
}
export function explanationRoutes() {
  const router = Router();
  router.use(requireUser);
  router.post('/', validate(explanationInputSchema), async (req, res) => {
    const input = explanationInputSchema.parse(req.body),
      userId = req.session.userId!;
    if (input.kind === 'LOCAL') {
      const p = await db.mLPrediction.findUnique({
        where: { id_userId: { id: input.predictionId, userId } },
      });
      if (!p) throw new ApiError(404, 'NOT_FOUND', 'Prediction not found.');
    } else if (
      !(await db.mLModel.findUnique({ where: { id_userId: { id: input.modelId, userId } } }))
    )
      throw new ApiError(404, 'NOT_FOUND', 'Model not found.');
    await expire(userId);
    const response = z
      .object({ id: z.string() })
      .parse(await mlRequest('/internal/explanations', { ...input, userId }));
    const record = await db.modelExplanation.findUnique({
      where: { id_userId: { id: response.id, userId } },
    });
    if (!record)
      throw new ApiError(
        503,
        'EXPLANATION_UNAVAILABLE',
        'The explanation job could not be retrieved.',
      );
    res.status(record.status === 'COMPLETED' ? 200 : 202).json({ data: serialize(record) });
  });
  router.get('/', async (req, res) => {
    const userId = req.session.userId!;
    await expire(userId);
    res.json({
      data: (
        await db.modelExplanation.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 100,
        })
      ).map(serialize),
    });
  });
  router.get('/prediction/:predictionId', async (req, res) => {
    const userId = req.session.userId!,
      predictionId = String(req.params.predictionId);
    if (!(await db.mLPrediction.findUnique({ where: { id_userId: { id: predictionId, userId } } })))
      throw new ApiError(404, 'NOT_FOUND', 'Prediction not found.');
    await expire(userId);
    res.json({
      data: (
        await db.modelExplanation.findMany({
          where: { userId, predictionId, kind: 'LOCAL' },
          orderBy: { createdAt: 'desc' },
          take: 100,
        })
      ).map(serialize),
    });
  });
  router.get('/global/:modelId', async (req, res) => {
    const userId = req.session.userId!,
      modelId = String(req.params.modelId);
    if (!(await db.mLModel.findUnique({ where: { id_userId: { id: modelId, userId } } })))
      throw new ApiError(404, 'NOT_FOUND', 'Model not found.');
    await expire(userId);
    const record = await db.modelExplanation.findFirst({
      where: { userId, modelId, kind: 'GLOBAL' },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: record ? serialize(record) : null });
  });
  router.get('/:id', async (req, res) => {
    const userId = req.session.userId!;
    await expire(userId);
    const record = await db.modelExplanation.findUnique({
      where: { id_userId: { id: String(req.params.id), userId } },
    });
    if (!record) throw new ApiError(404, 'NOT_FOUND', 'Explanation not found.');
    res.json({ data: serialize(record) });
  });
  return router;
}
