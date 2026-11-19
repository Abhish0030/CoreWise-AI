import { Router } from 'express';
import type { Workload } from '@prisma/client';
import {
  workloadInputSchema,
  workloadPatchSchema,
  workloadSchema,
  workloadResponseSchema,
  workloadListSchema,
} from '@corewise/types';
import { db } from '../../lib/db.js';
import { ApiError, validate } from '../../lib/errors.js';
import { requireUser } from '../auth/routes.js';

export function serializeWorkload(record: Workload) {
  const fields: Record<string, unknown> = { ...record };
  delete fields.userId;
  return workloadSchema.parse({
    ...fields,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
}
async function checkProfile(userId: string, profileId: string | null) {
  if (
    profileId &&
    !(await db.hardwareProfile.findUnique({
      where: { id_userId: { id: profileId, userId } },
      select: { id: true },
    }))
  )
    throw new ApiError(404, 'NOT_FOUND', 'Hardware profile not found.');
}
export function workloadRoutes() {
  const router = Router();
  router.use(requireUser);
  router.get('/', async (req, res) => {
    const records = await db.workload.findMany({
      where: { userId: req.session.userId! },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(workloadListSchema.parse({ data: records.map(serializeWorkload) }));
  });
  router.post('/', validate(workloadInputSchema), async (req, res) => {
    const input = workloadInputSchema.parse(req.body);
    await checkProfile(req.session.userId!, input.hardwareProfileId);
    const record = await db.workload.create({
      data: {
        ...input,
        userId: req.session.userId!,
        provenance: input.presetId ? 'SYNTHETIC_DEMO' : 'USER_ENTERED',
      },
    });
    res.status(201).json(workloadResponseSchema.parse({ data: serializeWorkload(record) }));
  });
  router.get('/:id', async (req, res) => {
    const record = await db.workload.findUnique({
      where: { id_userId: { id: String(req.params.id), userId: req.session.userId! } },
    });
    if (!record) throw new ApiError(404, 'NOT_FOUND', 'Workload not found.');
    res.json(workloadResponseSchema.parse({ data: serializeWorkload(record) }));
  });
  router.patch('/:id', validate(workloadPatchSchema), async (req, res) => {
    const key = { id: String(req.params.id), userId: req.session.userId! };
    const record = await db.workload.findUnique({ where: { id_userId: key } });
    if (!record) throw new ApiError(404, 'NOT_FOUND', 'Workload not found.');
    const original = workloadInputSchema.parse(
      Object.fromEntries(
        Object.keys(workloadInputSchema.shape).map((field) => [
          field,
          serializeWorkload(record)[field as keyof ReturnType<typeof serializeWorkload>],
        ]),
      ),
    );
    const merged = workloadInputSchema.safeParse({ ...original, ...req.body });
    if (!merged.success)
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Check the workload parameters.',
        Object.fromEntries(
          merged.error.issues.map((issue) => [issue.path.join('.'), [issue.message]]),
        ),
      );
    await checkProfile(key.userId, merged.data.hardwareProfileId);
    const updated = await db.workload.update({
      where: { id_userId: key },
      data: {
        ...merged.data,
        provenance: merged.data.presetId ? 'SYNTHETIC_DEMO' : 'USER_ENTERED',
      },
    });
    res.json(workloadResponseSchema.parse({ data: serializeWorkload(updated) }));
  });
  router.delete('/:id', async (req, res) => {
    const removed = await db.workload.deleteMany({
      where: { id: String(req.params.id), userId: req.session.userId! },
    });
    if (!removed.count) throw new ApiError(404, 'NOT_FOUND', 'Workload not found.');
    res.status(204).end();
  });
  return router;
}
