import 'dotenv/config';
import { it, expect } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { db } from '../src/lib/db.js';
import { assertSharedCompatibility, publicationActive } from '../src/modules/ml/shared.js';
import type { HardwareProfile } from '@prisma/client';

it('isolates private models and audits administrator publication and revocation without leaking data', async () => {
  const app = createApp(),
    owner = request.agent(app),
    reader = request.agent(app);
  const emails: string[] = [],
    modelId = randomUUID();
  const original = process.env.MODEL_PUBLICATION_ADMIN_IDS;
  const post = async (a: typeof owner, path: string, data: object) => {
    const csrf = await a.get('/api/auth/csrf');
    expect(csrf.status).toBe(200);
    return a.post(path).set('x-csrf-token', csrf.body.data.token).send(data);
  };
  try {
    for (const a of [owner, reader]) {
      const email = `shared-test-${randomUUID()}@example.invalid`;
      emails.push(email);
      expect(
        (
          await post(a, '/api/auth/register', {
            email,
            name: 'Publication fixture',
            password: 'isolated model test passphrase2026',
          })
        ).status,
      ).toBe(201);
    }
    const userId = (await owner.get('/api/auth/me')).body.data.id;
    const dataset = await db.dataset.create({
      data: {
        userId,
        name: 'Isolated fixture',
        version: 'test',
        schemaVersion: 'cw-features-1',
        provenance: 'SYNTHETIC_DEMO',
        rowCount: 0,
        rows: [],
        validation: { detectedHardware: [{ cpuModel: 'Fixture CPU', gpuModel: 'Fixture GPU' }] },
      },
    });
    const job = await db.trainingJob.create({
      data: { userId, datasetId: dataset.id, status: 'COMPLETED', config: {} },
    });
    const metrics = { maeMs: 1, rmseMs: 2, r2: 0 };
    const evaluation = {
      validation: metrics,
      test: metrics,
      perFamily: {},
      points: [],
      split: {
        strategy: 'fixture',
        seed: 42,
        trainRows: 0,
        validationRows: 0,
        testRows: 0,
        trainGroups: 0,
        validationGroups: 0,
        testGroups: 0,
        groupOverlap: false,
      },
      selectionMetric: 'fixture',
      versions: {},
      provenance: 'SYNTHETIC_DEMO',
      label: 'Test fixture only',
    };
    const model = await db.mLModel.create({
      data: {
        id: modelId,
        userId,
        datasetId: dataset.id,
        trainingJobId: job.id,
        name: 'Private fixture name',
        algorithm: 'LINEAR',
        target: 'CPU',
        version: modelId,
        schemaVersion: 'cw-features-1',
        provenance: 'SYNTHETIC_DEMO',
        active: true,
        selected: true,
        sha256: 'a'.repeat(64),
        artifactLocation: 'private-fixture-path',
        featureSchema: {
          categories: { workload_type: ['VECTOR_ADDITION'], precision: ['FP32'] },
          ranges: { cpu_cores: [6, 6] },
        },
        evaluation,
        trainingConfig: {},
      },
    });
    const path = `/api/ml/publications/${modelId}`;
    const input = {
      compatibility: {
        cpuModel: 'Fixture CPU',
        gpuModel: 'Fixture GPU',
        workloads: ['VECTOR_ADDITION'],
        precisions: ['FP32'],
        ranges: { cpu_cores: [6, 6] },
      },
      limitations: 'Experimental fixture only; no accuracy claim is made.',
      reason: 'Isolated security test authorization',
    };
    expect((await owner.get(`/api/ml/models/${modelId}`)).status).toBe(200);
    expect((await reader.get(`/api/ml/models/${modelId}`)).status).toBe(404);
    expect((await reader.get('/api/ml/model-catalog')).body.data.shared).toEqual([]);
    expect((await post(owner, path + '/publish', input)).status).toBe(403);
    expect(
      (await post(reader, path + '/revoke', { reason: 'Unauthorized test attempt' })).status,
    ).toBe(403);
    process.env.MODEL_PUBLICATION_ADMIN_IDS = userId;
    expect((await owner.post(path + '/publish').send(input)).status).toBe(403);
    expect(
      (
        await post(owner, path + '/publish', {
          ...input,
          compatibility: { ...input.compatibility, cpuModel: 'Wrong CPU' },
        })
      ).status,
    ).toBe(422);
    expect((await post(owner, path + '/publish', input)).status).toBe(204);
    expect(
      await db.sharedModelPublicationEvent.count({ where: { modelId, action: 'PUBLISH' } }),
    ).toBe(1);
    const catalog = (await reader.get('/api/ml/model-catalog')).body.data;
    expect(catalog.private).toEqual([]);
    expect(catalog.shared[0].id).toBe(modelId);
    const serialized = JSON.stringify(catalog.shared);
    for (const secret of [
      dataset.id,
      userId,
      'private-fixture-path',
      'Private fixture name',
      'trainingJobId',
      'points',
    ])
      expect(serialized).not.toContain(secret);
    const pub = await db.sharedModelPublication.findUniqueOrThrow({ where: { modelId } });
    const hardware = { cpuName: 'Fixture CPU', gpuName: 'Fixture GPU' } as HardwareProfile;
    const features = { workload_type: 'VECTOR_ADDITION', precision: 'FP32', cpu_cores: 6 };
    expect(() => assertSharedCompatibility(pub, hardware, features)).not.toThrow();
    expect(() =>
      assertSharedCompatibility(pub, { ...hardware, cpuName: 'Other' }, features),
    ).toThrow();
    expect(() => assertSharedCompatibility(pub, hardware, { ...features, cpu_cores: 8 })).toThrow();
    expect(publicationActive(model, pub)).toBe(true);
    expect(
      (await post(owner, path + '/revoke', { reason: 'End isolated publication test' })).status,
    ).toBe(204);
    expect((await reader.get('/api/ml/model-catalog')).body.data.shared).toEqual([]);
    expect(
      publicationActive(model, await db.sharedModelPublication.findUnique({ where: { modelId } })),
    ).toBe(false);
    expect(await db.sharedModelPublicationEvent.count({ where: { modelId } })).toBe(2);
    expect((await owner.get(`/api/ml/models/${modelId}`)).status).toBe(200);
  } finally {
    if (original === undefined) delete process.env.MODEL_PUBLICATION_ADMIN_IDS;
    else process.env.MODEL_PUBLICATION_ADMIN_IDS = original;
    await db.sharedModelPublicationEvent.deleteMany({ where: { modelId } });
    await db.sharedModelPublication.deleteMany({ where: { modelId } });
    await db.user.deleteMany({ where: { email: { in: emails } } });
    await db.$disconnect();
  }
}, 30000);
