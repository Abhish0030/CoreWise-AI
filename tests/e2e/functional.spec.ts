import { test } from './test';
import { expect, type APIRequestContext, type BrowserContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { blankWorkload, emptyCapabilities } from '@corewise/types';
import { cleanupTestAccounts, createAssistantTestSession } from './helpers';

test.describe.configure({ mode: 'serial' });
let cookies: Awaited<ReturnType<BrowserContext['cookies']>>;
let runner: APIRequestContext;
let hardwareId: string;
async function post(request: APIRequestContext, path: string, data: unknown = {}, token?: string) {
  const csrf = (await (await request.get('/api/auth/csrf')).json()).data.token;
  return request.post(path, {
    headers: { 'x-csrf-token': csrf, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    data,
  });
}
async function python(code: string) {
  const result = await promisify(execFile)(
    resolve(
      'backend/local-agent/.venv',
      process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
    ),
    ['-c', code],
    { env: { ...process.env, PYTHONPATH: resolve('backend/local-agent') }, timeout: 30000 },
  );
  return JSON.parse(result.stdout);
}
test.beforeAll(async ({ playwright }) => {
  cookies = [await createAssistantTestSession()];
  runner = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:3000' });
});
test.beforeEach(async ({ context }) => context.addCookies(cookies));
test.afterAll(async () => {
  await runner.dispose();
  await cleanupTestAccounts();
});

test('onboards actual detected hardware and retains unknown performance capabilities', async ({
  page,
}) => {
  await page.goto('/');
  const journey = page.getByRole('region', { name: 'Workload prediction journey' });
  await expect(journey.getByRole('button', { name: 'Import detected hardware' })).toBeDisabled();
  await journey.getByText('Pair a runner and sample telemetry', { exact: true }).click();
  await expect(
    journey.getByText('pnpm agent monitor --samples 30 --interval 2', { exact: false }),
  ).toBeVisible();
  const environment = await python(
    'import json; from corewise_runner.detection import detect; print(json.dumps(detect()))',
  );
  const pair = (await (await post(page.request, '/api/benchmarks/pairing')).json()).data.code;
  const redeem = await post(runner, '/api/agent/redeem', {
    code: pair,
    name: 'Browser actual detected runner',
    environment,
  });
  expect(redeem.status()).toBe(201);
  const token = (await redeem.json()).data.token;
  expect((await post(runner, '/api/agent/session', {}, token)).status()).toBe(200);
  await page.reload();
  await journey.getByRole('button', { name: 'Import detected hardware' }).click();
  await expect(
    journey.getByText(
      'Detected hardware imported and selected. Unknown capabilities remain blank.',
    ),
  ).toBeVisible();
  const profiles = (await (await page.request.get('/api/hardware-profiles')).json()).data;
  hardwareId = profiles[0].id;
  expect(profiles[0].ramGb).toBe(environment.totalRamBytes / 2 ** 30);
  expect(profiles[0].cpuBaseGhz).toBeNull();
  expect(profiles[0].provenance).toBe('MEASURED');
});

test('shows actual telemetry and withholds it after the freshness deadline', async ({ page }) => {
  const sample = await python(
    'import json; from corewise_runner.telemetry import sample; print(json.dumps(sample()))',
  );
  expect((await post(runner, '/api/agent/telemetry', sample)).status()).toBe(200);
  await page.goto('/system-monitor');
  await expect(page.getByText('FRESH', { exact: true })).toBeVisible();
  await expect(
    page.getByText(`CPU ${sample.cpuUtilizationPercent}% · source psutil`, { exact: true }),
  ).toBeVisible();
  if (sample.cpuTemperatureC === null)
    await expect(page.getByText('CPU temperature Unsupported')).toBeVisible();
  await expect
    .poll(
      async () =>
        (await (await page.request.get('/api/hardware/connection')).json()).data.agents[0].status,
      { timeout: 21000, intervals: [1000] },
    )
    .toBe('STALE');
  await page.reload();
  await expect(page.getByText('STALE', { exact: true })).toBeVisible();
  await expect(page.getByText('No fresh sample.', { exact: false })).toBeVisible();
  await expect(
    page.getByText(`CPU ${sample.cpuUtilizationPercent}% · source psutil`, { exact: true }),
  ).toHaveCount(0);
});

test('explains missing models/capabilities and queues only an explicitly bounded job', async ({
  page,
}) => {
  const response = await post(page.request, '/api/workloads', {
    ...blankWorkload,
    name: 'Browser functional vector',
    category: 'VECTOR_ADDITION',
    inputSize: 4096,
    operationCount: 4096,
    arithmeticIntensity: 1 / 12,
    parallelFraction: 1,
    memoryMiB: (4096 * 12) / 2 ** 20,
    transferMiB: (4096 * 12) / 2 ** 20,
    hardwareProfileId: hardwareId,
    assumptions: { ...emptyCapabilities },
  });
  expect(response.status()).toBe(201);
  await page.goto('/');
  await page.getByRole('button', { name: 'Predict and recommend', exact: true }).click();
  const result = page.getByTestId('optimization-result');
  await expect(result.getByRole('heading', { name: 'More evidence required' })).toBeVisible();
  await expect(result.getByText('ML: Not ready', { exact: true })).toBeVisible();
  await expect(result.getByText('No active compatible CPU model.', { exact: false })).toBeVisible();
  await expect(result.getByText('Analytical requirements:', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Queue bounded benchmark', exact: true }).click();
  await expect(
    page.getByText('Queued only. Run pnpm agent run --execute locally, then refresh measurements.'),
  ).toBeVisible();
  const jobs = (await (await page.request.get('/api/benchmarks/jobs')).json()).data;
  expect(jobs[0].status).toBe('QUEUED');
  expect(jobs[0].config).toMatchObject({ threads: 1, repetitions: 5, timeoutSeconds: 30 });
});

test('keeps the journey accessible and responsive in both themes', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Workload prediction journey' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  for (const theme of ['dark', 'light']) {
    await page.getByRole('combobox', { name: 'Color theme', exact: true }).selectOption(theme);
    await expect(page.locator('html')).toHaveClass(theme);
    for (const width of [375, 768, 1280, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true);
      await page.screenshot({
        path: '.artifacts/test-results/functional-' + width + '-' + theme + '.png',
        fullPage: true,
      });
    }
    const scan = await new AxeBuilder({ page })
      .include('.functional-journey')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(scan.violations).toEqual([]);
  }
});
