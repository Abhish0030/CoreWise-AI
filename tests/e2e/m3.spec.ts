import { test } from './test';
import { expect, type BrowserContext, type APIRequestContext } from '@playwright/test';
import { registerTestAccount, cleanupTestAccounts, createTestHardware } from './helpers';

let cookies: Awaited<ReturnType<BrowserContext['cookies']>>;
test.describe.configure({ mode: 'serial' });
test.beforeAll(async ({ playwright }) => {
  const setup = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:3000' });
  await registerTestAccount(setup);
  cookies = (await setup.storageState()).cookies;
  await setup.dispose();
});
test.beforeEach(async ({ context }) => {
  await context.addCookies(cookies);
});
test.afterAll(cleanupTestAccounts);
async function write(request: APIRequestContext, path: string, data: unknown) {
  const token = (await (await request.get('/api/auth/csrf')).json()).data.token;
  return request.post(path, { headers: { 'x-csrf-token': token }, data });
}

test('ML empty state, schema errors, CSV upload and synthetic dataset validation', async ({
  page,
}) => {
  await page.goto('/ml-predictions');
  await expect(page.getByRole('heading', { name: 'ML Predictions.' })).toBeVisible();
  await expect(page.getByText('No saved ML predictions yet.')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Generate prediction', exact: true }),
  ).toBeDisabled();
  await page.getByLabel('Upload CSV').setInputFiles({
    name: 'invalid.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('bad,columns\n1,2'),
  });
  await page.getByRole('button', { name: 'Validate and upload CSV' }).click();
  await expect(page.locator('.form-error[role=alert]')).toContainText('Missing required columns');
  await page.getByLabel('Synthetic records').fill('240');
  await page.getByRole('button', { name: 'Generate synthetic dataset' }).click();
  await expect(page.getByRole('status')).toContainText('240 records validated');
  await expect(page.getByText('Schema valid · 240 records', { exact: false })).toBeVisible();
  await page.getByText('Preview and validation policy', { exact: true }).click();
  await expect(page.getByRole('table').getByText('SYNTHETIC_DEMO', { exact: true })).toHaveCount(8);
  // Upload an actual valid, explicitly synthetic CSV through the same browser file control.
  const id = (await (await page.request.get('/api/ml/datasets')).json()).data[0].id;
  const preview = (await (await page.request.get(`/api/ml/datasets/${id}`)).json()).data.preview;
  const columns = Object.keys(preview[0]);
  const rows = Array.from({ length: 60 }, (_, i) => preview[i % preview.length]);
  const content = [
    columns.join(','),
    ...rows.map((r) => columns.map((k) => JSON.stringify(r[k] ?? '')).join(',')),
  ].join('\n');
  await page.getByLabel('Dataset name', { exact: true }).fill('Uploaded synthetic CSV');
  await page
    .getByLabel('Upload CSV')
    .setInputFiles({ name: 'synthetic.csv', mimeType: 'text/csv', buffer: Buffer.from(content) });
  await page.getByRole('button', { name: 'Validate and upload CSV' }).click();
  await expect(page.getByRole('status')).toContainText('60 records validated');
  await page.getByLabel('Dataset history').selectOption(id);
});

test('durable training, real evaluations, model activation and saved inference', async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto('/ml-predictions');
  const datasets = (await (await page.request.get('/api/ml/datasets')).json()).data;
  await page
    .getByLabel('Dataset history')
    .selectOption(datasets.find((d: { rowCount: number }) => d.rowCount === 240).id);
  await page.getByRole('button', { name: 'Start training', exact: true }).click();
  await expect(page.getByText('COMPLETED', { exact: true })).toBeVisible({ timeout: 90000 });
  await page.getByRole('button', { name: 'Refresh models' }).click();
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(7);
  await expect(
    page.getByRole('img', { name: 'Algorithm validation RMSE comparison' }),
  ).toBeVisible();
  await expect(
    page.getByRole('img', { name: 'Actual versus predicted held-out execution times' }),
  ).toBeVisible();
  await expect(page.getByRole('img', { name: 'Held-out residual visualization' })).toBeVisible();
  // Activate each validation winner through the real registry UI.
  const winners = page.getByRole('row').filter({ hasText: 'Validation winner' });
  await winners
    .filter({ hasText: 'CPU' })
    .getByRole('button', { name: 'Activate CPU', exact: true })
    .click();
  await winners
    .filter({ hasText: 'GPU' })
    .getByRole('button', { name: 'Activate GPU', exact: true })
    .click();
  await createTestHardware(page.request);
  const hardware = (await (await page.request.get('/api/hardware-profiles')).json()).data[0];
  const assumptions = {
    precision: 'FP32',
    cpuCores: 8,
    cpuPeakGflops: 300,
    cpuBandwidthGbps: 80,
    gpuPeakGflops: 5000,
    gpuBandwidthGbps: 500,
    transferBandwidthGbps: 16,
    kernelLaunchUs: 10,
    transferConvention: 'TOTAL_BYTES',
  };
  const response = await write(page.request, '/api/workloads', {
    name: 'ML browser matrix',
    category: 'MATRIX_MULTIPLICATION',
    description: 'Browser fixture',
    inputSize: 1024,
    inputUnit: 'ELEMENTS',
    operationCount: 1e9,
    arithmeticIntensity: 20,
    parallelFraction: 0.99,
    memoryMiB: 12,
    transferMiB: 12,
    repetitions: 1,
    hardwareProfileId: hardware.id,
    presetId: null,
    assumptions,
    tolerance: 0.05,
  });
  expect(response.status()).toBe(201);
  const workload = (await response.json()).data;
  await page.reload();
  await page.getByLabel('Prediction workload', { exact: true }).selectOption(workload.id);
  // Cold inference may outlast the default UI assertion deadline. Await and
  // validate the actual bounded API response before checking its rendered result.
  const predictionResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/ml/predict') && response.request().method() === 'POST',
    { timeout: 45000 },
  );
  await page.getByRole('button', { name: 'Generate prediction', exact: true }).click();
  expect((await predictionResponse).status()).toBe(201);
  await expect(page.getByTestId('ml-prediction-result')).toBeVisible();
  await expect(page.getByTestId('ml-prediction-result')).toContainText('SYNTHETIC_DEMO');
  await expect(
    page.getByRole('img', { name: 'Predicted CPU and GPU execution times' }),
  ).toBeVisible();
  await expect(page.locator('.ml-history button')).toHaveCount(1);
  await page.reload();
  await page.locator('.ml-history button').first().click();
  await expect(page.getByTestId('ml-prediction-result')).toBeVisible();
});

test('analytical and ML comparison modes remain distinct; invalid ML features show errors', async ({
  page,
}) => {
  await page.goto('/cpu-vs-gpu');
  await page.getByRole('button', { name: 'ML Prediction', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Prediction playground', exact: true }),
  ).toBeVisible();
  const workload = (await (await page.request.get('/api/workloads')).json()).data[0];
  await page.getByLabel('Prediction workload', { exact: true }).selectOption(workload.id);
  await page.getByLabel('Effective CPU throughput (GFLOP/s)', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Generate prediction', exact: true }).click();
  await expect(page.locator('.form-error[role=alert]')).toContainText('Supply valid ML features');
  await page.getByRole('button', { name: 'Analytical Estimate', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Compare devices', exact: true })).toBeVisible();
  await expect(page.getByText('ANALYTICAL ESTIMATE', { exact: true })).toBeVisible();
});

for (const width of [375, 768, 1280, 1440]) {
  test(`ML dashboard and charts at ${width}px in both themes`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/ml-predictions');
    await expect(
      page.getByRole('img', { name: 'Actual versus predicted held-out execution times' }),
    ).toBeVisible();
    for (const theme of ['dark', 'light']) {
      await page.getByRole('combobox', { name: 'Color theme' }).selectOption(theme);
      await expect(page.locator('html')).toHaveClass(theme);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: `.artifacts/test-results/m3-workspace-${width}-${theme}.png`,
        fullPage: true,
      });
    }
  });
}
