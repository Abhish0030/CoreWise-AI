import { test } from './test';
import { expect, type APIRequestContext, type BrowserContext } from '@playwright/test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { registerTestAccount, cleanupTestAccounts } from './helpers';
import type { BenchmarkMeasurement } from '@corewise/types';
let cookies: Awaited<ReturnType<BrowserContext['cookies']>>, runner: APIRequestContext;
let cpu: BenchmarkMeasurement,
  paired: BenchmarkMeasurement[] = [],
  agentId: string;
test.describe.configure({ mode: 'serial' });
async function write(
  context: APIRequestContext,
  path: string,
  data: unknown = {},
  authorization?: string,
) {
  const csrf = (await (await context.get('/api/auth/csrf')).json()).data.token;
  return context.post(path, {
    headers: {
      'x-csrf-token': csrf,
      ...(authorization ? { Authorization: `Bearer ${authorization}` } : {}),
    },
    data,
  });
}
test.beforeAll(async ({ playwright }) => {
  const setup = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:3000' });
  await registerTestAccount(setup);
  cookies = (await setup.storageState()).cookies;
  await setup.dispose();
  runner = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:4000' });
  const python = resolve(
    'backend/local-agent/.venv',
    process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
  );
  async function measure(size: number, gpu: boolean, reps = 5) {
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
        String(size),
        '--repetitions',
        String(reps),
        ...(gpu ? [] : ['--cpu-only']),
      ],
      {
        env: { ...process.env, PYTHONPATH: resolve('backend/local-agent') },
        timeout: 90000,
        maxBuffer: 2e6,
      },
    );
    const r = JSON.parse(stdout);
    expect(r.status).toBe('COMPLETED');
    return r.measurement as BenchmarkMeasurement;
  }
  cpu = await measure(4096, false);
  const first = await measure(4096, true, 30);
  if (first.gpu) {
    paired = [first, await measure(8192, true, 30)];
  }
}, 120000);
test.beforeEach(async ({ context }) => context.addCookies(cookies));
test.afterAll(async () => {
  await runner?.dispose();
  await cleanupTestAccounts();
});

test('empty states, explicit pairing, real CPU run, raw export and missing GPU labels', async ({
  page,
}) => {
  await page.goto('/benchmark-lab');
  await expect(page.getByRole('heading', { name: 'Benchmark Lab.' })).toBeVisible();
  await expect(page.getByText('No paired devices.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Queue benchmark', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Generate pairing code' }).click();
  const code = await page.getByLabel('One-time pairing code', { exact: false }).inputValue();
  const redemption = await write(runner, '/api/agent/redeem', {
    code,
    name: 'Browser authorized local CPU',
    environment: cpu.environment,
  });
  expect(redemption.status()).toBe(201);
  const credential = (await redemption.json()).data;
  agentId = credential.agentId;
  expect((await write(runner, '/api/agent/session', {}, credential.token)).status()).toBe(200);
  await page.getByRole('button', { name: 'Hide code' }).click();
  await page.getByRole('button', { name: 'Refresh benchmark data' }).click();
  await expect(page.getByText('CPU · DETECTED', { exact: true })).toBeVisible();
  await expect(page.getByText(cpu.environment.cpuModel!, { exact: false })).toBeVisible();
  await page.getByLabel('Input size', { exact: false }).fill('4096');
  await page.getByLabel('Measure GPU when supported').uncheck();
  await page.getByRole('button', { name: 'Queue benchmark', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Nothing starts automatically');
  const claim = await write(runner, '/api/agent/claim');
  const job = (await claim.json()).data;
  expect(job.config.gpu).toBe(false);
  const submission = await write(runner, `/api/agent/jobs/${job.id}/result`, {
    status: 'COMPLETED',
    measurement: cpu,
  });
  expect(submission.status()).toBe(201);
  await page.getByRole('button', { name: 'Refresh benchmark data' }).click();
  await expect(page.getByTestId('benchmark-result')).toBeVisible();
  await expect(page.getByTestId('benchmark-result')).toContainText('Unavailable');
  await expect(page.getByTestId('benchmark-result')).toContainText('CORRECTNESS VALID');
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Export raw CSV' }).click();
  expect((await download).suggestedFilename()).toBe('corewise-measured-runs.csv');
  await page.locator('.benchmark-run-selection input').check();
  await page
    .getByLabel('Capability source / calibration reference')
    .fill('No external capability measurements supplied');
  await page.getByRole('button', { name: 'Export ML-compatible CSV' }).click();
  await expect(page.getByRole('status')).toContainText('Missing GPU target');
  await page.getByRole('button', { name: 'Save measured dataset', exact: true }).click();
  await expect(page.locator('.form-error[role=alert]')).toContainText(
    'valid paired end-to-end measurements',
  );
});
test('queued cancellation does not execute hardware work', async ({ page }) => {
  await page.goto('/benchmark-lab');
  await page.getByRole('button', { name: 'Queue benchmark', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cancel benchmark', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel benchmark', exact: true }).click();
  await expect(page.getByText('CANCELLED', { exact: true })).toBeVisible();
});
test('real paired measurements export a compatible measured dataset for M3', async ({ page }) => {
  test.skip(
    paired.length !== 2 || paired.some((m) => !m.gpu),
    'No compatible CUDA/CuPy backend; paired hardware test unavailable.',
  );
  for (const m of paired) {
    const j = await write(page.request, '/api/benchmarks/jobs', { agentId, config: m.config });
    expect(j.status()).toBe(201);
    const job = (await j.json()).data;
    await write(runner, '/api/agent/claim');
    const r = await write(runner, `/api/agent/jobs/${job.id}/result`, {
      status: 'COMPLETED',
      measurement: m,
    });
    expect(r.status(), await r.text()).toBe(201);
  }
  await page.goto('/benchmark-lab');
  await expect(
    page.getByRole('img', { name: 'Measured CPU versus GPU execution times' }),
  ).toBeVisible();
  await expect(
    page.getByRole('img', { name: 'Raw measured timing sample distribution' }),
  ).toBeVisible();
  await expect(
    page.getByRole('img', { name: 'Measured execution time by input size' }),
  ).toBeVisible();
  await page
    .locator('.benchmark-run-selection label')
    .filter({ hasText: 'CPU + GPU' })
    .first()
    .getByRole('checkbox')
    .check();
  await page
    .locator('.benchmark-run-selection label')
    .filter({ hasText: 'CPU + GPU' })
    .nth(1)
    .getByRole('checkbox')
    .check();
  // Explicit test-only capability assumptions; never represented as measured calibration.
  for (const [id, value] of Object.entries({
    cpu_gflops: 100,
    cpu_bandwidth_gbps: 50,
    gpu_gflops: 1000,
    gpu_bandwidth_gbps: 200,
    transfer_bandwidth_gbps: 10,
    launch_overhead_us: 10,
    parallel_fraction: 0.99,
  }))
    await page.locator(`#export-${id}`).fill(String(value));
  await page
    .getByLabel('Capability source / calibration reference')
    .fill('Explicit USER_ENTERED test-only schema assumptions; not hardware calibration');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export ML-compatible CSV' }).click();
  expect((await download).suggestedFilename()).toBe('corewise-measured-ml-v1.csv');
  await page.getByRole('button', { name: 'Save measured dataset', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Measured dataset saved: 60 rows');
  const datasets = (await (await page.request.get('/api/ml/datasets')).json()).data;
  expect(
    datasets.some(
      (d: { provenance: string; rowCount: number }) =>
        d.provenance === 'MEASURED' && d.rowCount === 60,
    ),
  ).toBe(true);
});
for (const width of [375, 768, 1280, 1440])
  test(`measured lab at ${width}px in both themes`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/benchmark-lab');
    await expect(page.getByTestId('benchmark-result')).toBeVisible();
    for (const theme of ['dark', 'light']) {
      await page.getByRole('combobox', { name: 'Color theme' }).selectOption(theme);
      await expect(page.locator('html')).toHaveClass(theme);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: `.artifacts/test-results/m4-lab-${width}-${theme}.png`,
        fullPage: true,
      });
    }
  });
