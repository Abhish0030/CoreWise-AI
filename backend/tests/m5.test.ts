import 'dotenv/config';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, dirname, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeAll, afterAll, it, expect } from 'vitest';
import {
  blankWorkload,
  emptyCapabilities,
  explanationResponseSchema,
  explanationResultSchema,
} from '@corewise/types';
import { createApp } from '../src/app.js';
import { db } from '../src/lib/db.js';
import { executeTool } from '../src/modules/assistant/tools.js';
const app = createApp(),
  owner = request.agent(app),
  other = request.agent(app),
  emails: string[] = [];
const python = resolve(
  'backend/ml/.venv',
  process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
);
let service: ReturnType<typeof spawn> | undefined,
  root: string,
  predictionId: string,
  cpuId: string,
  gpuId: string,
  localId: string,
  globalId: string;
async function csrf(a = owner) {
  const r = await a.get('/api/auth/csrf');
  expect(r.status, r.text).toBe(200);
  return r.body.data.token as string;
}
async function write(a: typeof owner, path: string, data: object) {
  const token = await csrf(a);
  return a.post(path).set('x-csrf-token', token).send(data);
}
async function signup(a: typeof owner) {
  const email = `m5-test-${randomUUID()}@example.invalid`;
  emails.push(email);
  expect(
    (
      await write(a, '/api/auth/register', {
        email,
        name: 'M5 Test Engineer',
        password: 'M5 integration passphrase 2026',
      })
    ).status,
  ).toBe(201);
}
async function worker(module: string, jobId: string) {
  await promisify(execFile)(
    python,
    [
      '-c',
      `import os; from corewise_ml.${module} import run_once; run_once(os.environ["ML_JOB_ID"])`,
    ],
    {
      env: {
        ...process.env,
        PYTHONPATH: resolve('backend/ml'),
        ML_ARTIFACT_ROOT: root,
        ML_JOB_ID: jobId,
      },
      timeout: 120000,
      maxBuffer: 2e6,
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
  root = await mkdtemp(join(tmpdir(), 'corewise-m5-owned-'));
  process.env.ML_INTERNAL_TOKEN = randomUUID() + randomUUID();
  process.env.ML_ORIGIN = `http://127.0.0.1:${port}`;
  service = spawn(
    python,
    ['-m', 'uvicorn', 'corewise_ml.app:app', '--host', '127.0.0.1', '--port', String(port)],
    {
      env: { ...process.env, PYTHONPATH: resolve('backend/ml'), ML_ARTIFACT_ROOT: root },
      stdio: 'ignore',
    },
  );
  let ready = false;
  for (let i = 0; i < 160; i++) {
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
  const d = await write(owner, '/api/ml/datasets', {
    name: 'M5 synthetic fixture',
    mode: 'SYNTHETIC',
    count: 120,
    seed: 42,
  });
  expect(d.status, d.text).toBe(201);
  const job = await write(owner, '/api/ml/training-jobs', { datasetId: d.body.data.id });
  await worker('worker', job.body.data.id);
  const models = (await owner.get('/api/ml/models')).body.data;
  cpuId = models.find(
    (m: { target: string; algorithm: string }) =>
      m.target === 'CPU' && m.algorithm === 'RANDOM_FOREST',
  ).id;
  gpuId = models.find(
    (m: { target: string; algorithm: string }) => m.target === 'GPU' && m.algorithm === 'XGBOOST',
  ).id;
  for (const id of [cpuId, gpuId])
    expect((await write(owner, `/api/ml/models/${id}/activate`, { active: true })).status).toBe(
      200,
    );
  const h = await write(owner, '/api/hardware-profiles', {
    name: 'M5 input system',
    manufacturer: '',
    deviceModel: '',
    description: '',
    os: 'Test OS',
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
  const w = await write(owner, '/api/workloads', {
    ...blankWorkload,
    name: 'Saved SHAP workload',
    category: 'MATRIX_MULTIPLICATION',
    inputSize: 1024,
    operationCount: 1e9,
    arithmeticIntensity: 20,
    parallelFraction: 0.95,
    memoryMiB: 12,
    transferMiB: 12,
    repetitions: 3,
    hardwareProfileId: h.body.data.id,
    assumptions,
  });
  expect(w.status, w.text).toBe(201);
  const p = await write(owner, '/api/ml/predict', {
    workloadId: w.body.data.id,
    hardwareProfileId: h.body.data.id,
    assumptions,
  });
  expect(p.status, p.text).toBe(201);
  predictionId = p.body.data.id;
  expect(p.body.data.result.models.CPU.artifactSha256).toHaveLength(64);
}, 120000);
afterAll(async () => {
  service?.kill();
  if (service && service.exitCode === null) await once(service, 'exit');
  await db.user.deleteMany({ where: { email: { in: emails } } });
  await db.$disconnect();
  if (root) {
    if (
      dirname(resolve(root)) !== resolve(tmpdir()) ||
      !basename(root).startsWith('corewise-m5-owned-')
    )
      throw Error('Unexpected fixture directory');
    await rm(root, { recursive: true, force: true });
  }
});
it('requires user authentication, CSRF and strict bounded explanation requests', async () => {
  expect((await request(app).get('/api/explanations')).status).toBe(401);
  expect((await owner.post('/api/explanations').send({ kind: 'LOCAL', predictionId })).status).toBe(
    403,
  );
  expect(
    (await write(owner, '/api/explanations', { kind: 'LOCAL', predictionId, userId: 'foreign' }))
      .status,
  ).toBe(400);
  expect(
    (
      await write(owner, '/api/explanations', {
        kind: 'GLOBAL',
        modelId: cpuId,
        backgroundLimit: 1000,
      })
    ).status,
  ).toBe(400);
});
it('enforces prediction and model ownership on every explanation boundary', async () => {
  for (const path of [`prediction/${predictionId}`, `global/${cpuId}`])
    expect((await other.get(`/api/explanations/${path}`)).status).toBe(404);
  expect((await write(other, '/api/explanations', { kind: 'LOCAL', predictionId })).status).toBe(
    404,
  );
  expect((await write(other, '/api/explanations', { kind: 'GLOBAL', modelId: cpuId })).status).toBe(
    404,
  );
});
it('queues real local SHAP jobs, reuses identical requests and preserves exact inactive model versions', async () => {
  for (const id of [cpuId, gpuId])
    await write(owner, `/api/ml/models/${id}/activate`, { active: false });
  const r = await write(owner, '/api/explanations', {
    kind: 'LOCAL',
    predictionId,
    backgroundLimit: 16,
  });
  expect(r.status, r.text).toBe(202);
  localId = r.body.data.id;
  expect(r.body.data.status).toBe('QUEUED');
  const duplicate = await write(owner, '/api/explanations', {
    kind: 'LOCAL',
    predictionId,
    backgroundLimit: 16,
  });
  expect(duplicate.body.data.id).toBe(localId);
  await worker('explanation_worker', localId);
  const complete = await owner.get(`/api/explanations/${localId}`);
  expect(complete.status, complete.text).toBe(200);
  const record = explanationResponseSchema.parse(complete.body).data;
  expect(record.status, complete.text).toBe('COMPLETED');
  const result = explanationResultSchema.parse(record.result);
  expect(result.kind).toBe('LOCAL');
  if (result.kind !== 'LOCAL') throw Error('Unexpected result');
  for (const target of ['CPU', 'GPU'] as const) {
    const d = result.models[target];
    expect(d.model.modelId).toBe(target === 'CPU' ? cpuId : gpuId);
    expect(d.outputSpace).toBe('LOG_TIME_MS');
    expect(d.additivity.passed).toBe(true);
    expect(d.repetitions).toBe(3);
    expect(d.predictionArtifactBinding).toBe('SNAPSHOTTED_HASH');
    expect(
      Math.abs(
        d.baselineOutput + d.contributions.reduce((sum, c) => sum + c.value, 0) - d.finalOutput,
      ),
    ).toBeLessThanOrEqual(d.additivity.tolerance);
  }
  expect(
    (await write(owner, '/api/explanations', { kind: 'LOCAL', predictionId, backgroundLimit: 16 }))
      .status,
  ).toBe(200);
  expect((await other.get(`/api/explanations/${localId}`)).status).toBe(404);
  expect((await other.get('/api/explanations')).body.data).toHaveLength(0);
  expect((await owner.get(`/api/explanations/prediction/${predictionId}`)).body.data[0].id).toBe(
    localId,
  );
}, 120000);
it('computes global importance on held-out rows with deterministic training-only backgrounds', async () => {
  const r = await write(owner, '/api/explanations', {
    kind: 'GLOBAL',
    modelId: cpuId,
    backgroundLimit: 16,
    sampleLimit: 8,
  });
  expect(r.status, r.text).toBe(202);
  globalId = r.body.data.id;
  await worker('explanation_worker', globalId);
  const result = (await owner.get(`/api/explanations/${globalId}`)).body.data;
  expect(result.status, JSON.stringify(result)).toBe('COMPLETED');
  const g = result.result.global;
  expect(g.evaluation.sampleSize).toBe(8);
  expect(g.model.datasetProvenance).toBe('SYNTHETIC_DEMO');
  expect(g.importance.some((x: { meanAbsShap: number }) => x.meanAbsShap > 0)).toBe(true);
  expect(
    g.background.trainingRowIndices.some((i: number) => g.evaluation.rowIndices.includes(i)),
  ).toBe(false);
  expect((await owner.get(`/api/explanations/global/${cpuId}`)).body.data.id).toBe(globalId);
}, 120000);
it('M6 tools retrieve actual saved SHAP/prediction evidence and run read-only fitted inference', async () => {
  const prediction = await db.mLPrediction.findUniqueOrThrow({ where: { id: predictionId } });
  const local = await executeTool(
    prediction.userId,
    'get_prediction_explanation',
    { id: predictionId },
    {},
  );
  expect(local.available, JSON.stringify(local)).toBe(true);
  expect(local.units.contributions).toContain('ln(ms)');
  expect(local.references[0]?.id).toBe(localId);
  const actual = explanationResultSchema.parse(local.data);
  expect(actual.kind).toBe('LOCAL');
  const global = await executeTool(
    prediction.userId,
    'get_global_feature_importance',
    { id: cpuId },
    {},
  );
  expect(global.available).toBe(true);
  expect(global.references[0]?.id).toBe(globalId);
  const saved = await executeTool(prediction.userId, 'get_ml_prediction', { id: predictionId }, {});
  expect(saved.provenance).toBe('PREDICTED');
  expect(saved.references[0]?.id).toBe(predictionId);
  const foreign = await db.user.findUniqueOrThrow({ where: { email: emails[1]! } });
  for (const [name, id] of [
    ['get_prediction_explanation', predictionId],
    ['get_global_feature_importance', cpuId],
    ['get_ml_prediction', predictionId],
  ] as const)
    expect((await executeTool(foreign.id, name, { id }, {})).available).toBe(false);
  const before = await db.mLPrediction.count({ where: { userId: prediction.userId } });
  try {
    for (const id of [cpuId, gpuId])
      await write(owner, `/api/ml/models/${id}/activate`, { active: true });
    expect((await executeTool(prediction.userId, 'list_active_models', {}, {})).available).toBe(
      true,
    );
    const preview = await executeTool(
      prediction.userId,
      'run_ml_prediction',
      { workloadId: prediction.workloadId!, hardwareProfileId: prediction.hardwareProfileId! },
      {},
    );
    expect(preview.available).toBe(true);
    expect(preview.provenance).toBe('PREDICTED');
    expect(preview.references.some((r) => r.type === 'model' && r.id === cpuId)).toBe(true);
    expect(await db.mLPrediction.count({ where: { userId: prediction.userId } })).toBe(before);
  } finally {
    for (const id of [cpuId, gpuId])
      await write(owner, `/api/ml/models/${id}/activate`, { active: false });
  }
});
it('fails unsupported family jobs explicitly and permits an owner retry', async () => {
  const input = {
    kind: 'GLOBAL',
    modelId: cpuId,
    backgroundLimit: 16,
    sampleLimit: 8,
    workloadFamily: 'nonexistent family',
  };
  const r = await write(owner, '/api/explanations', input);
  expect(r.status, r.text).toBe(202);
  await worker('explanation_worker', r.body.data.id);
  const failed = (await owner.get(`/api/explanations/${r.body.data.id}`)).body.data;
  expect(failed.status).toBe('FAILED');
  expect(failed.error).toContain('two held-out');
  expect(failed.result).toBeNull();
  const retry = await write(owner, '/api/explanations', input);
  expect(retry.body.data.attempts).toBe(2);
  await worker('explanation_worker', retry.body.data.id);
}, 120000);
it('rejects changed artifact hashes and source versions even when an explanation was cached', async () => {
  const m = await db.mLModel.findUniqueOrThrow({ where: { id: cpuId } });
  try {
    await db.mLModel.update({ where: { id: cpuId }, data: { sha256: '0'.repeat(64) } });
    const r = await write(owner, '/api/explanations', {
      kind: 'LOCAL',
      predictionId,
      backgroundLimit: 16,
    });
    expect(r.status, r.text).toBe(422);
    expect(r.body.error.message).toContain('integrity');
  } finally {
    await db.mLModel.update({ where: { id: cpuId }, data: { sha256: m.sha256 } });
  }
  expect((await owner.get(`/api/explanations/${localId}`)).body.data.status).toBe('COMPLETED');
});
it('marks abandoned running leases failed without fabricating a result', async () => {
  const r = await write(owner, '/api/explanations', {
    kind: 'GLOBAL',
    modelId: gpuId,
    backgroundLimit: 8,
    sampleLimit: 8,
  });
  expect(r.status).toBe(202);
  await db.modelExplanation.update({
    where: { id: r.body.data.id },
    data: { status: 'RUNNING', leaseUntil: new Date(0) },
  });
  const state = (await owner.get(`/api/explanations/${r.body.data.id}`)).body.data;
  expect(state.status).toBe('FAILED');
  expect(state.result).toBeNull();
});
