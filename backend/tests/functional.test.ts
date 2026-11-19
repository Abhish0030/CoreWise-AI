import 'dotenv/config';
import { beforeAll, afterAll, it, expect } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import {
  blankWorkload,
  emptyCapabilities,
  hardwareResponseSchema,
  optimizationResponseSchema,
  benchmarkMeasurementSchema,
  workloadInputSchema,
} from '@corewise/types';
import { createApp } from '../src/app.js';
import { db } from '../src/lib/db.js';
import { optimizationGrid, compatibleMeasurement } from '../src/modules/functional/optimization.js';
import { executeTool } from '../src/modules/assistant/tools.js';
const app = createApp(),
  owner = request.agent(app),
  other = request.agent(app),
  runner = request.agent(app);
const emails: string[] = [];
let agentId: string, profileId: string, workloadId: string;
let measurement: ReturnType<typeof benchmarkMeasurementSchema.parse>;
async function post(a: typeof owner, path: string, data: object = {}) {
  const token = (await a.get('/api/auth/csrf')).body.data.token;
  return a.post(path).set('x-csrf-token', token).send(data);
}
beforeAll(async () => {
  for (const a of [owner, other]) {
    const email = `functional-test-${randomUUID()}@example.invalid`;
    emails.push(email);
    expect(
      (
        await post(a, '/api/auth/register', {
          name: 'Functional Test Engineer',
          email,
          password: 'functional test passphrase2026',
        })
      ).status,
    ).toBe(201);
  }
  const python = resolve(
    'backend/local-agent/.venv',
    process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
  );
  const r = await promisify(execFile)(
    python,
    [
      '-m',
      'corewise_runner',
      'local',
      '--execute',
      '--workload',
      'VECTOR_ADDITION',
      '--size',
      '4096',
      '--repetitions',
      '3',
    ],
    {
      env: { ...process.env, PYTHONPATH: resolve('backend/local-agent') },
      timeout: 60000,
      maxBuffer: 1024 * 1024,
    },
  );
  const value = JSON.parse(r.stdout);
  expect(value.status).toBe('COMPLETED');
  measurement = benchmarkMeasurementSchema.parse(value.measurement);
  const pair = (await post(owner, '/api/benchmarks/pairing')).body.data.code;
  const redeemed = await post(runner, '/api/agent/redeem', {
    code: pair,
    name: 'Functional exact fixture runner',
    environment: measurement.environment,
  });
  expect(redeemed.status).toBe(201);
  agentId = redeemed.body.data.agentId;
  const session = await post(runner, '/api/agent/session');
  expect(session.status).toBe(401);
  const token = (await runner.get('/api/auth/csrf')).body.data.token;
  expect(
    (
      await runner
        .post('/api/agent/session')
        .set('x-csrf-token', token)
        .set('Authorization', `Bearer ${redeemed.body.data.token}`)
        .send({})
    ).status,
  ).toBe(200);
}, 90000);
afterAll(async () => {
  await db.user.deleteMany({ where: { email: { in: emails } } });
  await db.$disconnect();
});
it('authenticates connection/import/optimization and retains runner isolation', async () => {
  expect((await request(app).get('/api/hardware/connection')).status).toBe(401);
  expect((await runner.get('/api/hardware/connection')).status).toBe(401);
  expect((await runner.get('/api/hardware-profiles')).status).toBe(401);
  expect(
    (await owner.post('/api/hardware/import-hardware').send({ agentId, name: 'Blocked' })).status,
  ).toBe(403);
  expect(
    (await post(other, '/api/hardware/import-hardware', { agentId, name: 'Not owned' })).status,
  ).toBe(404);
});
it('imports only detected fields and selects a fractional-capacity profile', async () => {
  const r = await post(owner, '/api/hardware/import-hardware', {
    agentId,
    name: 'Detected fixture hardware',
  });
  expect(r.status, r.text).toBe(201);
  const h = hardwareResponseSchema.parse(r.body).data;
  profileId = h.id;
  expect(h.provenance).toBe('MEASURED');
  expect(h.ramGb).toBe(measurement.environment.totalRamBytes / 2 ** 30);
  expect(h.cpuBaseGhz).toBeNull();
  expect(h.memoryBandwidthGbps).toBeNull();
  const u = (await owner.get('/api/auth/me')).body.data;
  expect(u.selectedProfileId).toBe(h.id);
  expect(u.defaultProfileId).toBe(h.id);
  expect(
    (
      await post(owner, '/api/hardware/import-hardware', {
        agentId,
        name: 'Forged',
        provenance: 'MEASURED',
      })
    ).status,
  ).toBe(400);
});
const sample = () => ({
  version: 'cw-telemetry-1',
  provenance: 'MEASURED',
  capturedAt: new Date().toISOString(),
  cpuUtilizationPercent: 10,
  ramUsedBytes: 512,
  ramTotalBytes: 1024,
  cpuTemperatureC: null,
  gpu: null,
  cpuSource: 'psutil',
  temperatureSource: null,
  limitations: ['Controlled unit telemetry fixture; not a physical-device claim'],
});
it('accepts session-bound bounded telemetry, withholds stale values and rejects old samples', async () => {
  expect((await runner.post('/api/agent/telemetry').send(sample())).status).toBe(403);
  expect((await post(owner, '/api/agent/telemetry', sample())).status).toBe(401);
  expect((await post(runner, '/api/agent/telemetry', sample())).status).toBe(200);
  let c = (await owner.get('/api/hardware/connection')).body.data;
  expect(c.agents[0].status).toBe('FRESH');
  expect(c.agents[0].telemetry.cpuTemperatureC).toBeNull();
  const user = (await owner.get('/api/auth/me')).body.data;
  const tool = await executeTool(user.id, 'get_hardware_connection', {}, {});
  expect(tool.data).toMatchObject({ agents: [{ status: 'FRESH' }] });
  await db.localAgent.update({
    where: { id: agentId },
    data: { telemetryReceivedAt: new Date(Date.now() - 20000) },
  });
  c = (await owner.get('/api/hardware/connection')).body.data;
  expect(c.agents[0].status).toBe('STALE');
  expect(c.agents[0].telemetry).toBeNull();
  const stale = await executeTool(user.id, 'get_hardware_connection', {}, {});
  expect(stale.data).toMatchObject({ agents: [{ status: 'STALE', telemetry: null }] });
  expect(
    (
      await post(runner, '/api/agent/telemetry', {
        ...sample(),
        capturedAt: new Date(Date.now() - 60000).toISOString(),
      })
    ).status,
  ).toBe(400);
  expect(
    (await post(runner, '/api/agent/telemetry', { ...sample(), cpuUtilizationPercent: 101 }))
      .status,
  ).toBe(400);
  expect((await other.get('/api/hardware/connection')).body.data.agents).toHaveLength(0);
});
it('reports missing model readiness and calculates a sourced analytical recommendation', async () => {
  const n = measurement.config.size,
    footprint = (n * 12) / 2 ** 20;
  const w = {
    ...blankWorkload,
    name: 'Exact fixture vector',
    category: 'VECTOR_ADDITION',
    inputSize: n,
    inputUnit: 'ELEMENTS',
    operationCount: n,
    arithmeticIntensity: 1 / 12,
    parallelFraction: 1,
    memoryMiB: footprint,
    transferMiB: footprint,
    repetitions: 1,
    hardwareProfileId: profileId,
    assumptions: {
      ...emptyCapabilities,
      cpuPeakGflops: 100,
      cpuBandwidthGbps: 50,
      gpuPeakGflops: 1000,
      gpuBandwidthGbps: 100,
      transferBandwidthGbps: 10,
      kernelLaunchUs: 10,
    },
  };
  const saved = await post(owner, '/api/workloads', w);
  expect(saved.status, saved.text).toBe(201);
  workloadId = saved.body.data.id;
  const r = await post(owner, '/api/optimization/run', {
    workloadId,
    hardwareProfileId: profileId,
  });
  expect(r.status, r.text).toBe(200);
  const d = optimizationResponseSchema.parse(r.body).data;
  expect(d.readiness.ml.ready).toBe(false);
  expect(d.readiness.ml.reasons.join(' ')).toContain('No active');
  expect(d.recommendation.basis).toBe('ANALYTICAL');
  expect(d.references.comparisonId).toBeTruthy();
  expect(d.crossover.points).toHaveLength(6);
  expect(
    (await post(other, '/api/optimization/preview', { workloadId, hardwareProfileId: profileId }))
      .status,
  ).toBe(404);
  expect(
    (
      await post(owner, '/api/optimization/run', {
        workloadId,
        hardwareProfileId: profileId,
        benchmarkId: randomUUID(),
      })
    ).status,
  ).toBe(404);
});
it('compares actual compatible measurements and rejects altered execution semantics', async () => {
  const job = await post(owner, '/api/benchmarks/jobs', { agentId, config: measurement.config });
  expect(job.status, job.text).toBe(201);
  expect((await post(runner, '/api/agent/claim')).status).toBe(200);
  const result = await post(runner, `/api/agent/jobs/${job.body.data.id}/result`, {
    status: 'COMPLETED',
    measurement,
  });
  expect(result.status, result.text).toBe(201);
  const rows = (await owner.get('/api/benchmarks/runs')).body.data;
  expect(rows).toHaveLength(1);
  const r = await post(owner, '/api/optimization/preview', {
    workloadId,
    hardwareProfileId: profileId,
    benchmarkId: rows[0].id,
  });
  expect(r.status, r.text).toBe(200);
  const d = optimizationResponseSchema.parse(r.body).data;
  if (measurement.gpu) {
    expect(d.recommendation.basis).toBe('MEASURED');
    expect(d.comparison?.compatible).toBe(true);
  } else expect(d.recommendation.validated).toBe(false);
  const h = hardwareResponseSchema.parse(
    (await owner.get(`/api/hardware-profiles/${profileId}`)).body,
  ).data;
  const w = (await owner.get(`/api/workloads/${workloadId}`)).body.data;
  expect(
    compatibleMeasurement(w, h, {
      ...measurement,
      config: { ...measurement.config, scope: 'COMPUTE_ONLY' },
    }),
  ).toBe(false);
  expect(compatibleMeasurement({ ...w, memoryMiB: w.memoryMiB * 2 }, h, measurement)).toBe(false);
  const grid = optimizationGrid(
    workloadInputSchema.strip().parse(w),
    h,
    w.assumptions,
    [16, 4096, 1000000],
  );
  expect(grid.points).toHaveLength(3);
  expect(grid.methodology).toContain('not exact measured');
});
it('keeps unsupported/custom scaling explicit and fails missing capabilities without invented times', async () => {
  const h = hardwareResponseSchema.parse(
    (await owner.get(`/api/hardware-profiles/${profileId}`)).body,
  ).data;
  const w = (await owner.get(`/api/workloads/${workloadId}`)).body.data;
  expect(
    optimizationGrid({ ...w, category: 'CUSTOM' }, h, w.assumptions, [100]).points[0]
      ?.recommendation,
  ).toBe('UNSUPPORTED');
  const t = (await owner.get('/api/auth/csrf')).body.data.token;
  expect(
    (
      await owner
        .patch(`/api/workloads/${workloadId}`)
        .set('x-csrf-token', t)
        .send({
          assumptions: emptyCapabilities,
          inputSize: 8192,
          operationCount: 8192,
          memoryMiB: (8192 * 12) / 2 ** 20,
          transferMiB: (8192 * 12) / 2 ** 20,
        })
    ).status,
  ).toBe(200);
  const d = optimizationResponseSchema.parse(
    (await post(owner, '/api/optimization/preview', { workloadId, hardwareProfileId: profileId }))
      .body,
  ).data;
  expect(d.recommendation.recommendation).toBe('INSUFFICIENT_DATA');
  expect(d.readiness.analytical.missing.length).toBeGreaterThan(0);
});
it('rejects incorrect stored prediction model versions before trusting their times', async () => {
  const user = await db.user.findUniqueOrThrow({ where: { email: emails[0]! } });
  const w = (await owner.get(`/api/workloads/${workloadId}`)).body.data;
  const h = (await owner.get(`/api/hardware-profiles/${profileId}`)).body.data;
  const dataset = await db.dataset.create({
    data: {
      userId: user.id,
      name: 'Registry fault fixture',
      version: 'fixture',
      schemaVersion: 'cw-features-1',
      provenance: 'SYNTHETIC_DEMO',
      rowCount: 60,
      rows: [],
      validation: {},
    },
  });
  const job = await db.trainingJob.create({
    data: { userId: user.id, datasetId: dataset.id, status: 'COMPLETED', config: {} },
  });
  const id = randomUUID();
  await db.mLModel.create({
    data: {
      id,
      userId: user.id,
      datasetId: dataset.id,
      trainingJobId: job.id,
      name: 'Invalid registry guard fixture',
      algorithm: 'LINEAR',
      target: 'CPU',
      version: id,
      schemaVersion: 'cw-features-1',
      provenance: 'SYNTHETIC_DEMO',
      active: false,
      selected: false,
      sha256: '0'.repeat(64),
      artifactLocation: 'never-loaded-test-fixture',
      featureSchema: {},
      evaluation: {},
      trainingConfig: {},
    },
  });
  const ref = {
    id,
    version: 'wrong-version',
    algorithm: 'LINEAR',
    datasetId: dataset.id,
    datasetProvenance: 'SYNTHETIC_DEMO',
    schemaVersion: 'cw-features-1',
  };
  const p = await db.mLPrediction.create({
    data: {
      userId: user.id,
      workloadId,
      hardwareProfileId: profileId,
      workloadSnapshot: w,
      hardwareSnapshot: h,
      features: {},
      result: {
        cpuTimeMs: 1,
        gpuTimeMs: 1,
        speedup: 1,
        models: { CPU: ref, GPU: ref },
        provenance: 'PREDICTED',
        readiness: 'READY',
        warnings: [],
        label: 'Deliberately invalid unit-test registry fixture; not a trained model',
      },
    },
  });
  expect(
    (
      await post(owner, '/api/optimization/preview', {
        workloadId,
        hardwareProfileId: profileId,
        predictionId: p.id,
      })
    ).status,
  ).toBe(409);
});
it('finds an analytical crossover bracket without presenting it as a measured threshold', async () => {
  const h = hardwareResponseSchema.parse(
    (await owner.get(`/api/hardware-profiles/${profileId}`)).body,
  ).data;
  const n = 4096,
    w = workloadInputSchema.parse({
      ...blankWorkload,
      name: 'Crossover unit fixture',
      category: 'VECTOR_ADDITION',
      inputSize: n,
      inputUnit: 'ELEMENTS',
      operationCount: n,
      arithmeticIntensity: 1 / 12,
      parallelFraction: 1,
      memoryMiB: (n * 12) / 2 ** 20,
      transferMiB: (n * 12) / 2 ** 20,
      repetitions: 1,
      hardwareProfileId: profileId,
      assumptions: {
        ...emptyCapabilities,
        cpuPeakGflops: 100,
        cpuBandwidthGbps: 50,
        gpuPeakGflops: 1000,
        gpuBandwidthGbps: 100,
        transferBandwidthGbps: 1000,
        kernelLaunchUs: 100,
      },
    });
  const grid = optimizationGrid(w, h, w.assumptions, [16, 100000, 10000000]);
  expect(grid.brackets.length).toBeGreaterThan(0);
  expect(grid.brackets[0]?.provenance).toBe('ANALYTICAL');
  expect(grid.points[0]?.recommendation).toBe('CPU');
  const unsupported = optimizationGrid(
    { ...w, category: 'REDUCTION', inputSize: 1 },
    h,
    w.assumptions,
    [16],
  );
  expect(unsupported.points[0]?.recommendation).toBe('UNSUPPORTED');
});
it('manual edits reset detected provenance and telemetry association', async () => {
  const h = (await owner.get(`/api/hardware-profiles/${profileId}`)).body.data;
  const { hardwareInputSchema } = await import('@corewise/types');
  const input = hardwareInputSchema.strip().parse(h);
  const t = (await owner.get('/api/auth/csrf')).body.data.token;
  const r = await owner
    .put(`/api/hardware-profiles/${profileId}`)
    .set('x-csrf-token', t)
    .send(input);
  expect(r.status, r.text).toBe(200);
  expect(r.body.data.provenance).toBe('USER_ENTERED');
  expect(r.body.data.detectionSnapshot).toBeNull();
});
