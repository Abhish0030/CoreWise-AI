import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from '@corewise/types';
import { db } from '../../lib/db.js';
import { ApiError, validate } from '../../lib/errors.js';
import { requireUser } from '../auth/routes.js';

const policy = z
  .object({
    cpuModel: z.string().trim().min(1).max(200),
    gpuModel: z.string().trim().min(1).max(200),
    workloads: z.array(z.string().min(1).max(100)).min(1).max(5),
    precisions: z.array(z.string().min(1).max(50)).min(1).max(3),
    ranges: z
      .record(z.string(), z.tuple([z.number().finite(), z.number().finite()]))
      .refine(
        (v) => Object.keys(v).length > 0 && Object.values(v).every(([a, b]) => a <= b),
        'Specify ordered numerical feature ranges',
      ),
  })
  .strict();
const publicationInput = z
  .object({
    compatibility: policy,
    limitations: z
      .string()
      .trim()
      .min(30)
      .max(4000)
      .refine((v) => /experimental/i.test(v), 'Include an explicit experimental disclosure'),
    reason: z.string().trim().min(10).max(1000),
  })
  .strict();
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;

export function publicationRoutes() {
  const router = Router();
  router.use(requireUser);
  // Deployment-controlled explicit IDs only. Empty configuration grants nobody access.
  router.use((req, _res, next) => {
    const administrators = (process.env.MODEL_PUBLICATION_ADMIN_IDS ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    if (!administrators.includes(req.session.userId!))
      return next(
        new ApiError(403, 'ADMIN_REQUIRED', 'Publication administrator access required.'),
      );
    next();
  });
  router.post('/:id/publish', validate(publicationInput), async (req, res) => {
    const input = publicationInput.parse(req.body),
      modelId = String(req.params.id);
    if (!z.uuid().safeParse(modelId).success)
      throw new ApiError(400, 'INVALID_MODEL_ID', 'Use an explicit model UUID.');
    await db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "MLModel" WHERE id=${modelId} FOR UPDATE`;
      if (!rows.length) throw new ApiError(404, 'NOT_FOUND', 'Model not found.');
      const model = await tx.mLModel.findUniqueOrThrow({ where: { id: modelId } });
      if (model.status !== 'READY')
        throw new ApiError(409, 'MODEL_UNAVAILABLE', 'Model must be READY.');
      const schema = z
        .object({
          categories: z.record(z.string(), z.array(z.string())),
          ranges: z.record(z.string(), z.tuple([z.number(), z.number()])),
        })
        .parse(model.featureSchema);
      const dataset = await tx.dataset.findUniqueOrThrow({ where: { id: model.datasetId } });
      const detected = z
        .object({
          detectedHardware: z.array(z.object({ cpuModel: z.string(), gpuModel: z.string() })),
        })
        .safeParse(dataset.validation);
      if (
        !detected.success ||
        !detected.data.detectedHardware.some(
          (h) =>
            h.cpuModel === input.compatibility.cpuModel &&
            h.gpuModel === input.compatibility.gpuModel,
        )
      )
        throw new ApiError(
          422,
          'INCOMPATIBLE_POLICY',
          'Approved hardware must match recorded training hardware.',
        );
      if (Object.keys(input.compatibility.ranges).some((key) => !(key in schema.ranges)))
        throw new ApiError(
          422,
          'INCOMPATIBLE_POLICY',
          'Use recorded numerical feature ranges only.',
        );
      for (const [field, values] of Object.entries({
        workload_type: input.compatibility.workloads,
        precision: input.compatibility.precisions,
      }))
        if (values.some((v) => !schema.categories[field]?.includes(v)))
          throw new ApiError(
            422,
            'INCOMPATIBLE_POLICY',
            'Publication categories exceed training support.',
          );
      for (const [field, [low, high]] of Object.entries(schema.ranges)) {
        const range = input.compatibility.ranges[field];
        if (!range || range[0] < low || range[1] > high)
          throw new ApiError(
            422,
            'INCOMPATIBLE_POLICY',
            `Restrict ${field} to its training range.`,
          );
      }
      const data = {
        approvedArtifactSha256: model.sha256,
        approvedBy: req.session.userId!,
        approvedAt: new Date(),
        hardwareCompatibility: json(input.compatibility),
        limitations: input.limitations,
        revokedAt: null,
      };
      await tx.sharedModelPublication.upsert({
        where: { modelId },
        create: { modelId, ...data },
        update: data,
      });
      await tx.sharedModelPublicationEvent.create({
        data: {
          modelId,
          actorUserId: req.session.userId!,
          action: 'PUBLISH',
          artifactSha256: model.sha256,
          compatibilitySnapshot: json(input.compatibility),
          limitations: input.limitations,
          reason: input.reason,
        },
      });
    });
    res.status(204).end();
  });
  router.post(
    '/:id/revoke',
    validate(z.object({ reason: z.string().trim().min(10).max(1000) }).strict()),
    async (req, res) => {
      const modelId = String(req.params.id);
      if (!z.uuid().safeParse(modelId).success)
        throw new ApiError(400, 'INVALID_MODEL_ID', 'Use an explicit model UUID.');
      await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "MLModel" WHERE id=${modelId} FOR UPDATE`;
        const publication = await tx.sharedModelPublication.findUnique({ where: { modelId } });
        if (!publication) throw new ApiError(404, 'NOT_FOUND', 'Publication not found.');
        await tx.sharedModelPublication.update({
          where: { modelId },
          data: { revokedAt: new Date() },
        });
        await tx.sharedModelPublicationEvent.create({
          data: {
            modelId,
            actorUserId: req.session.userId!,
            action: 'REVOKE',
            artifactSha256: publication.approvedArtifactSha256,
            compatibilitySnapshot: publication.hardwareCompatibility as Prisma.InputJsonValue,
            limitations: publication.limitations,
            reason: req.body.reason,
          },
        });
      });
      res.status(204).end();
    },
  );
  return router;
}
