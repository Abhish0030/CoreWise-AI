import 'dotenv/config';
import request from 'supertest';
import type { Response } from 'supertest';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { db } from '../src/lib/db.js';
import type { HardwareInput } from '@corewise/types';

const app = createApp();
const owner = request.agent(app);
const other = request.agent(app);
const emails: string[] = [];
const sessions = new Set<string>();
const password = 'integration test passphrase 2026';
function account() {
  const email = `m1-test-${randomUUID()}@example.invalid`;
  emails.push(email);
  return { name: 'Test Engineer', email, password };
}
function remember(response: Response) {
  for (const cookie of response.headers['set-cookie'] ?? []) {
    const signed = decodeURIComponent(cookie.split(';')[0]!.split('=').slice(1).join('='));
    if (signed.startsWith('s:')) sessions.add(signed.slice(2, signed.lastIndexOf('.')));
  }
}
function sessionCookie(response: Response): string {
  const cookie = response.headers['set-cookie']?.[0];
  if (!cookie) throw new Error('Expected session cookie');
  return cookie;
}
async function csrf(agent: typeof owner) {
  const result = await agent.get('/api/auth/csrf');
  expect(result.status).toBe(200);
  remember(result);
  return result.body.data.token as string;
}
async function register(agent: typeof owner, input = account()) {
  const token = await csrf(agent);
  const result = await agent.post('/api/auth/register').set('x-csrf-token', token).send(input);
  remember(result);
  return result;
}
const hardware: HardwareInput = {
  name: 'Test workstation',
  manufacturer: 'Test device vendor',
  deviceModel: 'Test model',
  description: 'User-entered integration test fixture',
  os: 'Test OS',
  cpuManufacturer: 'Test CPU vendor',
  cpuName: 'Test CPU',
  physicalCores: 8,
  logicalProcessors: 16,
  cpuBaseGhz: 3.2,
  cpuMaxGhz: 4.8,
  gpuManufacturer: 'Test graphics vendor',
  gpuName: 'Test GPU',
  vramGb: 12,
  memoryBandwidthGbps: 360,
  computeCapability: 'Test capability',
  ramGb: 32,
  memoryType: 'DDR5',
  memoryFrequencyMhz: 4800,
};
let ownerId: string;
beforeAll(async () => {
  const result = await register(owner);
  expect(result.status).toBe(201);
  ownerId = result.body.data.id;
  expect((await register(other)).status).toBe(201);
});
afterAll(async () => {
  await db.user.deleteMany({ where: { email: { in: emails } } });
  await db.session.deleteMany({ where: { id: { in: [...sessions] } } });
  await db.$disconnect();
});

describe('M1 authentication with PostgreSQL', () => {
  it('registers, hashes with Argon2id, normalizes email, and creates an HttpOnly session', async () => {
    const input = account();
    const agent = request.agent(app);
    const response = await register(agent, { ...input, email: ` ${input.email.toUpperCase()} ` });
    expect(response.status).toBe(201);
    expect(response.body.data.email).toBe(input.email);
    expect(response.body.data).not.toHaveProperty('passwordHash');
    const record = await db.user.findUniqueOrThrow({ where: { email: input.email } });
    expect(record.passwordHash).toMatch(/^\$argon2id\$/);
    expect(record.passwordHash).not.toContain(password);
    expect(sessionCookie(response)).toContain('HttpOnly');
    expect(sessionCookie(response)).toContain('SameSite=Lax');
    expect(sessionCookie(response)).not.toContain('Secure');
    expect((await agent.get('/api/auth/me')).body.data.id).toBe(record.id);
  });
  it('rejects duplicate emails', async () => {
    const input = account();
    const agent = request.agent(app);
    expect((await register(agent, input)).status).toBe(201);
    const duplicate = await register(request.agent(app), input);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('EMAIL_EXISTS');
  });
  it('logs in, rotates the anonymous session, and persists across application instances', async () => {
    const input = account();
    const agent = request.agent(app);
    const created = await register(agent, input);
    const oldCookie = sessionCookie(created).split(';')[0]!;
    await agent.post('/api/auth/logout').set('x-csrf-token', await csrf(agent));
    const anonymous = await agent.get('/api/auth/csrf');
    remember(anonymous);
    const loggedIn = await agent
      .post('/api/auth/login')
      .set('x-csrf-token', anonymous.body.data.token)
      .send({ email: input.email, password });
    remember(loggedIn);
    expect(loggedIn.status).toBe(200);
    const cookie = sessionCookie(loggedIn).split(';')[0]!;
    expect(cookie).not.toBe(sessionCookie(anonymous).split(';')[0]!);
    expect(
      (await request(createApp()).get('/api/auth/me').set('Cookie', cookie)).body.data.id,
    ).toBe(created.body.data.id);
    expect((await request(app).get('/api/auth/me').set('Cookie', oldCookie)).status).toBe(401);
  });
  it('rejects wrong passwords and unknown email with the same public error', async () => {
    const input = account();
    const agent = request.agent(app);
    await register(agent, input);
    const wrong = await agent
      .post('/api/auth/login')
      .set('x-csrf-token', await csrf(agent))
      .send({ email: input.email, password: 'wrong password' });
    const unknown = await agent
      .post('/api/auth/login')
      .set('x-csrf-token', await csrf(agent))
      .send({ email: 'missing@example.invalid', password: 'wrong password' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
  });
  it('invalidates logout sessions, including cookie replay', async () => {
    const agent = request.agent(app);
    const created = await register(agent);
    const cookie = sessionCookie(created).split(';')[0]!;
    expect(
      (await agent.post('/api/auth/logout').set('x-csrf-token', await csrf(agent))).status,
    ).toBe(204);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set('Cookie', cookie)).status).toBe(401);
  });
  it('rejects expired sessions from the database', async () => {
    const agent = request.agent(app);
    const created = await register(agent);
    await db.session.updateMany({
      where: { userId: created.body.data.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });
  it('requires CSRF on registration, logout, account edits, and hardware mutations', async () => {
    expect((await request(app).post('/api/auth/register').send(account())).status).toBe(403);
    expect((await owner.post('/api/auth/logout')).status).toBe(403);
    expect((await owner.patch('/api/account').send({ name: 'Invalid request' })).status).toBe(403);
    expect((await owner.post('/api/hardware-profiles').send(hardware)).status).toBe(403);
    expect(
      (
        await owner
          .post('/api/hardware-profiles')
          .set('Origin', 'https://attacker.invalid')
          .set('x-csrf-token', await csrf(owner))
          .send(hardware)
      ).status,
    ).toBe(403);
  });
  it('protects private endpoints', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect((await request(app).get('/api/hardware-profiles')).status).toBe(401);
    const anonymous = request.agent(app);
    const token = await csrf(anonymous);
    expect(
      (await anonymous.post('/api/hardware-profiles').set('x-csrf-token', token).send(hardware))
        .status,
    ).toBe(401);
  });
  it('updates the current user display name without exposing credentials', async () => {
    const response = await owner
      .patch('/api/account')
      .set('x-csrf-token', await csrf(owner))
      .send({ name: 'Updated Engineer' });
    expect(response.status).toBe(200);
    expect(response.body.data.name).toBe('Updated Engineer');
    expect(response.body.data).not.toHaveProperty('passwordHash');
  });
  it('validates registration fields and rejects unknown account fields', async () => {
    const agent = request.agent(app);
    const token = await csrf(agent);
    const response = await agent
      .post('/api/auth/register')
      .set('x-csrf-token', token)
      .send({ name: '', email: 'invalid', password: 'short' });
    expect(response.status).toBe(400);
    expect(response.body.error.fields.password).toBeDefined();
    expect(
      (
        await owner
          .patch('/api/account')
          .set('x-csrf-token', await csrf(owner))
          .send({ name: 'Engineer', email: 'new@example.invalid' })
      ).status,
    ).toBe(400);
  });
  it('rejects CSRF tokens belonging to another session', async () => {
    const token = await csrf(other);
    const response = await owner
      .patch('/api/account')
      .set('x-csrf-token', token)
      .send({ name: 'Rejected change' });
    expect(response.status).toBe(403);
  });
  it('rate limits authentication attempts', async () => {
    const isolated = createApp();
    for (let i = 0; i < 20; i++)
      expect((await request(isolated).post('/api/auth/login').send({})).status).toBe(403);
    const limited = await request(isolated).post('/api/auth/login').send({});
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('RATE_LIMITED');
  });
  it('sets Secure host-only cookies in the production TLS-proxy configuration', async () => {
    const previous = {
      node: process.env.NODE_ENV,
      origin: process.env.APP_ORIGIN,
      trust: process.env.TRUST_PROXY,
    };
    try {
      process.env.NODE_ENV = 'production';
      process.env.APP_ORIGIN = 'https://corewise.example';
      process.env.TRUST_PROXY = 'loopback';
      const response = await request(createApp())
        .get('/api/auth/csrf')
        .set('x-forwarded-proto', 'https');
      remember(response);
      expect(response.status).toBe(200);
      expect(sessionCookie(response)).toContain('__Host-corewise.sid=');
      expect(sessionCookie(response)).toContain('Secure');
      expect(sessionCookie(response)).toContain('HttpOnly');
      expect(sessionCookie(response)).not.toContain('Domain=');
    } finally {
      for (const [key, value] of Object.entries({
        NODE_ENV: previous.node,
        APP_ORIGIN: previous.origin,
        TRUST_PROXY: previous.trust,
      })) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });
});

describe('M1 user-owned hardware profiles', () => {
  it('creates, lists, retrieves, updates, and deletes real persisted records', async () => {
    const created = await owner
      .post('/api/hardware-profiles')
      .set('x-csrf-token', await csrf(owner))
      .send(hardware);
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    expect(created.body.data.provenance).toBe('USER_ENTERED');
    expect(created.body.data).not.toHaveProperty('userId');
    expect((await owner.get(`/api/hardware-profiles/${id}`)).body.data.cpuName).toBe(
      hardware.cpuName,
    );
    expect(
      (await owner.get('/api/hardware-profiles')).body.data.some(
        (p: { id: string }) => p.id === id,
      ),
    ).toBe(true);
    const updated = await owner
      .put(`/api/hardware-profiles/${id}`)
      .set('x-csrf-token', await csrf(owner))
      .send({ ...hardware, name: 'Updated workstation', ramGb: 64 });
    expect(updated.status).toBe(200);
    expect(updated.body.data.ramGb).toBe(64);
    expect(
      (await owner.delete(`/api/hardware-profiles/${id}`).set('x-csrf-token', await csrf(owner)))
        .status,
    ).toBe(204);
    expect((await owner.get(`/api/hardware-profiles/${id}`)).status).toBe(404);
  });
  it('enforces ownership for reads, updates, deletes, default, and selected profile', async () => {
    const created = await owner
      .post('/api/hardware-profiles')
      .set('x-csrf-token', await csrf(owner))
      .send(hardware);
    const id = created.body.data.id;
    expect((await other.get(`/api/hardware-profiles/${id}`)).status).toBe(404);
    expect((await other.get('/api/hardware-profiles')).body.data).toEqual([]);
    expect(
      (
        await other
          .put(`/api/hardware-profiles/${id}`)
          .set('x-csrf-token', await csrf(other))
          .send(hardware)
      ).status,
    ).toBe(404);
    expect(
      (await other.delete(`/api/hardware-profiles/${id}`).set('x-csrf-token', await csrf(other)))
        .status,
    ).toBe(404);
    for (const action of ['default', 'select'])
      expect(
        (
          await other
            .post(`/api/hardware-profiles/${id}/${action}`)
            .set('x-csrf-token', await csrf(other))
        ).status,
      ).toBe(404);
    expect((await db.hardwareProfile.findUniqueOrThrow({ where: { id } })).userId).toBe(ownerId);
  });
  it('sets one default and selection per user, replaces them, and clears them on deletion', async () => {
    const a = (
      await owner
        .post('/api/hardware-profiles')
        .set('x-csrf-token', await csrf(owner))
        .send(hardware)
    ).body.data.id;
    const b = (
      await owner
        .post('/api/hardware-profiles')
        .set('x-csrf-token', await csrf(owner))
        .send({ ...hardware, name: 'Second test system' })
    ).body.data.id;
    for (const id of [a, b])
      for (const action of ['default', 'select'])
        expect(
          (
            await owner
              .post(`/api/hardware-profiles/${id}/${action}`)
              .set('x-csrf-token', await csrf(owner))
          ).status,
        ).toBe(204);
    const me = await owner.get('/api/auth/me');
    expect(me.body.data.defaultProfileId).toBe(b);
    expect(me.body.data.selectedProfileId).toBe(b);
    await owner.delete(`/api/hardware-profiles/${b}`).set('x-csrf-token', await csrf(owner));
    const after = (await owner.get('/api/auth/me')).body.data;
    expect(after.defaultProfileId).toBeNull();
    expect(after.selectedProfileId).toBeNull();
  });
  it('rejects invalid counts, contradictory specs, foreign ownership, and forged provenance', async () => {
    for (const patch of [
      { ramGb: -1 },
      { logicalProcessors: 2 },
      { cpuMaxGhz: 1 },
      { userId: ownerId },
      { provenance: 'MEASURED' },
      { gpuName: null },
    ]) {
      const result = await owner
        .post('/api/hardware-profiles')
        .set('x-csrf-token', await csrf(owner))
        .send({ ...hardware, ...patch });
      expect(result.status).toBe(400);
    }
  });
});
