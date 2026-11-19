import { Prisma } from '@prisma/client';
import { Router } from 'express';
import type { HardwareProfile } from '@prisma/client';
import { hardwareInputSchema, hardwareResponseSchema, hardwareListSchema } from '@corewise/types';
import { db } from '../../lib/db.js';
import { validate, ApiError } from '../../lib/errors.js';
import { requireUser } from '../auth/routes.js';

function serialize(record: HardwareProfile) {
  const fields: Record<string, unknown> = { ...record };
  delete fields.userId;
  return {
    ...fields,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
export function hardwareRoutes() {
  const router = Router();
  router.use(requireUser);
  router.get('/', async (req, res) => {
    const records = await db.hardwareProfile.findMany({
      where: { userId: req.session.userId! },
      orderBy: { createdAt: 'desc' },
    });
    res.json(hardwareListSchema.parse({ data: records.map(serialize) }));
  });
  router.post('/', validate(hardwareInputSchema), async (req, res) => {
    const record = await db.hardwareProfile.create({
      data: {
        ...hardwareInputSchema.parse(req.body),
        userId: req.session.userId!,
        provenance: 'USER_ENTERED',
      },
    });
    res.status(201).json(hardwareResponseSchema.parse({ data: serialize(record) }));
  });
  router.use('/:id', async (req, res, next) => {
    const record = await db.hardwareProfile.findUnique({
      where: { id_userId: { id: String(req.params.id), userId: req.session.userId! } },
    });
    if (!record) throw new ApiError(404, 'NOT_FOUND', 'Hardware profile not found.');
    res.locals.profileId = record.id;
    next();
  });
  router.get('/:id', async (req, res) => {
    const record = await db.hardwareProfile.findUniqueOrThrow({
      where: { id_userId: { id: String(req.params.id), userId: req.session.userId! } },
    });
    res.json(hardwareResponseSchema.parse({ data: serialize(record) }));
  });
  router.put('/:id', validate(hardwareInputSchema), async (req, res) => {
    const record = await db.hardwareProfile.update({
      where: { id_userId: { id: String(req.params.id), userId: req.session.userId! } },
      data: {
        ...hardwareInputSchema.parse(req.body),
        provenance: 'USER_ENTERED',
        detectionSnapshot: Prisma.DbNull,
      },
    });
    res.json(hardwareResponseSchema.parse({ data: serialize(record) }));
  });
  router.delete('/:id', async (req, res) => {
    await db.hardwareProfile.delete({
      where: { id_userId: { id: String(req.params.id), userId: req.session.userId! } },
    });
    res.status(204).end();
  });
  for (const action of ['default', 'select'] as const) {
    router.post(`/:id/${action}`, async (req, res) => {
      await db.user.update({
        where: { id: req.session.userId! },
        data: {
          [action === 'default' ? 'defaultProfile' : 'selectedProfile']: {
            connect: { id_userId: { id: String(req.params.id), userId: req.session.userId! } },
          },
        },
      });
      res.status(204).end();
    });
  }
  return router;
}
