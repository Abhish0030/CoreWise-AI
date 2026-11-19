import { Router } from 'express';
import type { ComparisonResult } from '@prisma/client';
import {
  z,
  analyticalRequestSchema,
  comparisonSchema,
  comparisonResponseSchema,
  comparisonListSchema,
  hardwareSchema,
  workloadInputSchema,
} from '@corewise/types';
import { db } from '../../lib/db.js';
import { ApiError, validate } from '../../lib/errors.js';
import { requireUser } from '../auth/routes.js';
import { serializeWorkload } from '../workloads/routes.js';
import { estimate, MODEL_VERSION } from './model.js';

function serialize(record: ComparisonResult) {
  const fields: Record<string, unknown> = { ...record };
  delete fields.userId;
  return comparisonSchema.parse({ ...fields, createdAt: record.createdAt.toISOString() });
}
export async function computeAnalysis(
  userId: string,
  input: z.infer<typeof analyticalRequestSchema>,
) {
  const workload = await db.workload.findUnique({
    where: { id_userId: { id: input.workloadId, userId } },
  });
  if (!workload) throw new ApiError(404, 'NOT_FOUND', 'Workload not found.');
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { selectedProfileId: true, defaultProfileId: true },
  });
  const profileId =
    input.hardwareProfileId ??
    workload.hardwareProfileId ??
    user.selectedProfileId ??
    user.defaultProfileId;
  if (!profileId)
    throw new ApiError(
      422,
      'HARDWARE_REQUIRED',
      'Select an owned hardware profile before analysis.',
      { hardwareProfileId: ['No hardware profile selected.'] },
    );
  const record = await db.hardwareProfile.findUnique({
    where: { id_userId: { id: profileId, userId } },
  });
  if (!record) throw new ApiError(404, 'NOT_FOUND', 'Hardware profile not found.');
  const fields: Record<string, unknown> = { ...record };
  delete fields.userId;
  const hardware = hardwareSchema.parse({
    ...fields,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
  const saved = serializeWorkload(workload);
  const config = workloadInputSchema.parse({
    ...workloadInputSchema.strip().parse(saved),
    hardwareProfileId: record.id,
    assumptions: input.assumptions,
    tolerance: input.tolerance,
  });
  const result = estimate(config, hardware, input.assumptions, input.tolerance);
  return { workload, record, config, hardware, result };
}
export function analyticalRoutes() {
  const router = Router();
  router.use(['/analytical', '/comparisons'], requireUser);
  for (const action of ['estimate', 'compare'] as const) {
    router.post(`/analytical/${action}`, validate(analyticalRequestSchema), async (req, res) => {
      const input = analyticalRequestSchema.parse(req.body);
      const userId = req.session.userId!;
      const { workload, record, config, hardware, result } = await computeAnalysis(userId, input);
      const comparison = await db.comparisonResult.create({
        data: {
          userId,
          workloadId: workload.id,
          hardwareProfileId: record.id,
          kind: action === 'estimate' ? 'ESTIMATE' : 'COMPARISON',
          workloadSnapshot: config,
          hardwareSnapshot: JSON.parse(JSON.stringify(hardware)),
          result,
          modelVersion: MODEL_VERSION,
          provenance: 'ANALYTICAL',
        },
      });
      res.status(201).json(comparisonResponseSchema.parse({ data: serialize(comparison) }));
    });
  }
  router.get('/comparisons', async (req, res) => {
    const records = await db.comparisonResult.findMany({
      where: { userId: req.session.userId!, kind: 'COMPARISON' },
      orderBy: { createdAt: 'desc' },
    });
    res.json(comparisonListSchema.parse({ data: records.map(serialize) }));
  });
  router.get('/comparisons/:id', async (req, res) => {
    const record = await db.comparisonResult.findUnique({
      where: { id_userId: { id: String(req.params.id), userId: req.session.userId! } },
    });
    if (!record || record.kind !== 'COMPARISON')
      throw new ApiError(404, 'NOT_FOUND', 'Comparison not found.');
    res.json(comparisonResponseSchema.parse({ data: serialize(record) }));
  });
  return router;
}
