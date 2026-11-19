import 'dotenv/config';
import request from 'supertest';
import type { Response } from 'supertest';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createApp } from '../src/app.js';
import { db } from '../src/lib/db.js';
import {
  blankWorkload,
  emptyCapabilities,
  analyticalResultSchema,
  comparisonResponseSchema,
  workloadResponseSchema,
  type HardwareInput,
} from '@corewise/types';

const app = createApp();
const owner = request.agent(app);
const other = request.agent(app);
const emails: string[] = [];
const sessions = new Set<string>();
function remember(response: Response) {
  for (const cookie of response.headers['set-cookie'] ?? []) {
    const value = decodeURIComponent(cookie.split(';')[0]!.split('=').slice(1).join('='));
    if (value.startsWith('s:')) sessions.add(value.slice(2, value.lastIndexOf('.')));
  }
}
async function token(agent: typeof owner) {
  const response = await agent.get('/api/auth/csrf');
  remember(response);
  expect(response.status).toBe(200);
  return response.body.data.token as string;
}
async function signUp(agent: typeof owner) {
  const email = `m2-test-${randomUUID()}@example.invalid`;
  emails.push(email);
  const csrf = await token(agent);
  const response = await agent
    .post('/api/auth/register')
    .set('x-csrf-token', csrf)
    .send({ name: 'M2 Test Engineer', email, password: 'M2 integration test passphrase' });
  expect(response.status).toBe(201);
}
const profile: HardwareInput = {
  name: 'M2 user-entered system',
  manufacturer: '',
  deviceModel: '',
  description: '',
  os: 'Test OS',
  cpuManufacturer: 'Test',
  cpuName: 'Test CPU',
  physicalCores: 8,
  logicalProcessors: 16,
  cpuBaseGhz: 3,
  cpuMaxGhz: 4,
  gpuManufacturer: 'Test',
  gpuName: 'Test GPU',
  vramGb: 16,
  memoryBandwidthGbps: 500,
  computeCapability: null,
  ramGb: 32,
  memoryType: '',
  memoryFrequencyMhz: null,
};
const assumptions = {
  ...emptyCapabilities,
  cpuPeakGflops: 100,
  cpuBandwidthGbps: 100,
  gpuPeakGflops: 1000,
  transferBandwidthGbps: 10,
  kernelLaunchUs: 10,
};
let hardwareId: string;
let foreignHardwareId: string;
const config = () => ({
  ...blankWorkload,
  name: 'M2 saved workload',
  operationCount: 1e9,
  arithmeticIntensity: 100,
  parallelFraction: 1,
  memoryMiB: 1,
  hardwareProfileId: hardwareId,
  assumptions,
});
async function create() {
  return owner
    .post('/api/workloads')
    .set('x-csrf-token', await token(owner))
    .send(config());
}
beforeAll(async () => {
  await signUp(owner);
  await signUp(other);
  hardwareId = (
    await owner
      .post('/api/hardware-profiles')
      .set('x-csrf-token', await token(owner))
      .send(profile)
  ).body.data.id;
  foreignHardwareId = (
    await other
      .post('/api/hardware-profiles')
      .set('x-csrf-token', await token(other))
      .send(profile)
  ).body.data.id;
});
afterAll(async () => {
  await db.user.deleteMany({ where: { email: { in: emails } } });
  await db.session.deleteMany({ where: { id: { in: [...sessions] } } });
  await db.$disconnect();
});
describe('M2 workload API', () => {
  it('creates, lists, retrieves, partially edits, duplicates, and deletes owned workloads', async () => {
    const response = await create();
    expect(response.status).toBe(201);
    expect(workloadResponseSchema.safeParse(response.body).success).toBe(true);
    const id = response.body.data.id;
    expect(
      (await owner.get('/api/workloads')).body.data.some((item: { id: string }) => item.id === id),
    ).toBe(true);
    expect((await owner.get(`/api/workloads/${id}`)).body.data.name).toBe('M2 saved workload');
    const update = await owner
      .patch(`/api/workloads/${id}`)
      .set('x-csrf-token', await token(owner))
      .send({ name: 'Updated M2 workload', repetitions: 2 });
    expect(update.status).toBe(200);
    expect(update.body.data.operationCount).toBe(1e9);
    expect(update.body.data.repetitions).toBe(2);
    const copy = await owner
      .post('/api/workloads')
      .set('x-csrf-token', await token(owner))
      .send({ ...config(), name: 'M2 copy' });
    expect(copy.status).toBe(201);
    expect(copy.body.data.id).not.toBe(id);
    expect(
      (await owner.delete(`/api/workloads/${id}`).set('x-csrf-token', await token(owner))).status,
    ).toBe(204);
    expect((await owner.get(`/api/workloads/${id}`)).status).toBe(404);
  });
  it('denies foreign workload reads, edits, deletes, estimates, and comparisons', async () => {
    const id = (await create()).body.data.id;
    expect((await other.get(`/api/workloads/${id}`)).status).toBe(404);
    expect((await other.get('/api/workloads')).body.data).toEqual([]);
    expect(
      (
        await other
          .patch(`/api/workloads/${id}`)
          .set('x-csrf-token', await token(other))
          .send({ name: 'Not mine' })
      ).status,
    ).toBe(404);
    expect(
      (await other.delete(`/api/workloads/${id}`).set('x-csrf-token', await token(other))).status,
    ).toBe(404);
    for (const action of ['estimate', 'compare'])
      expect(
        (
          await other
            .post(`/api/analytical/${action}`)
            .set('x-csrf-token', await token(other))
            .send({ workloadId: id, assumptions, tolerance: 0.05 })
        ).status,
      ).toBe(404);
  });
  it('validates hardware ownership on creation, reassignment, and analysis overrides', async () => {
    expect(
      (
        await owner
          .post('/api/workloads')
          .set('x-csrf-token', await token(owner))
          .send({ ...config(), hardwareProfileId: foreignHardwareId })
      ).status,
    ).toBe(404);
    const id = (await create()).body.data.id;
    expect(
      (
        await owner
          .patch(`/api/workloads/${id}`)
          .set('x-csrf-token', await token(owner))
          .send({ hardwareProfileId: foreignHardwareId })
      ).status,
    ).toBe(404);
    expect(
      (
        await owner
          .post('/api/analytical/compare')
          .set('x-csrf-token', await token(owner))
          .send({
            workloadId: id,
            hardwareProfileId: foreignHardwareId,
            assumptions,
            tolerance: 0.05,
          })
      ).status,
    ).toBe(404);
  });
  it('enforces validation and prevents forged owners, provenance, or results', async () => {
    for (const patch of [
      { operationCount: -1 },
      { arithmeticIntensity: 0 },
      { parallelFraction: 2 },
      { repetitions: 0 },
      { userId: 'fake' },
      { provenance: 'MEASURED' },
    ])
      expect(
        (
          await owner
            .post('/api/workloads')
            .set('x-csrf-token', await token(owner))
            .send({ ...config(), ...patch })
        ).status,
      ).toBe(400);
    const id = (await create()).body.data.id;
    expect(
      (
        await owner
          .patch(`/api/workloads/${id}`)
          .set('x-csrf-token', await token(owner))
          .send({ arithmeticIntensity: 0 })
      ).status,
    ).toBe(400);
    expect(
      (
        await owner
          .patch(`/api/workloads/${id}`)
          .set('x-csrf-token', await token(owner))
          .send({})
      ).status,
    ).toBe(400);
    expect(
      (
        await owner
          .post('/api/analytical/compare')
          .set('x-csrf-token', await token(owner))
          .send({ workloadId: id, assumptions, tolerance: 0.05, result: { cpu: 1 } })
      ).status,
    ).toBe(400);
  });
  it('marks preset-based inputs synthetic and custom inputs user-entered', async () => {
    const response = await owner
      .post('/api/workloads')
      .set('x-csrf-token', await token(owner))
      .send({ ...config(), presetId: 'matrix' });
    expect(response.body.data.provenance).toBe('SYNTHETIC_DEMO');
    expect((await create()).body.data.provenance).toBe('USER_ENTERED');
  });
});
describe('M2 analytical API and snapshots', () => {
  it('snapshots run overrides without changing the saved workload defaults', async () => {
    const id = (await create()).body.data.id;
    const alternate = (
      await owner
        .post('/api/hardware-profiles')
        .set('x-csrf-token', await token(owner))
        .send({ ...profile, name: 'Alternate owned system' })
    ).body.data.id;
    const override = { ...assumptions, gpuPeakGflops: 2000 };
    const response = await owner
      .post('/api/analytical/compare')
      .set('x-csrf-token', await token(owner))
      .send({
        workloadId: id,
        hardwareProfileId: alternate,
        assumptions: override,
        tolerance: 0.12,
      });
    expect(response.status).toBe(201);
    expect(response.body.data.workloadSnapshot.hardwareProfileId).toBe(alternate);
    expect(response.body.data.workloadSnapshot.assumptions).toEqual(override);
    expect(response.body.data.workloadSnapshot.tolerance).toBe(0.12);
    expect(response.body.data.result.assumptions.supplied).toEqual(override);
    expect((await owner.get(`/api/workloads/${id}`)).body.data.hardwareProfileId).toBe(hardwareId);
  });
  it('persists deterministic comparisons and authenticated history', async () => {
    const id = (await create()).body.data.id;
    const body = { workloadId: id, assumptions, tolerance: 0.05 };
    const a = await owner
      .post('/api/analytical/compare')
      .set('x-csrf-token', await token(owner))
      .send(body);
    const b = await owner
      .post('/api/analytical/compare')
      .set('x-csrf-token', await token(owner))
      .send(body);
    expect(a.status).toBe(201);
    expect(comparisonResponseSchema.safeParse(a.body).success).toBe(true);
    expect(a.body.data.result).toEqual(b.body.data.result);
    expect(a.body.data.provenance).toBe('ANALYTICAL');
    expect(a.body.data.result.recommendation).toBe('GPU');
    expect(
      (await owner.get('/api/comparisons')).body.data.some(
        (item: { id: string }) => item.id === a.body.data.id,
      ),
    ).toBe(true);
    expect((await owner.get(`/api/comparisons/${a.body.data.id}`)).status).toBe(200);
    expect((await other.get(`/api/comparisons/${a.body.data.id}`)).status).toBe(404);
    expect((await other.get('/api/comparisons')).body.data).toEqual([]);
  });
  it('retains immutable snapshots after edits and deletion of a workload/profile', async () => {
    const hardware = (
      await owner
        .post('/api/hardware-profiles')
        .set('x-csrf-token', await token(owner))
        .send(profile)
    ).body.data;
    const workload = (
      await owner
        .post('/api/workloads')
        .set('x-csrf-token', await token(owner))
        .send({ ...config(), hardwareProfileId: hardware.id })
    ).body.data;
    const response = await owner
      .post('/api/analytical/compare')
      .set('x-csrf-token', await token(owner))
      .send({ workloadId: workload.id, assumptions, tolerance: 0.05 });
    await owner
      .patch(`/api/workloads/${workload.id}`)
      .set('x-csrf-token', await token(owner))
      .send({ name: 'Changed later' });
    await owner.delete(`/api/workloads/${workload.id}`).set('x-csrf-token', await token(owner));
    await owner
      .delete(`/api/hardware-profiles/${hardware.id}`)
      .set('x-csrf-token', await token(owner));
    const saved = (await owner.get(`/api/comparisons/${response.body.data.id}`)).body.data;
    expect(saved.workloadId).toBeNull();
    expect(saved.hardwareProfileId).toBeNull();
    expect(saved.workloadSnapshot.name).toBe(workload.name);
    expect(saved.hardwareSnapshot.id).toBe(hardware.id);
    expect(saved.result).toEqual(response.body.data.result);
  });
  it('returns missing specifications instead of invented capabilities', async () => {
    const id = (await create()).body.data.id;
    const response = await owner
      .post('/api/analytical/compare')
      .set('x-csrf-token', await token(owner))
      .send({ workloadId: id, assumptions: emptyCapabilities, tolerance: 0.05 });
    expect(response.status).toBe(201);
    const result = analyticalResultSchema.parse(response.body.data.result);
    expect(result.recommendation).toBe('INSUFFICIENT_DATA');
    expect(result.cpu).toBeNull();
    expect(result.missingFields).toContain('assumptions.cpuPeakGflops');
  });
  it('supports estimate records and explicitly requires hardware', async () => {
    const id = (await create()).body.data.id;
    const response = await owner
      .post('/api/analytical/estimate')
      .set('x-csrf-token', await token(owner))
      .send({ workloadId: id, assumptions, tolerance: 0.05 });
    expect(response.status).toBe(201);
    expect(response.body.data.kind).toBe('ESTIMATE');
    const noHardware = await owner
      .post('/api/workloads')
      .set('x-csrf-token', await token(owner))
      .send({ ...config(), hardwareProfileId: null });
    expect(
      (
        await owner
          .post('/api/analytical/compare')
          .set('x-csrf-token', await token(owner))
          .send({ workloadId: noHardware.body.data.id, assumptions, tolerance: 0.05 })
      ).status,
    ).toBe(422);
  });
  it('requires authentication and CSRF without weakening M1 protections', async () => {
    for (const path of ['/api/workloads', '/api/comparisons'])
      expect((await request(app).get(path)).status).toBe(401);
    expect((await owner.post('/api/workloads').send(config())).status).toBe(403);
    expect((await owner.post('/api/analytical/compare').send({})).status).toBe(403);
    const anonymous = request.agent(app);
    const csrf = await token(anonymous);
    expect(
      (
        await anonymous
          .post('/api/analytical/estimate')
          .set('x-csrf-token', csrf)
          .send({ workloadId: 'x', assumptions, tolerance: 0.05 })
      ).status,
    ).toBe(401);
  });
});
