import 'dotenv/config';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, dirname, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import {
  blankWorkload,
  emptyCapabilities,
  modelResponseSchema,
  predictionResponseSchema,
} from '@corewise/types';
import { createApp } from '../src/app.js';
import { db } from '../src/lib/db.js';
import { Prisma } from '@prisma/client';

const python = resolve(
  'backend/ml/.venv',
  process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
);
const app = createApp(),
  owner = request.agent(app),
  other = request.agent(app);
const emails: string[] = [];
let service: ReturnType<typeof spawn> | undefined, artifactRoot: string;
let datasetId: string,
  jobId: string,
  hardwareId: string,
  workloadId: string,
  modelIds: string[],
  predictionId: string;
async function csrf(agent = owner) {
  return (await agent.get('/api/auth/csrf')).body.data.token as string;
}
async function signup(agent: typeof owner) {
  const email = `m3-test-${randomUUID()}@example.invalid`;
  emails.push(email);
  const token = await csrf(agent);
  const r = await agent
    .post('/api/auth/register')
    .set('x-csrf-token', token)
    .send({ email, name: 'M3 Test Engineer', password: 'M3 test passphrase with spaces' });
  expect(r.status).toBe(201);
}
async function worker(id: string) {
  await promisify(execFile)(
    python,
    ['-c', 'import os; from corewise_ml.worker import run_once; run_once(os.environ["ML_JOB_ID"])'],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PYTHONPATH: resolve('backend/ml'),
        ML_ARTIFACT_ROOT: artifactRoot,
        ML_JOB_ID: id,
      },
      timeout: 120000,
    },
  );
}
beforeAll(async () => {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw Error('Port allocation failed');
  const port = address.port;
  await new Promise<void>((r) => server.close(() => r()));
  artifactRoot = await mkdtemp(join(tmpdir(), 'corewise-m3-owned-'));
  process.env.ML_INTERNAL_TOKEN = randomUUID() + randomUUID();
  process.env.ML_ORIGIN = `http://127.0.0.1:${port}`;
  service = spawn(
    python,
    ['-m', 'uvicorn', 'corewise_ml.app:app', '--host', '127.0.0.1', '--port', String(port)],
    {
      env: { ...process.env, PYTHONPATH: resolve('backend/ml'), ML_ARTIFACT_ROOT: artifactRoot },
      stdio: 'ignore',
    },
  );
  let ready = false;
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(`${process.env.ML_ORIGIN}/health`, {
        headers: { Authorization: `Bearer ${process.env.ML_INTERNAL_TOKEN}` },
      });
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  expect(ready).toBe(true);
  await signup(owner);
  await signup(other);
}, 60000);
afterAll(async () => {
  service?.kill();
  if (service && service.exitCode === null) await once(service, 'exit');
  await db.user.deleteMany({ where: { email: { in: emails } } });
  await db.$disconnect();
  // Only the exact temporary directory created by this fixture is removed.
  if (artifactRoot) {
    if (
      dirname(resolve(artifactRoot)) !== resolve(tmpdir()) ||
      !basename(artifactRoot).startsWith('corewise-m3-owned-')
    )
      throw new Error('Refusing to remove an unexpected artifact directory');
    await rm(artifactRoot, { recursive: true, force: true });
  }
});
describe('M3 real service, PostgreSQL queue, trained artifacts and inference', () => {
  it('requires session and CSRF on all personal ML APIs', async () => {
    for (const path of ['datasets', 'training-jobs', 'models', 'predictions', 'dataset-schema'])
      expect((await request(app).get(`/api/ml/${path}`)).status).toBe(401);
    expect((await owner.post('/api/ml/datasets').send({})).status).toBe(403);
  });
  it('generates and persists a labeled immutable dataset and preview', async () => {
    const r = await owner
      .post('/api/ml/datasets')
      .set('x-csrf-token', await csrf())
      .send({ name: 'M3 test synthetic', mode: 'SYNTHETIC', count: 240, seed: 42 });
    expect(r.status, r.text).toBe(201);
    datasetId = r.body.data.id;
    expect(r.body.data.provenance).toBe('SYNTHETIC_DEMO');
    expect(r.body.data.preview).toHaveLength(8);
    expect(r.body.data.rows).toBeUndefined();
    expect(r.body.data.userId).toBeUndefined();
    expect((await owner.get(`/api/ml/datasets/${datasetId}`)).status).toBe(200);
    expect((await other.get(`/api/ml/datasets/${datasetId}`)).status).toBe(404);
  });
  it('rejects invalid/missing-target CSV and oversized uploads', async () => {
    const r = await owner
      .post('/api/ml/datasets')
      .set('x-csrf-token', await csrf())
      .send({ name: 'Bad csv', mode: 'CSV', csv: 'workload_type,cpu_time_ms\nvector,0' });
    expect(r.status).toBe(422);
    expect(r.body.error.message).toContain('Missing required');
    expect(
      (
        await owner
          .post('/api/ml/datasets')
          .set('x-csrf-token', await csrf())
          .send({ name: 'Bad csv', mode: 'CSV', csv: 'x'.repeat(2_300_000) })
      ).status,
    ).toBe(413);
    expect(
      (
        await owner
          .post('/api/ml/datasets')
          .set('x-csrf-token', await csrf())
          .send({ name: 'Forged', mode: 'SYNTHETIC', userId: 'other' })
      ).status,
    ).toBe(400);
  });
  it('queues asynchronously and prevents conflicting/foreign training jobs', async () => {
    const r = await owner
      .post('/api/ml/training-jobs')
      .set('x-csrf-token', await csrf())
      .send({ datasetId });
    expect(r.status, r.text).toBe(202);
    jobId = r.body.data.id;
    expect(r.body.data.status).toBe('QUEUED');
    expect(
      (
        await owner
          .post('/api/ml/training-jobs')
          .set('x-csrf-token', await csrf())
          .send({ datasetId })
      ).status,
    ).toBe(409);
    expect(
      (
        await other
          .post('/api/ml/training-jobs')
          .set('x-csrf-token', await csrf(other))
          .send({ datasetId })
      ).status,
    ).toBe(404);
    expect((await other.get(`/api/ml/training-jobs/${jobId}`)).status).toBe(404);
  });
  it('fits all three CPU/GPU algorithms in the dedicated worker and persists metrics', async () => {
    await worker(jobId);
    const r = await owner.get(`/api/ml/training-jobs/${jobId}`);
    expect(r.body.data.status, r.text).toBe('COMPLETED');
    modelIds = r.body.data.modelIds;
    expect(modelIds).toHaveLength(6);
    expect(await readdir(artifactRoot)).toHaveLength(6);
    const models = (await owner.get('/api/ml/models')).body.data;
    expect(models.filter((m: { selected: boolean }) => m.selected)).toHaveLength(2);
    for (const m of models) {
      expect(m.active).toBe(false);
      expect(m.evaluation.provenance).toBe('SYNTHETIC_DEMO');
      expect(m.evaluation.test.rmseMs).toBeGreaterThanOrEqual(0);
      expect(m.sha256).toBeUndefined();
      expect(m.artifactLocation).toBeUndefined();
      modelResponseSchema.parse({ data: m });
    }
  }, 120000);
  it('enforces registry ownership, activates a single target version and deactivates', async () => {
    const models = (await owner.get('/api/ml/models')).body.data;
    for (const m of models.filter((m: { selected: boolean }) => m.selected))
      expect(
        (
          await owner
            .post(`/api/ml/models/${m.id}/activate`)
            .set('x-csrf-token', await csrf())
            .send({ active: true })
        ).status,
      ).toBe(200);
    expect((await other.get(`/api/ml/models/${modelIds[0]}`)).status).toBe(404);
    expect(
      (
        await other
          .post(`/api/ml/models/${modelIds[0]}/activate`)
          .set('x-csrf-token', await csrf(other))
          .send({ active: true })
      ).status,
    ).toBe(404);
    const cpu = models.find((m: { target: string }) => m.target === 'CPU');
    await owner
      .post(`/api/ml/models/${cpu.id}/activate`)
      .set('x-csrf-token', await csrf())
      .send({ active: true });
    expect(
      (await owner.get('/api/ml/models')).body.data.filter(
        (m: { target: string; active: boolean }) => m.target === 'CPU' && m.active,
      ),
    ).toHaveLength(1);
    await owner
      .post(`/api/ml/models/${cpu.id}/activate`)
      .set('x-csrf-token', await csrf())
      .send({ active: false });
    await owner
      .post(`/api/ml/models/${cpu.id}/activate`)
      .set('x-csrf-token', await csrf())
      .send({ active: true });
  });
  it('predicts from trusted fitted pipelines, reports versions and persists snapshots', async () => {
    const h = await owner
      .post('/api/hardware-profiles')
      .set('x-csrf-token', await csrf())
      .send({
        name: 'M3 input profile',
        manufacturer: '',
        deviceModel: '',
        description: '',
        os: 'Test',
        cpuManufacturer: 'Test vendor',
        cpuName: 'Test CPU',
        physicalCores: 8,
        logicalProcessors: 16,
        cpuBaseGhz: 3,
        cpuMaxGhz: 4,
        gpuManufacturer: '',
        gpuName: 'Test GPU',
        vramGb: 16,
        memoryBandwidthGbps: 600,
        computeCapability: null,
        ramGb: 32,
        memoryType: '',
        memoryFrequencyMhz: null,
      });
    expect(h.status, h.text).toBe(201);
    hardwareId = h.body.data.id;
    const assumptions = {
      ...emptyCapabilities,
      cpuCores: 8,
      cpuPeakGflops: 300,
      cpuBandwidthGbps: 80,
      gpuPeakGflops: 5000,
      gpuBandwidthGbps: 600,
      transferBandwidthGbps: 16,
      kernelLaunchUs: 10,
    };
    const w = await owner
      .post('/api/workloads')
      .set('x-csrf-token', await csrf())
      .send({
        ...blankWorkload,
        name: 'ML matrix workload',
        category: 'MATRIX_MULTIPLICATION',
        inputSize: 1024,
        operationCount: 1e9,
        arithmeticIntensity: 20,
        parallelFraction: 0.95,
        memoryMiB: 12,
        transferMiB: 12,
        repetitions: 2,
        hardwareProfileId: hardwareId,
        assumptions,
      });
    expect(w.status).toBe(201);
    workloadId = w.body.data.id;
    const input = { workloadId, hardwareProfileId: hardwareId, assumptions };
    const p = await owner
      .post('/api/ml/predict')
      .set('x-csrf-token', await csrf())
      .send(input);
    expect(p.status, p.text).toBe(201);
    const result = predictionResponseSchema.parse(p.body).data;
    predictionId = result.id;
    expect(result.result.speedup).toBeCloseTo(result.result.cpuTimeMs / result.result.gpuTimeMs);
    expect(result.result.models.CPU.version).toBeTruthy();
    expect(result.result.models.GPU.datasetProvenance).toBe('SYNTHETIC_DEMO');
    expect(result.result.provenance).toBe('PREDICTED');
    const second = await owner
      .post('/api/ml/predict')
      .set('x-csrf-token', await csrf())
      .send(input);
    expect(second.body.data.result.cpuTimeMs).toBe(result.result.cpuTimeMs);
    expect((await other.get(`/api/ml/predictions/${predictionId}`)).status).toBe(404);
    expect(
      (
        await other
          .post('/api/ml/predict')
          .set('x-csrf-token', await csrf(other))
          .send(input)
      ).status,
    ).toBe(404);
    expect(
      (
        await owner
          .post('/api/ml/predict')
          .set('x-csrf-token', await csrf())
          .send({ ...input, assumptions: { ...assumptions, cpuPeakGflops: null } })
      ).status,
    ).toBe(422);
  });
  it('returns model-unavailable without fallback and preserves immutable prediction history', async () => {
    const models = (await owner.get('/api/ml/models')).body.data;
    for (const m of models.filter((m: { active: boolean }) => m.active))
      await owner
        .post(`/api/ml/models/${m.id}/activate`)
        .set('x-csrf-token', await csrf())
        .send({ active: false });
    const w = await db.workload.findUniqueOrThrow({ where: { id: workloadId } });
    const r = await owner
      .post('/api/ml/predict')
      .set('x-csrf-token', await csrf())
      .send({ workloadId, hardwareProfileId: hardwareId, assumptions: w.assumptions });
    expect(r.status, r.text).toBe(409);
    expect(r.body.error.code).toBe('MODEL_UNAVAILABLE');
    await owner.delete(`/api/workloads/${workloadId}`).set('x-csrf-token', await csrf());
    expect(
      (await owner.get(`/api/ml/predictions/${predictionId}`)).body.data.workloadSnapshot.name,
    ).toBe('ML matrix workload');
  });
  it('records failed jobs and expired leases without registering incomplete models', async () => {
    const d = await db.dataset.findUniqueOrThrow({ where: { id: datasetId } });
    const rows = d.rows as Record<string, unknown>[];
    const failedDataset = await db.dataset.create({
      data: {
        userId: d.userId,
        name: 'Insufficient test groups',
        version: d.version,
        schemaVersion: d.schemaVersion,
        provenance: d.provenance,
        rowCount: d.rowCount,
        validation: {},
        rows: rows.map((r) => ({ ...r, hardware_id: 'one' })) as Prisma.InputJsonValue,
      },
    });
    const response = await owner
      .post('/api/ml/training-jobs')
      .set('x-csrf-token', await csrf())
      .send({ datasetId: failedDataset.id, group_by: 'HARDWARE' });
    expect(response.status).toBe(202);
    await worker(response.body.data.id);
    const failed = (await owner.get(`/api/ml/training-jobs/${response.body.data.id}`)).body.data;
    expect(failed.status).toBe('FAILED');
    expect(failed.error).toContain('6 distinct groups');
    expect(failed.modelIds).toHaveLength(0);
    const expired = await db.trainingJob.create({
      data: { userId: d.userId, datasetId, status: 'RUNNING', config: {}, leaseUntil: new Date(0) },
    });
    await worker(expired.id);
    expect((await db.trainingJob.findUniqueOrThrow({ where: { id: expired.id } })).status).toBe(
      'FAILED',
    );
  }, 120000);
});
