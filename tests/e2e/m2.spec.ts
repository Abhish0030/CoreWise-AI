import { test } from './test';
import { expect, type APIRequestContext, type BrowserContext } from '@playwright/test';
import {
  registerTestAccount,
  cleanupTestAccounts,
  clearTestWorkspace,
  createTestHardware,
} from './helpers';

let cookies: Awaited<ReturnType<BrowserContext['cookies']>>;
let email: string;
test.beforeAll(async ({ playwright }) => {
  // One actual registration for this file respects production authentication limits.
  const setup = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:3000' });
  const account = await registerTestAccount(setup);
  email = account.email;
  cookies = (await setup.storageState()).cookies;
  await setup.dispose();
});
test.beforeEach(async ({ context }) => {
  await context.addCookies(cookies);
});
test.afterEach(async () => {
  await clearTestWorkspace(email);
});
test.afterAll(cleanupTestAccounts);
async function write(request: APIRequestContext, path: string, data?: unknown, method = 'POST') {
  const token = (await (await request.get('/api/auth/csrf')).json()).data.token;
  return request.fetch(path, {
    method,
    headers: { 'x-csrf-token': token },
    ...(data ? { data } : {}),
  });
}
async function hardware(request: APIRequestContext) {
  await createTestHardware(request);
  const profile = (await (await request.get('/api/hardware-profiles')).json()).data[0];
  expect((await write(request, `/api/hardware-profiles/${profile.id}/default`)).status()).toBe(204);
  return profile.id as string;
}
async function seed(request: APIRequestContext) {
  const hardwareId = await hardware(request);
  const assumptions = {
    precision: 'FP32',
    cpuPeakGflops: 100,
    cpuBandwidthGbps: 100,
    cpuCores: null,
    gpuPeakGflops: 1000,
    gpuBandwidthGbps: 500,
    transferBandwidthGbps: 12,
    kernelLaunchUs: 5,
    transferConvention: 'TOTAL_BYTES',
  };
  const response = await write(request, '/api/workloads', {
    name: 'Responsive analytical workload',
    category: 'MATRIX_MULTIPLICATION',
    description: 'Explicit user-supplied test fixture',
    inputSize: 1024,
    inputUnit: 'MATRIX_DIMENSION',
    operationCount: 2147483648,
    arithmeticIntensity: 1024 / 6,
    parallelFraction: 0.99,
    memoryMiB: 12,
    transferMiB: 12,
    repetitions: 1,
    hardwareProfileId: hardwareId,
    presetId: null,
    assumptions,
    tolerance: 0.05,
  });
  expect(response.status()).toBe(201);
  const workload = (await response.json()).data;
  const comparison = await write(request, '/api/analytical/compare', {
    workloadId: workload.id,
    assumptions,
    tolerance: 0.05,
  });
  expect(comparison.status()).toBe(201);
  return { workload, comparison: (await comparison.json()).data };
}

test('empty states, editable presets, workload creation/editing/duplication/deletion, and analysis', async ({
  page,
}) => {
  const id = await hardware(page.request);
  await page.goto('/cpu-vs-gpu');
  await expect(page.getByRole('heading', { name: 'No analytical comparison yet.' })).toBeVisible();
  await page.goto('/workload-analyzer');
  await expect(page.getByText('No saved workloads yet.', { exact: false })).toBeVisible();
  await expect(page.getByLabel('Selected hardware profile')).toHaveValue(id);
  await page.getByRole('button', { name: 'Save workload', exact: true }).click();
  await expect(page.getByText('Enter a workload name', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Matrix multiplication', exact: true }).click();
  await expect(page.getByText('SYNTHETIC_DEMO', { exact: true })).toBeVisible();
  await page.getByLabel('Workload name', { exact: true }).fill('Browser M2 workload');
  await page.getByLabel('Aggregate CPU peak (GFLOP/s)').fill('100');
  await page.getByLabel('CPU memory bandwidth (GB/s)').fill('100');
  await page.getByLabel('Aggregate GPU peak (GFLOP/s)').fill('1000');
  await page.getByLabel('GPU memory bandwidth (GB/s)').fill('500');
  await page.getByLabel('Host–device bandwidth (GB/s)').fill('12');
  await page.getByLabel('Kernel-launch overhead (µs)').fill('5');
  await page.getByRole('button', { name: 'Save workload', exact: true }).click();
  await expect(page.getByText('Workload saved.', { exact: true })).toBeVisible();
  await page.getByLabel('Workload name', { exact: true }).fill('Edited browser workload');
  await page.getByRole('button', { name: 'Save workload', exact: true }).click();
  const picker = page.getByRole('complementary', { name: 'Workload selection' });
  await expect(picker.getByRole('button', { name: /Edited browser workload/ })).toBeVisible();
  await page.getByRole('button', { name: 'Duplicate', exact: true }).click();
  await expect(page.getByText('Workload duplicated.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Workload name', { exact: true })).toHaveValue(
    'Edited browser workload (copy)',
  );
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Keep workload', exact: true }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Delete workload?' })
    .getByRole('button', { name: 'Delete workload', exact: true })
    .click();
  await expect(
    picker.getByRole('button', { name: /Edited browser workload \(copy\)/ }),
  ).toHaveCount(0);
  await picker.getByRole('button', { name: /Edited browser workload/ }).click();
  await page.getByRole('button', { name: 'Analyze', exact: true }).click();
  await expect(page).toHaveURL(/\/cpu-vs-gpu\?comparison=/);
  await expect(
    page.getByRole('heading', { name: 'GPU estimated faster', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('img', { name: /Analytical execution times/ })).toBeVisible();
  await expect(page.getByRole('img', { name: /Analytical timing breakdown/ })).toBeVisible();
  await expect(page.getByRole('img', { name: /Analytical speedup ratio/ })).toBeVisible();
  await expect(page.getByText('cw-analytical-1.0.0', { exact: true })).toBeVisible();
  await page.goto('/');
  await expect(page.getByText(/GPU estimated faster ·/)).toBeVisible();
  await page.getByRole('link', { name: /Edited browser workload Saved workload/ }).click();
  await expect(page.getByLabel('Workload name', { exact: true })).toHaveValue(
    'Edited browser workload',
  );
});

test('missing capabilities are honest, profile changes clear assumptions, and CPU can win', async ({
  page,
}) => {
  const { workload } = await seed(page.request);
  await page.goto('/cpu-vs-gpu');
  await page.getByLabel('Saved workload', { exact: true }).selectOption(workload.id);
  await page.getByText('Review performance assumptions before comparing', { exact: true }).click();
  await page.getByLabel('Host–device bandwidth (GB/s)').fill('0.001');
  await page.getByRole('button', { name: 'Compare devices', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'CPU estimated faster', exact: true }),
  ).toBeVisible();
  await createTestHardware(page.request);
  await page.reload();
  const profiles = (await (await page.request.get('/api/hardware-profiles')).json()).data;
  await page.getByLabel('Saved workload', { exact: true }).selectOption(workload.id);
  await page
    .getByLabel('Hardware profile for this run', { exact: true })
    .selectOption(profiles[0].id);
  await page.getByText('Review performance assumptions before comparing', { exact: true }).click();
  await expect(page.getByLabel('Aggregate CPU peak (GFLOP/s)')).toHaveValue('');
  await page.getByRole('button', { name: 'Compare devices', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Insufficient hardware data', exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: 'Required information' })
      .getByText('CPU peak (GFLOP/s)', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Comparison charts require valid estimates for both devices.'),
  ).toBeVisible();
});

for (const width of [375, 768, 1280, 1440]) {
  test(`M2 analytical layouts and charts at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const { workload, comparison } = await seed(page.request);
    await page.goto(`/workload-analyzer?workload=${workload.id}`);
    await expect(page.getByLabel('Workload name', { exact: true })).toHaveValue(workload.name);
    for (const theme of ['dark', 'light']) {
      await page.getByRole('combobox', { name: 'Color theme' }).selectOption(theme);
      await expect(page.locator('html')).toHaveClass(theme);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await page.screenshot({
        path: `.artifacts/test-results/m2-analyzer-${width}-${theme}.png`,
        fullPage: true,
      });
    }
    await page.goto(`/cpu-vs-gpu?comparison=${comparison.id}`);
    await expect(page.getByRole('img', { name: /Analytical execution times/ })).toBeVisible();
    for (const theme of ['dark', 'light']) {
      await page.getByRole('combobox', { name: 'Color theme' }).selectOption(theme);
      await expect(page.locator('html')).toHaveClass(theme);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await page.screenshot({
        path: `.artifacts/test-results/m2-comparison-${width}-${theme}.png`,
        fullPage: true,
      });
    }
  });
}
