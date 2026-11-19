import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { expect, type APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const db = new PrismaClient();
const createdEmails: string[] = [];
export function testAccount() {
  const email = `browser-m1-${randomUUID()}@example.invalid`;
  createdEmails.push(email);
  return { name: 'Browser Test Engineer', email, password: 'browser test passphrase 2026' };
}
export async function registerTestAccount(request: APIRequestContext) {
  const input = testAccount();
  const token = (await (await request.get('/api/auth/csrf')).json()).data.token;
  const response = await request.post('/api/auth/register', {
    headers: { 'x-csrf-token': token },
    data: input,
  });
  expect(response.status()).toBe(201);
  return input;
}
// M6 tests exercise authenticated assistant workflows, not registration. Use a real
// PostgreSQL session signed by express-session's existing library, so the complete
// suite does not exhaust the unchanged production auth limit (20 per 15 minutes).
export async function createAssistantTestSession() {
  const account = testAccount(),
    require = createRequire(resolve('backend/package.json'));
  const argon2 = require('argon2') as { hash: (password: string) => Promise<string> };
  const signature = require('cookie-signature') as {
    sign: (value: string, secret: string) => string;
  };
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw Error('Test session secret is not configured.');
  const user = await db.user.create({
    data: {
      name: account.name,
      email: account.email,
      passwordHash: await argon2.hash(account.password),
    },
  });
  const id = randomUUID(),
    expiresAt = new Date(Date.now() + 1800000);
  await db.session.create({
    data: {
      id,
      userId: user.id,
      expiresAt,
      data: JSON.stringify({
        userId: user.id,
        authExpiresAt: expiresAt.getTime(),
        cookie: {
          originalMaxAge: 1800000,
          expires: expiresAt.toISOString(),
          secure: false,
          httpOnly: true,
          path: '/',
          sameSite: 'lax',
        },
      }),
    },
  });
  return {
    name: 'corewise.sid',
    value: encodeURIComponent(`s:${signature.sign(id, secret)}`),
    domain: '127.0.0.1',
    path: '/',
    httpOnly: true,
    secure: false,
    sameSite: 'Lax' as const,
    expires: expiresAt.getTime() / 1000,
  };
}
export async function cleanupTestAccounts() {
  const models = await db.mLModel.findMany({
    where: { user: { email: { in: createdEmails } } },
    select: { id: true },
  });
  const root = resolve(process.env.ML_ARTIFACT_ROOT ?? 'backend/ml/artifacts');
  for (const model of models) {
    if (!/^[0-9a-f-]{36}$/.test(model.id)) throw Error('Unexpected test model ID');
    await unlink(resolve(root, `${model.id}.joblib`)).catch((err: NodeJS.ErrnoException) => {
      if (err.code !== 'ENOENT') throw err;
    });
  }
  await db.user.deleteMany({ where: { email: { in: createdEmails } } });
  await db.$disconnect();
}
export async function clearTestWorkspace(email: string) {
  if (!createdEmails.includes(email)) throw new Error('Refusing to clean a non-fixture workspace');
  const user = await db.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
  await db.comparisonResult.deleteMany({ where: { userId: user.id } });
  await db.workload.deleteMany({ where: { userId: user.id } });
  await db.hardwareProfile.deleteMany({ where: { userId: user.id } });
}
export async function createTestHardware(request: APIRequestContext) {
  const token = (await (await request.get('/api/auth/csrf')).json()).data.token;
  const response = await request.post('/api/hardware-profiles', {
    headers: { 'x-csrf-token': token },
    data: {
      name: 'Developer workstation',
      manufacturer: 'User-built system',
      deviceModel: 'Browser test fixture',
      os: 'User-supplied Linux',
      description: 'A user-entered test fixture for responsive UI verification.',
      cpuManufacturer: 'User-supplied vendor',
      cpuName: 'User-supplied 8-core processor',
      physicalCores: 8,
      logicalProcessors: 16,
      cpuBaseGhz: 3.2,
      cpuMaxGhz: 4.8,
      gpuManufacturer: 'User-supplied vendor',
      gpuName: 'User-supplied graphics',
      vramGb: 12,
      memoryBandwidthGbps: null,
      computeCapability: null,
      ramGb: 32,
      memoryType: 'DDR5',
      memoryFrequencyMhz: null,
    },
  });
  expect(response.status()).toBe(201);
}
