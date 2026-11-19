import 'dotenv/config';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeAll, afterAll, it, expect } from 'vitest';
import {
  benchmarkMeasurementSchema,
  benchmarkConfigSchema,
  type BenchmarkMeasurement,
} from '@corewise/types';
import { createApp } from '../src/app.js';
import { db } from '../src/lib/db.js';
import { executeTool } from '../src/modules/assistant/tools.js';
import { validateMeasurement } from '../src/modules/benchmarks/validation.js';
import { measuredRows, csv } from '../src/modules/benchmarks/export.js';
const app = createApp(),
  owner = request.agent(app),
  other = request.agent(app),
  runner = request.agent(app);
const emails: string[] = [];
let measurement: BenchmarkMeasurement, agentId: string, token: string, jobId: string, runId: string;
async function csrf(a = owner) {
  const r = await a.get('/api/auth/csrf');
  expect(r.status, r.text).toBe(200);
  return r.body.data.token as string;
}
async function write(a: typeof owner, path: string, data: object = {}) {
  const t = await csrf(a);
  return a.post(path).set('x-csrf-token', t).send(data);
}
async function signup(a: typeof owner) {
  const email = `m4-test-${randomUUID()}@example.invalid`;
  emails.push(email);
  expect(
    (
      await write(a, '/api/auth/register', {
        email,
        name: 'M4 Test Engineer',
        password: 'M4 integration passphrase 2026',
      })
    ).status,
  ).toBe(201);
}
const caps = {
  cpu_gflops: null,
  cpu_bandwidth_gbps: null,
  gpu_gflops: null,
  gpu_bandwidth_gbps: null,
  transfer_bandwidth_gbps: null,
  launch_overhead_us: null,
  parallel_fraction: null,
  source: 'No external capability measurements supplied',
};
beforeAll(async () => {
  await signup(owner);
  await signup(other);
  const python = resolve(
    'backend/local-agent/.venv',
    process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
  );
  const { stdout } = await promisify(execFile)(
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
      '--cpu-only',
    ],
    {
      env: { ...process.env, PYTHONPATH: resolve('backend/local-agent') },
      timeout: 90000,
      maxBuffer: 1e6,
    },
  );
  const result = JSON.parse(stdout);
  expect(result.status).toBe('COMPLETED');
  measurement = benchmarkMeasurementSchema.parse(result.measurement);
}, 120000);
afterAll(async () => {
  await db.user.deleteMany({ where: { email: { in: emails } } });
  await db.$disconnect();
});
it('requires database user sessions and CSRF, and exposes the allowlisted catalog', async () => {
  for (const path of ['catalog', 'agents', 'jobs', 'runs', 'export.csv'])
    expect((await request(app).get(`/api/benchmarks/${path}`)).status).toBe(401);
  expect((await owner.post('/api/benchmarks/pairing').send({})).status).toBe(403);
  expect(
    (await owner.get('/api/benchmarks/catalog')).body.data.map((r: { id: string }) => r.id),
  ).toEqual([
    'VECTOR_ADDITION',
    'MATRIX_MULTIPLICATION',
    'SORTING',
    'REDUCTION',
    'IMAGE_PROCESSING',
  ]);
});
it('pairs once with a short-lived code and stores only credential hashes', async () => {
  const p = await write(owner, '/api/benchmarks/pairing');
  expect(p.status).toBe(201);
  const r = await write(runner, '/api/agent/redeem', {
    code: p.body.data.code,
    name: 'Actual CPU test runner',
    environment: measurement.environment,
  });
  expect(r.status, r.text).toBe(201);
  agentId = r.body.data.agentId;
  token = r.body.data.token;
  expect(
    (
      await write(runner, '/api/agent/redeem', {
        code: p.body.data.code,
        name: 'Replay',
        environment: measurement.environment,
      })
    ).status,
  ).toBe(401);
  const record = await db.localAgent.findUniqueOrThrow({ where: { id: agentId } });
  expect(record.tokenHash).not.toBe(token);
  expect((await owner.get('/api/benchmarks/agents')).body.data[0].tokenHash).toBeUndefined();
  expect((await other.get('/api/benchmarks/agents')).body.data).toHaveLength(0);
});
it('establishes a scoped database runner session without granting personal API access', async () => {
  const t = await csrf(runner);
  const r = await runner
    .post('/api/agent/session')
    .set('x-csrf-token', t)
    .set('Authorization', `Bearer ${token}`)
    .send({});
  expect(r.status, r.text).toBe(200);
  expect((await runner.get('/api/hardware-profiles')).status).toBe(401);
  expect((await runner.post('/api/agent/claim').send({})).status).toBe(403);
  expect((await write(other, `/api/benchmarks/agents/${agentId}/revoke`)).status).toBe(404);
});
it('queues bounded jobs with ownership and controlled concurrency', async () => {
  const body = { agentId, config: measurement.config };
  expect((await write(other, '/api/benchmarks/jobs', body)).status).toBe(404);
  expect(
    (
      await write(owner, '/api/benchmarks/jobs', {
        agentId,
        config: { ...measurement.config, size: 9e9 },
      })
    ).status,
  ).toBe(400);
  const r = await write(owner, '/api/benchmarks/jobs', body);
  expect(r.status, r.text).toBe(201);
  jobId = r.body.data.id;
  expect((await write(owner, '/api/benchmarks/jobs', body)).status).toBe(409);
  expect((await other.get(`/api/benchmarks/jobs/${jobId}`)).status).toBe(404);
  const claim = await write(runner, '/api/agent/claim');
  expect(claim.body.data.id).toBe(jobId);
  expect(claim.body.data.status).toBe('RUNNING');
  expect((await write(runner, '/api/agent/claim')).body.data).toBeNull();
});
it('rejects inconsistent samples and persists real CPU-only measurements immutably', async () => {
  const broken = structuredClone(measurement);
  broken.cpu.summary.meanMs += 1;
  expect(
    (
      await write(runner, `/api/agent/jobs/${jobId}/result`, {
        status: 'COMPLETED',
        measurement: broken,
      })
    ).status,
  ).toBe(400);
  const r = await write(runner, `/api/agent/jobs/${jobId}/result`, {
    status: 'COMPLETED',
    measurement,
  });
  expect(r.status, r.text).toBe(201);
  runId = r.body.data.id;
  expect(r.body.data.measurement.gpu).toBeNull();
  expect(r.body.data.valid).toBe(true);
  expect(
    (await write(runner, `/api/agent/jobs/${jobId}/result`, { status: 'COMPLETED', measurement }))
      .status,
  ).toBe(409);
  expect((await other.get(`/api/benchmarks/runs/${runId}`)).status).toBe(404);
  expect((await other.get('/api/benchmarks/runs')).body.data).toHaveLength(0);
  const saved = await db.benchmarkRun.findUniqueOrThrow({ where: { id: runId } });
  const evidence = await executeTool(saved.userId, 'get_benchmark_run', { id: runId }, {});
  expect(evidence.available).toBe(true);
  expect(evidence.provenance).toBe('MEASURED');
  expect(evidence.references[0]?.id).toBe(runId);
  const outsider = await db.user.findUniqueOrThrow({ where: { email: emails[1]! } });
  expect((await executeTool(outsider.id, 'get_benchmark_run', { id: runId }, {})).available).toBe(
    false,
  );
});
it('exports raw CPU data and reports missing GPU targets without manufacturing training rows', async () => {
  const raw = await owner.get('/api/benchmarks/export.csv');
  expect(raw.status).toBe(200);
  expect(raw.text).toContain('cpu_time_ms');
  expect(raw.text).toContain('MEASURED');
  const r = await write(owner, '/api/benchmarks/export-dataset', {
    runIds: [runId],
    capabilities: caps,
  });
  expect(r.status, r.text).toBe(200);
  expect(r.body.data.rowCount).toBe(0);
  expect(r.body.data.excluded[0].reason).toContain('GPU target');
  expect(
    (await write(owner, '/api/benchmarks/datasets', { runIds: [runId], capabilities: caps }))
      .status,
  ).toBe(422);
  expect(
    (await write(other, '/api/benchmarks/export-dataset', { runIds: [runId], capabilities: caps }))
      .status,
  ).toBe(404);
});
it('preserves correctness failures as invalid and excludes them from labels', async () => {
  const j = await write(owner, '/api/benchmarks/jobs', { agentId, config: measurement.config });
  await write(runner, '/api/agent/claim');
  const invalid = structuredClone(measurement);
  invalid.cpu.correctness.valid = false;
  invalid.cpu.correctness.diagnostic = 'Injected invalid-output test case';
  invalid.valid = true;
  const r = await write(runner, `/api/agent/jobs/${j.body.data.id}/result`, {
    status: 'COMPLETED',
    measurement: invalid,
  });
  expect(r.status, r.text).toBe(201);
  expect(r.body.data.valid).toBe(false);
  expect(r.body.data.measurement.speedup).toBeNull();
  expect((await owner.get(`/api/benchmarks/jobs/${j.body.data.id}`)).body.data.status).toBe(
    'INVALID',
  );
});
it('supports queued/running cancellation and failed execution diagnostics', async () => {
  const a = await write(owner, '/api/benchmarks/jobs', { agentId, config: measurement.config });
  await write(owner, `/api/benchmarks/jobs/${a.body.data.id}/cancel`);
  expect((await owner.get(`/api/benchmarks/jobs/${a.body.data.id}`)).body.data.status).toBe(
    'CANCELLED',
  );
  const b = await write(owner, '/api/benchmarks/jobs', { agentId, config: measurement.config });
  await write(runner, '/api/agent/claim');
  await write(owner, `/api/benchmarks/jobs/${b.body.data.id}/cancel`);
  await write(runner, `/api/agent/jobs/${b.body.data.id}/result`, {
    status: 'CANCELLED',
    error: 'Owner cancelled',
  });
  expect((await owner.get(`/api/benchmarks/jobs/${b.body.data.id}`)).body.data.status).toBe(
    'CANCELLED',
  );
  const c = await write(owner, '/api/benchmarks/jobs', { agentId, config: measurement.config });
  await write(runner, '/api/agent/claim');
  await write(runner, `/api/agent/jobs/${c.body.data.id}/result`, {
    status: 'FAILED',
    error: 'Execution timeout; child terminated',
  });
  expect((await owner.get(`/api/benchmarks/jobs/${c.body.data.id}`)).body.data.error).toContain(
    'timeout',
  );
});
it('revokes scoped credentials and rejects existing runner sessions immediately', async () => {
  await write(owner, `/api/benchmarks/agents/${agentId}/revoke`);
  expect((await write(runner, '/api/agent/claim')).status).toBe(401);
  expect(
    (await write(owner, '/api/benchmarks/jobs', { agentId, config: measurement.config })).status,
  ).toBe(409);
});
it('validates export features and prevents target-derived capability filling', () => {
  expect(validateMeasurement({ ...measurement, valid: false }, measurement.config).valid).toBe(
    false,
  );
  const result = measuredRows([{ id: 'actual-cpu-only', measurement }], caps);
  expect(result.rows).toHaveLength(0);
  expect(csv([])).toBe('');
  const invalid = { ...measurement, provenance: 'ANALYTICAL' };
  expect(() => validateMeasurement(invalid, measurement.config)).toThrow();
  expect(() =>
    validateMeasurement(
      measurement,
      benchmarkConfigSchema.parse({ ...measurement.config, size: 8192 }),
    ),
  ).toThrow('configuration');
});
