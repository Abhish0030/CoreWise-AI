import { Router } from 'express';
import {
  hardwareImportSchema,
  hardwareResponseSchema,
  hardwareSchema,
  connectionSchema,
  telemetrySampleSchema,
} from '@corewise/types';
import { db } from '../../lib/db.js';
import { ApiError, validate } from '../../lib/errors.js';
import { requireUser } from '../auth/routes.js';
import { importDetectedProfile } from './import-hardware.js';
export function functionalRoutes() {
  const r = Router();
  r.use(requireUser);
  r.get('/connection', async (req, res) => {
    res.json(await readHardwareConnection(req.session.userId!));
  });
  r.post('/import-hardware', validate(hardwareImportSchema), async (req, res) => {
    const input = hardwareImportSchema.parse(req.body),
      userId = req.session.userId!;
    const agent = await db.localAgent.findUnique({
      where: { id_userId: { id: input.agentId, userId } },
    });
    if (!agent || agent.revokedAt || agent.expiresAt <= new Date())
      throw new ApiError(404, 'NOT_FOUND', 'Active owned runner not found. Pair it first.');
    const existing = await db.hardwareProfile.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
    const existingAgentProfile = existing &&
      (existing.detectionSnapshot as { agentId?: string } | null)?.agentId === agent.id
      ? existing
      : null;
    const profile = existingAgentProfile
      ? existingAgentProfile
      : await db.$transaction((tx) => importDetectedProfile(tx, agent, input.name, input.setDefault));
    if (existingAgentProfile && input.setDefault) {
      await db.user.update({ where: { id: userId }, data: { defaultProfileId: profile.id, selectedProfileId: profile.id } });
    }
    res.status(201).json(
      hardwareResponseSchema.parse({
        data: hardwareSchema.parse({
          ...Object.fromEntries(Object.entries(profile).filter(([key]) => key !== 'userId')),
          createdAt: profile.createdAt.toISOString(),
          updatedAt: profile.updatedAt.toISOString(),
        }),
      }),
    );
  });
  return r;
}

export async function readHardwareConnection(userId: string) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    include: { selectedProfile: true, defaultProfile: true },
  });
  const profile = user.selectedProfile ?? user.defaultProfile;
  const agentId = (profile?.detectionSnapshot as { agentId?: string } | null)?.agentId ?? null;
  const agents = await db.localAgent.findMany({
    where: { userId, revokedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  // Keep an older selected device visible alongside the recent device list.
  if (agentId && !agents.some((agent) => agent.id === agentId)) {
    const selected = await db.localAgent.findFirst({
      where: { id: agentId, userId, revokedAt: null },
    });
    if (selected) agents.push(selected);
  }
  return connectionSchema.parse({
    data: {
      selectedAgentId: agentId,
      profileMatched: !!agentId,
      agents: agents.map((a) => {
        const expired = a.expiresAt <= new Date();
        const sample = telemetrySampleSchema.safeParse(a.latestTelemetry);
        const fresh =
          a.telemetryReceivedAt &&
          Date.now() - a.telemetryReceivedAt.getTime() <= 15000 &&
          sample.success &&
          Date.now() - Date.parse(sample.data.capturedAt) <= 15000;
        return {
          id: a.id,
          name: a.name,
          status: expired
            ? 'EXPIRED'
            : fresh
              ? 'FRESH'
              : a.telemetryReceivedAt
                ? 'STALE'
                : 'AWAITING_TELEMETRY',
          receivedAt: a.telemetryReceivedAt?.toISOString() ?? null,
          telemetry: !expired && fresh && sample.success ? sample.data : null,
        };
      }),
    },
  });
}
