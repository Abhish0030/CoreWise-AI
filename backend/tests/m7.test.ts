import 'dotenv/config';
import request from 'supertest';
import { randomUUID, createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { beforeAll, afterAll, it, expect } from 'vitest';
import {
  blankWorkload,
  emptyCapabilities,
  reportResponseSchema,
  reportSnapshotSchema,
} from '@corewise/types';
import { createApp } from '../src/app.js';
import { db } from '../src/lib/db.js';
import { safeCsv } from '../src/lib/csv.js';
import { hash } from '../src/modules/assistant/safety.js';
const app = createApp(),
  owner = request.agent(app),
  other = request.agent(app),
  emails: string[] = [];
let hardwareId: string,
  foreignHardwareId: string,
  workloadId: string,
  comparisonId: string,
  reportId: string;
async function token(a = owner) {
  return (await a.get('/api/auth/csrf')).body.data.token as string;
}
async function post(path: string, data: object, a = owner) {
  const csrf = await token(a);
  return a.post(path).set('x-csrf-token', csrf).send(data);
}
async function signup(a = owner) {
  const email = `m7-test-${randomUUID()}@example.invalid`;
  emails.push(email);
  const r = await post(
    '/api/auth/register',
    { name: 'M7 Test Engineer', email, password: 'M7 integration test passphrase' },
    a,
  );
  expect(r.status, r.text).toBe(201);
}
const profile = {
  name: '=HYPERLINK("https://invalid.example","test")',
  manufacturer: 'Test vendor',
  deviceModel: 'Test device',
  os: 'Test OS',
  description: '<script>window.reportInjection=true</script> api_key=private-fixture-key',
  cpuManufacturer: 'Test',
  cpuName: 'CPU µ architecture',
  physicalCores: 8,
  logicalProcessors: 16,
  cpuBaseGhz: 3,
  cpuMaxGhz: 4,
  gpuManufacturer: 'Test',
  gpuName: 'GPU',
  vramGb: 16,
  memoryBandwidthGbps: 500,
  computeCapability: null,
  ramGb: 32,
  memoryType: 'DDR5',
  memoryFrequencyMhz: null,
};
const assumptions = {
  ...emptyCapabilities,
  cpuPeakGflops: 100,
  cpuBandwidthGbps: 100,
  gpuPeakGflops: 1000,
  gpuBandwidthGbps: 500,
  transferBandwidthGbps: 10,
  kernelLaunchUs: 10,
};
beforeAll(async () => {
  await signup();
  await signup(other);
  hardwareId = (await post('/api/hardware-profiles', profile)).body.data.id;
  foreignHardwareId = (
    await post('/api/hardware-profiles', { ...profile, name: 'Foreign M7 private machine' }, other)
  ).body.data.id;
  const w = await post('/api/workloads', {
    ...blankWorkload,
    name: 'M7 actual analytical workload',
    category: 'MATRIX_MULTIPLICATION',
    inputSize: 1024,
    operationCount: 1e9,
    arithmeticIntensity: 20,
    parallelFraction: 0.95,
    memoryMiB: 12,
    transferMiB: 12,
    repetitions: 3,
    hardwareProfileId: hardwareId,
    assumptions,
  });
  expect(w.status, w.text).toBe(201);
  workloadId = w.body.data.id;
  const c = await post('/api/analytical/compare', {
    workloadId,
    hardwareProfileId: hardwareId,
    assumptions,
    tolerance: 0.05,
  });
  expect(c.status, c.text).toBe(201);
  comparisonId = c.body.data.id;
});
afterAll(async () => {
  await db.user.deleteMany({ where: { email: { in: emails } } });
  await db.$disconnect();
});
const config = () => ({
  title: 'CoreWise evidence / review',
  type: 'OVERVIEW',
  hardwareProfileId: hardwareId,
  workloadIds: [workloadId],
  comparisonIds: [comparisonId],
});
it('requires database sessions and CSRF for report writes, protects source listings and summary', async () => {
  for (const path of ['/api/reports', '/api/reports/sources', '/api/workspace/summary'])
    expect((await request(app).get(path)).status).toBe(401);
  expect((await owner.post('/api/reports').send(config())).status).toBe(403);
  expect((await post('/api/reports', { ...config(), userId: 'forged' })).status).toBe(400);
});
it('validates report type/source bounds and returns missing/foreign sources without fallback', async () => {
  for (const input of [
    { title: 'x', type: 'HARDWARE' },
    { title: 'x', type: 'BENCHMARK', hardwareProfileId: hardwareId },
    { ...config(), workloadIds: [workloadId, workloadId] },
  ])
    expect((await post('/api/reports', input)).status).toBe(400);
  expect(
    (await post('/api/reports', { ...config(), hardwareProfileId: foreignHardwareId })).status,
  ).toBe(404);
  expect(
    (await post('/api/reports', { ...config(), predictionIds: ['missing-record'] })).status,
  ).toBe(404);
});
it('previews real source data without persisting a generated report', async () => {
  const r = await post('/api/reports/preview', config());
  expect(r.status, r.text).toBe(200);
  const s = reportSnapshotSchema.parse(r.body.data);
  expect(s.sections.some((x) => x.provenance === 'ANALYTICAL')).toBe(true);
  expect(s.sources.hardware[0]?.name).toBe(profile.name);
  expect(JSON.stringify(s)).not.toContain('private-fixture-key');
  expect((await owner.get('/api/reports')).body.data).toHaveLength(0);
});
it('creates immutable reports with complete provenance, source references and persisted export hashes', async () => {
  const r = await post('/api/reports', config());
  expect(r.status, r.text).toBe(201);
  const report = reportResponseSchema.parse(r.body).data;
  reportId = report.id;
  expect(report.sourceCount).toBe(3);
  expect(report.status).toBe('READY');
  expect(report.snapshot.sections.some((s) => s.chart?.unit === 'ms')).toBe(true);
  expect(report.exportMetadata.pdfBytes).toBeGreaterThan(1000);
  expect(report.exportMetadata.csvBytes).toBeGreaterThan(1000);
  expect((await owner.get('/api/reports')).body.data[0].id).toBe(reportId);
});
it('denies foreign report retrieval/download/deletion and hides source options', async () => {
  for (const path of [
    `/api/reports/${reportId}`,
    `/api/reports/${reportId}/download`,
    `/api/reports/${reportId}/download?format=csv`,
  ])
    expect((await other.get(path)).status).toBe(404);
  expect(
    (await other.delete(`/api/reports/${reportId}`).set('x-csrf-token', await token(other))).status,
  ).toBe(404);
  const sources = (await other.get('/api/reports/sources')).body.data;
  expect(sources.workloads).toHaveLength(0);
  expect(sources.hardware.some((h: { id: string }) => h.id === hardwareId)).toBe(false);
});
it('exports real PDF bytes and spreadsheet-safe CSV; downloads are stable and use safe filenames', async () => {
  const a = await owner.get(`/api/reports/${reportId}/download`);
  expect(a.status).toBe(200);
  expect(a.headers['content-type']).toContain('application/pdf');
  const pdf = Buffer.from(a.body);
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  expect(pdf.toString('latin1')).toContain('%%EOF');
  expect(a.headers['content-disposition']).toBe(`attachment; filename="corewise-${reportId}.pdf"`);
  expect(a.headers['cache-control']).toContain('no-store');
  const row = (await owner.get(`/api/reports/${reportId}`)).body.data;
  expect(createHash('sha256').update(pdf).digest('hex')).toBe(row.exportMetadata.pdfSha256);
  const csv = await owner.get(`/api/reports/${reportId}/download?format=csv`);
  expect(csv.status).toBe(200);
  expect(csv.text).toContain("'=HYPERLINK");
  expect(csv.text).toContain('USER_ENTERED');
  expect(csv.text).toContain('ANALYTICAL');
  expect(csv.text).not.toContain('private-fixture-key');
  expect(
    (await owner.get(`/api/reports/${reportId}/download?format=../../etc/passwd`)).status,
  ).toBe(400);
  await mkdir(resolve('.artifacts/test-results'), { recursive: true });
  await writeFile(resolve('.artifacts/test-results/m7-review-report.pdf'), pdf);
});
it('retains exact snapshots and export bytes after source edits and deletion', async () => {
  const before = reportResponseSchema.parse(
    (await owner.get(`/api/reports/${reportId}`)).body,
  ).data;
  const csrf = await token();
  expect(
    (
      await owner
        .put(`/api/hardware-profiles/${hardwareId}`)
        .set('x-csrf-token', csrf)
        .send({ ...profile, name: 'Edited hardware' })
    ).status,
  ).toBe(200);
  expect(
    (await owner.delete(`/api/workloads/${workloadId}`).set('x-csrf-token', await token())).status,
  ).toBe(204);
  const after = reportResponseSchema.parse((await owner.get(`/api/reports/${reportId}`)).body).data;
  expect(after.snapshot).toEqual(before.snapshot);
  expect(after.exportMetadata).toEqual(before.exportMetadata);
});
it('sanitizes formula-leading string cells while preserving typed negative SHAP values and CSV quoting', () => {
  const s = safeCsv([
    {
      a: '\t=WEBSERVICE("bad")',
      b: '+SUM(1,2)',
      c: '-formula',
      d: '@command',
      e: -0.123,
      f: 'comma,quote"\nline',
    },
  ]);
  for (const prefix of ["'\t=", "'+SUM", "'-formula", "'@command"]) expect(s).toContain(prefix);
  expect(s).toContain('"-0.123"');
  expect(s).toContain('comma,quote""\nline');
});
it('enforces integrity and allows owner deletion without deleting source evidence', async () => {
  const row = await db.generatedReport.findUniqueOrThrow({ where: { id: reportId } });
  await db.generatedReport.update({
    where: { id: reportId },
    data: { pdf: Uint8Array.from([1, 2, 3]) },
  });
  expect((await owner.get(`/api/reports/${reportId}/download`)).status).toBe(409);
  await db.generatedReport.update({ where: { id: reportId }, data: { pdf: row.pdf } });
  expect(
    (await owner.delete(`/api/reports/${reportId}`).set('x-csrf-token', await token())).status,
  ).toBe(204);
  expect((await owner.get(`/api/reports/${reportId}`)).status).toBe(404);
  expect(await db.hardwareProfile.count({ where: { id: hardwareId } })).toBe(1);
});
it('fails closed for malformed delegated session payloads before any tool executes', async () => {
  const u = await db.user.findUniqueOrThrow({ where: { email: emails[0]! } }),
    grant = randomUUID() + randomUUID(),
    csrf = 'fixture-csrf';
  const session = await db.session.create({
    data: {
      id: 'm7-invalid-' + randomUUID(),
      userId: u.id,
      expiresAt: new Date(Date.now() + 60000),
      data: JSON.stringify({ userId: u.id, authExpiresAt: '9999999999999999' }),
    },
  });
  const conversation = await db.agentConversation.create({
    data: { userId: u.id, title: 'Exact fixture malformed session test' },
  });
  const message = await db.agentMessage.create({
    data: {
      conversationId: conversation.id,
      role: 'ASSISTANT',
      content: '',
      status: 'STREAMING',
      grantHash: hash(grant),
      csrfHash: hash(csrf),
      sessionId: session.id,
      expiresAt: new Date(Date.now() + 30000),
    },
  });
  const r = await request(app)
    .post('/internal/agent/tools')
    .set('Authorization', `Bearer ${process.env.ML_INTERNAL_TOKEN}`)
    .set('x-agent-grant', grant)
    .set('x-csrf-token', csrf)
    .send({ name: 'list_hardware_profiles', arguments: {} });
  expect(r.status).toBe(403);
  expect(await db.agentToolCall.count({ where: { messageId: message.id } })).toBe(0);
});
it('rejects expired personal sessions on report APIs', async () => {
  const u = await db.user.findUniqueOrThrow({ where: { email: emails[0]! } });
  await db.session.updateMany({ where: { userId: u.id }, data: { expiresAt: new Date(0) } });
  expect((await owner.get('/api/reports')).status).toBe(401);
});
