import { test } from './test';
import { expect, type BrowserContext, type APIRequestContext } from '@playwright/test';
import { registerTestAccount, cleanupTestAccounts, createTestHardware } from './helpers';
let cookies: Awaited<ReturnType<BrowserContext['cookies']>>, predictionId: string;
test.describe.configure({ mode: 'serial' });
test.beforeAll(async ({ playwright }) => {
  const setup = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:3000' });
  await registerTestAccount(setup);
  cookies = (await setup.storageState()).cookies;
  await setup.dispose();
});
test.beforeEach(async ({ context }) => context.addCookies(cookies));
test.afterAll(cleanupTestAccounts);
async function write(request: APIRequestContext, path: string, data: unknown) {
  const csrf = (await (await request.get('/api/auth/csrf')).json()).data.token;
  return request.post(path, { headers: { 'x-csrf-token': csrf }, data });
}
test('empty explanation states and model readiness are honest', async ({ page }) => {
  await page.goto('/explainability');
  await expect(page.getByRole('heading', { name: 'Explainability.' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Compute global importance', exact: true }),
  ).toBeDisabled();
  await expect(page.getByText('No saved SHAP explanations.', { exact: true })).toBeVisible();
  await expect(page.getByText('No saved ML predictions yet.', { exact: false })).toBeVisible();
});
test('real models, global importance, prediction selection and additive local waterfalls', async ({
  page,
}) => {
  test.setTimeout(180000);
  const dataset = await write(page.request, '/api/ml/datasets', {
    name: 'M5 browser synthetic',
    mode: 'SYNTHETIC',
    count: 120,
    seed: 42,
  });
  expect(dataset.status()).toBe(201);
  const job = await write(page.request, '/api/ml/training-jobs', {
    datasetId: (await dataset.json()).data.id,
  });
  expect(job.status()).toBe(202);
  const jobId = (await job.json()).data.id;
  await expect
    .poll(
      async () =>
        (await (await page.request.get(`/api/ml/training-jobs/${jobId}`)).json()).data.status,
      { timeout: 90000, intervals: [1500] },
    )
    .toBe('COMPLETED');
  const models = (await (await page.request.get('/api/ml/models')).json()).data;
  const cpu = models.find(
      (m: { target: string; algorithm: string }) =>
        m.target === 'CPU' && m.algorithm === 'RANDOM_FOREST',
    ),
    gpu = models.find(
      (m: { target: string; algorithm: string }) => m.target === 'GPU' && m.algorithm === 'XGBOOST',
    );
  for (const m of [cpu, gpu])
    expect(
      (await write(page.request, `/api/ml/models/${m.id}/activate`, { active: true })).status(),
    ).toBe(200);
  await createTestHardware(page.request);
  const hardware = (await (await page.request.get('/api/hardware-profiles')).json()).data[0];
  const assumptions = {
    precision: 'FP32',
    cpuCores: 8,
    cpuPeakGflops: 300,
    cpuBandwidthGbps: 80,
    gpuPeakGflops: 5000,
    gpuBandwidthGbps: 600,
    transferBandwidthGbps: 16,
    kernelLaunchUs: 10,
    transferConvention: 'TOTAL_BYTES',
  };
  const workload = await write(page.request, '/api/workloads', {
    name: 'M5 browser workload',
    category: 'MATRIX_MULTIPLICATION',
    description: 'Explicit test assumptions',
    inputSize: 1024,
    inputUnit: 'ELEMENTS',
    operationCount: 1e9,
    arithmeticIntensity: 20,
    parallelFraction: 0.95,
    memoryMiB: 12,
    transferMiB: 12,
    repetitions: 3,
    hardwareProfileId: hardware.id,
    presetId: null,
    assumptions,
    tolerance: 0.05,
  });
  expect(workload.status()).toBe(201);
  const prediction = await write(page.request, '/api/ml/predict', {
    workloadId: (await workload.json()).data.id,
    hardwareProfileId: hardware.id,
    assumptions,
  });
  expect(prediction.status(), await prediction.text()).toBe(201);
  predictionId = (await prediction.json()).data.id;
  await page.goto('/explainability');
  await page.getByLabel('Training background sample limit', { exact: true }).fill('16');
  await page.getByLabel('Held-out evaluation sample limit', { exact: true }).fill('8');
  await page.getByRole('button', { name: 'Compute global importance', exact: true }).click();
  await expect(page.getByTestId('global-cpu')).toBeVisible({ timeout: 90000 });
  await expect(page.getByTestId('global-gpu')).toBeVisible({ timeout: 90000 });
  await expect(
    page.getByRole('img', { name: 'Separate CPU and GPU model SHAP importance comparison' }),
  ).toBeVisible();
  await expect(page.getByTestId('global-cpu')).toContainText('SYNTHETIC_DEMO');
  await page.getByLabel('Saved prediction to explain', { exact: true }).selectOption(predictionId);
  await page.getByLabel('Local background sample limit', { exact: true }).fill('16');
  await page.getByRole('button', { name: 'Explain saved prediction', exact: true }).click();
  await expect(page.getByTestId('explanation-cpu')).toBeVisible({ timeout: 90000 });
  await expect(page.getByTestId('explanation-gpu')).toBeVisible({ timeout: 90000 });
  await expect(
    page.getByRole('img', { name: 'CPU SHAP waterfall in log milliseconds' }),
  ).toBeVisible();
  await expect(page.getByTestId('explanation-cpu')).toContainText('not milliseconds');
  const records = (
    await (await page.request.get(`/api/explanations/prediction/${predictionId}`)).json()
  ).data;
  const local = records.find((r: { status: string }) => r.status === 'COMPLETED').result;
  for (const target of ['CPU', 'GPU']) {
    const r = local.models[target];
    expect(
      Math.abs(
        r.baselineOutput +
          r.contributions.reduce((sum: number, c: { value: number }) => sum + c.value, 0) -
          r.finalOutput,
      ),
    ).toBeLessThanOrEqual(r.additivity.tolerance);
  }
});
test('comparison page uses separate CPU/GPU explanations and cached saved versions', async ({
  page,
}) => {
  await page.goto('/cpu-vs-gpu');
  await page.getByRole('button', { name: 'ML Prediction', exact: true }).click();
  await page.locator('.ml-history button').first().click();
  await expect(page.getByTestId('ml-prediction-result')).toBeVisible();
  await page.getByRole('button', { name: 'Explain saved prediction', exact: true }).click();
  await expect(page.getByTestId('explanation-cpu')).toBeVisible({ timeout: 90000 });
  await expect(page.getByTestId('explanation-gpu')).toBeVisible({ timeout: 90000 });
  await expect(page.getByTestId('explanation-cpu')).toContainText('not speedup attributions');
});
test('invalid sample limits and unsupported family errors are actionable', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/explainability');
  await page.getByLabel('Training background sample limit', { exact: true }).fill('1000');
  await page.getByRole('button', { name: 'Compute global importance', exact: true }).click();
  await expect(page.locator('.form-error[role=alert]')).toContainText('Use 8–128');
  await page.getByLabel('Training background sample limit', { exact: true }).fill('16');
  await page
    .getByLabel('Workload family filter (optional)', { exact: true })
    .fill('unknown family');
  await page.getByRole('button', { name: 'Compute global importance', exact: true }).click();
  await expect(
    page.locator('.form-error[role=alert]').filter({ hasText: 'two held-out' }).first(),
  ).toBeVisible({ timeout: 90000 });
});
for (const width of [375, 768, 1280, 1440])
  test(`SHAP charts at ${width}px in both themes`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/explainability');
    await expect(page.getByTestId('explanation-cpu')).toBeVisible();
    await expect(page.getByTestId('global-cpu')).toBeVisible();
    await expect(page.getByTestId('global-gpu')).toBeVisible();
    for (const theme of ['dark', 'light']) {
      await page.getByRole('combobox', { name: 'Color theme' }).selectOption(theme);
      await expect(page.locator('html')).toHaveClass(theme);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: `.artifacts/test-results/m5-shap-${width}-${theme}.png`,
        fullPage: true,
      });
    }
  });
