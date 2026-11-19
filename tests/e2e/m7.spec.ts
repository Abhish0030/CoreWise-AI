import { test } from './test';
import AxeBuilder from '@axe-core/playwright';
import { expect, type BrowserContext, type APIRequestContext } from '@playwright/test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import {
  type BenchmarkMeasurement,
  blankWorkload,
  emptyCapabilities,
  reportResponseSchema,
} from '@corewise/types';
import { registerTestAccount, createAssistantTestSession, cleanupTestAccounts } from './helpers';
let cookies: Awaited<ReturnType<BrowserContext['cookies']>>,
  hardwareId: string,
  workloadId: string,
  comparisonId: string,
  predictionId: string,
  explanationId: string,
  reportId: string,
  uiReportId: string;
const runIds: string[] = [];
test.describe.configure({ mode: 'serial' });
async function post(
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
  const setup = await playwright.request.newContext({
    baseURL: 'http://127.0.0.1:3000',
    ...(process.env.M7_FULL_LIVE_AUTH === '1'
      ? {}
      : { storageState: { cookies: [await createAssistantTestSession()], origins: [] } }),
  });
  if (process.env.M7_FULL_LIVE_AUTH === '1') {
    const account = await registerTestAccount(setup);
    expect((await post(setup, '/api/auth/logout')).status()).toBe(204);
    expect(
      (
        await post(setup, '/api/auth/login', { email: account.email, password: account.password })
      ).status(),
    ).toBe(200);
  }
  cookies = (await setup.storageState()).cookies;
  await setup.dispose();
});
test.beforeEach(async ({ context }) => context.addCookies(cookies));
test.afterAll(cleanupTestAccounts);
test('empty reports, private routes and settings are honest', async ({ page, browser }) => {
  const anonymous = await browser.newContext();
  const p = await anonymous.newPage();
  await p.goto('http://127.0.0.1:3000/reports');
  await expect(p).toHaveURL(/login/);
  await p.goto('http://127.0.0.1:3000/settings');
  await expect(p).toHaveURL(/login/);
  await anonymous.close();
  await page.goto('/reports');
  await expect(page.getByRole('heading', { name: 'Reports.' })).toBeVisible();
  await expect(page.getByText('No generated reports yet.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Preview report', exact: true }).click();
  await expect(page.locator('.reports-workspace>.form-error')).toContainText('Select 1–12');
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Appearance', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save default hardware' })).toBeDisabled();
  await expect(page.getByText('No paired benchmark runner.', { exact: true })).toBeVisible();
});
test('bounded measured CPU/GPU samples flow through dataset, models, prediction, SHAP, assistant and exports', async ({
  page,
  playwright,
}) => {
  test.setTimeout(300000);
  const python = resolve(
    'backend/local-agent/.venv',
    process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
  );
  async function measure(size: number) {
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
        '10',
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
  const first = await measure(50000);
  test.skip(
    !first.gpu,
    'CUDA/CuPy unavailable: full paired measured training chain cannot be verified.',
  );
  const measured = [first];
  for (const n of [75000, 100000, 125000, 150000, 175000]) measured.push(await measure(n));
  expect(measured.every((m) => m.valid && m.gpu)).toBe(true);
  const runner = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:4000' });
  try {
    const pairing = await post(page.request, '/api/benchmarks/pairing');
    expect(pairing.status()).toBe(201);
    const code = (await pairing.json()).data.code;
    const redeem = await post(runner, '/api/agent/redeem', {
      code,
      name: 'M7 explicitly authorized integration runner',
      environment: first.environment,
    });
    expect(redeem.status()).toBe(201);
    const credential = (await redeem.json()).data;
    expect((await post(runner, '/api/agent/session', {}, credential.token)).status()).toBe(200);
    for (const m of measured) {
      const queued = await post(page.request, '/api/benchmarks/jobs', {
        agentId: credential.agentId,
        config: m.config,
      });
      expect(queued.status()).toBe(201);
      const job = (await queued.json()).data;
      const claimed = await post(runner, '/api/agent/claim');
      expect((await claimed.json()).data.id).toBe(job.id);
      const result = await post(runner, `/api/agent/jobs/${job.id}/result`, {
        status: 'COMPLETED',
        measurement: m,
      });
      expect(result.status(), await result.text()).toBe(201);
      runIds.push((await result.json()).data.id);
    }
  } finally {
    await runner.dispose();
  }
  const capabilities = {
    cpu_gflops: 100,
    cpu_bandwidth_gbps: 50,
    gpu_gflops: 1000,
    gpu_bandwidth_gbps: 200,
    transfer_bandwidth_gbps: 10,
    launch_overhead_us: 10,
    parallel_fraction: 0.99,
    source:
      'Explicit USER_ENTERED test-only schema assumptions, not measured hardware calibration. No accuracy claim.',
  };
  const dataset = await post(page.request, '/api/benchmarks/datasets', { runIds, capabilities });
  expect(dataset.status(), await dataset.text()).toBe(201);
  const d = (await dataset.json()).data;
  expect(d.provenance).toBe('MEASURED');
  expect(d.rowCount).toBe(60);
  const trained = await post(page.request, '/api/ml/training-jobs', {
    datasetId: d.id,
    algorithms: ['LINEAR'],
  });
  expect(trained.status()).toBe(202);
  const trainingId = (await trained.json()).data.id;
  await expect
    .poll(
      async () =>
        (await (await page.request.get(`/api/ml/training-jobs/${trainingId}`)).json()).data.status,
      { timeout: 90000, intervals: [1500] },
    )
    .toBe('COMPLETED');
  const models = (await (await page.request.get('/api/ml/models')).json()).data;
  for (const m of models) {
    expect(m.provenance).toBe('MEASURED');
    expect(
      (await post(page.request, `/api/ml/models/${m.id}/activate`, { active: true })).status(),
    ).toBe(200);
  }
  const e = first.environment;
  const hardware = await post(page.request, '/api/hardware-profiles', {
    name: 'M7 measured-review workstation',
    manufacturer: 'User-supplied local system',
    deviceModel: 'Integration review',
    os: e.os,
    description:
      'USER_ENTERED copy of runner identity for integration. Capability values are explicit test assumptions, not measured calibration.',
    cpuManufacturer: 'User supplied',
    cpuName: e.cpuModel ?? 'Unknown CPU',
    physicalCores: e.physicalCores,
    logicalProcessors: e.logicalCpus,
    cpuBaseGhz: null,
    cpuMaxGhz: null,
    gpuManufacturer: 'User supplied',
    gpuName: e.gpuRuntime?.model ?? null,
    vramGb: e.gpuRuntime ? e.gpuRuntime.memoryBytes / 1e9 : null,
    memoryBandwidthGbps: 200,
    computeCapability: null,
    ramGb: Math.max(1, Math.floor(e.totalRamBytes / 1e9)),
    memoryType: 'Unknown',
    memoryFrequencyMhz: null,
  });
  expect(hardware.status()).toBe(201);
  hardwareId = (await hardware.json()).data.id;
  const assumptions = {
    ...emptyCapabilities,
    cpuCores: e.physicalCores,
    cpuPeakGflops: 100,
    cpuBandwidthGbps: 50,
    gpuPeakGflops: 1000,
    gpuBandwidthGbps: 200,
    transferBandwidthGbps: 10,
    kernelLaunchUs: 10,
  };
  const workload = await post(page.request, '/api/workloads', {
    ...blankWorkload,
    name: 'M7 vector workload - test assumptions',
    category: 'VECTOR_ADDITION',
    inputSize: 100000,
    inputUnit: 'ELEMENTS',
    operationCount: 100000,
    arithmeticIntensity: 1 / 12,
    parallelFraction: 0.99,
    memoryMiB: 1200000 / 2 ** 20,
    transferMiB: 1200000 / 2 ** 20,
    repetitions: 1,
    hardwareProfileId: hardwareId,
    assumptions,
  });
  expect(workload.status(), await workload.text()).toBe(201);
  workloadId = (await workload.json()).data.id;
  const comparison = await post(page.request, '/api/analytical/compare', {
    workloadId,
    hardwareProfileId: hardwareId,
    assumptions,
    tolerance: 0.05,
  });
  expect(comparison.status()).toBe(201);
  comparisonId = (await comparison.json()).data.id;
  const prediction = await post(page.request, '/api/ml/predict', {
    workloadId,
    hardwareProfileId: hardwareId,
    assumptions,
  });
  expect(prediction.status(), await prediction.text()).toBe(201);
  predictionId = (await prediction.json()).data.id;
  const optimized = await post(page.request, '/api/optimization/preview', {
    workloadId,
    hardwareProfileId: hardwareId,
    predictionId,
  });
  expect(optimized.status(), await optimized.text()).toBe(200);
  const decision = (await optimized.json()).data;
  expect(decision.readiness.ml.ready).toBe(true);
  expect(decision.recommendation.basis).toBe('PREDICTED');
  expect(decision.mlPrediction.models.CPU.id).toBe(
    models.find((m: { target: string }) => m.target === 'CPU').id,
  );
  const agents = (await (await page.request.get('/api/benchmarks/agents')).json()).data;
  const imported = await post(page.request, '/api/hardware/import-hardware', {
    agentId: agents[0].id,
    name: 'Exact measured journey fixture',
    setDefault: false,
  });
  expect(imported.status()).toBe(201);
  const importedId = (await imported.json()).data.id;
  const exactWorkload = await post(page.request, '/api/workloads', {
    ...blankWorkload,
    name: 'Exact measured journey vector',
    category: 'VECTOR_ADDITION',
    inputSize: first.config.size,
    operationCount: first.config.size,
    arithmeticIntensity: 1 / 12,
    parallelFraction: 1,
    memoryMiB: (first.config.size * 12) / 2 ** 20,
    transferMiB: (first.config.size * 12) / 2 ** 20,
    hardwareProfileId: importedId,
    assumptions,
  });
  expect(exactWorkload.status()).toBe(201);
  const verified = await post(page.request, '/api/optimization/preview', {
    workloadId: (await exactWorkload.json()).data.id,
    hardwareProfileId: importedId,
    benchmarkId: runIds[0],
  });
  expect(verified.status(), await verified.text()).toBe(200);
  const measuredDecision = (await verified.json()).data;
  expect(measuredDecision.recommendation).toMatchObject({ basis: 'MEASURED', validated: true });
  expect(measuredDecision.readiness.ml.ready).toBe(true);
  expect(Number.isFinite(measuredDecision.comparison.cpuErrorPercent)).toBe(true);
  expect(Number.isFinite(measuredDecision.comparison.gpuErrorPercent)).toBe(true);
  const explanation = await post(page.request, '/api/explanations', {
    kind: 'LOCAL',
    predictionId,
    backgroundLimit: 8,
  });
  expect(explanation.status()).toBe(202);
  explanationId = (await explanation.json()).data.id;
  await expect
    .poll(
      async () =>
        (await (await page.request.get(`/api/explanations/${explanationId}`)).json()).data.status,
      { timeout: 90000, intervals: [1500] },
    )
    .toBe('COMPLETED');
  const conversation = await post(page.request, '/api/agent/conversations', {
    title: 'M7 real evidence, mocked provider review',
  });
  const conversationId = (await conversation.json()).data.id;
  const chat = await post(page.request, `/api/agent/conversations/${conversationId}/stream`, {
    content: 'Explain my latest prediction.',
    context: { hardwareProfileId: hardwareId, workloadId },
  });
  expect(chat.status()).toBe(200);
  expect(await chat.text()).toContain('event: complete');
  expect(await chat.text()).toContain('PREDICTED');
  const r = await post(
    page.request,
    '/api/reports',
    reportConfig('Measured integration review - test assumptions'),
  );
  expect(r.status(), await r.text()).toBe(201);
  const saved = reportResponseSchema.parse(await r.json()).data;
  reportId = saved.id;
  expect(saved.snapshot.sources.benchmarks).toHaveLength(6);
  expect(saved.snapshot.sources.predictions[0]?.result.models.CPU.datasetProvenance).toBe(
    'MEASURED',
  );
  expect(saved.snapshot.sections.some((s) => s.chart?.unit === 'ln(ms)')).toBe(true);
  const pdf = await page.request.get(`/api/reports/${reportId}/download`),
    csv = await page.request.get(`/api/reports/${reportId}/download?format=csv`);
  expect(pdf.status()).toBe(200);
  expect(csv.status()).toBe(200);
  expect(await csv.text()).toContain('ln(ms)');
  expect(await csv.text()).toContain('MEASURED');
  // Keep measured fixture evidence separate from Playwright's disposable output.
  const evidenceDir = resolve('.artifacts/evidence', reportId);
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resolve(evidenceDir, 'corewise-evidence-review.pdf'), await pdf.body());
  await writeFile(
    resolve(evidenceDir, 'm7-flow-evidence.json'),
    JSON.stringify(
      {
        provider: 'MOCKED - not external verification',
        calibration: 'USER_ENTERED test assumptions - not measured calibration',
        measuredRuns: measured.map((m) => ({
          size: m.config.size,
          cpuMedianMs: m.cpu.summary.medianMs,
          gpuMedianMs: m.gpu?.summary.medianMs,
          scope: m.config.scope,
          valid: m.valid,
        })),
        reportId,
        sourceCount: saved.sourceCount,
      },
      null,
      2,
    ),
  );
});
function reportConfig(title: string) {
  return {
    title,
    type: 'OVERVIEW',
    hardwareProfileId: hardwareId,
    workloadIds: [workloadId],
    comparisonIds: [comparisonId],
    predictionIds: [predictionId],
    benchmarkIds: runIds,
    explanationIds: [explanationId],
  };
}
test('report builder previews, generates, downloads and reopens immutable history', async ({
  page,
}) => {
  test.skip(!reportId, 'Paired measured integration is unavailable.');
  await page.goto('/reports');
  await page.getByLabel('Report title', { exact: true }).fill('M7 UI evidence report');
  await page.getByLabel('Hardware profile (optional)', { exact: true }).selectOption(hardwareId);
  for (const group of [
    'Workloads',
    'Analytical comparisons',
    'ML predictions',
    'Measured benchmark runs',
    'Completed SHAP explanations',
  ]) {
    for (const box of await page
      .getByRole('group', { name: group, exact: true })
      .getByRole('checkbox')
      .all())
      await box.check();
  }
  await page.getByRole('button', { name: 'Preview report', exact: true }).click();
  await expect(page.getByTestId('report-result')).toContainText('PREVIEW · NOT SAVED');
  await page.getByRole('button', { name: 'Generate report', exact: true }).click();
  await expect(page.getByTestId('report-result')).toContainText('SAVED · IMMUTABLE');
  await expect(page.getByTestId('report-result')).toContainText('ln(ms)');
  const history = (await (await page.request.get('/api/reports')).json()).data;
  uiReportId = history.find((r: { title: string }) => r.title === 'M7 UI evidence report').id;
  for (const format of ['PDF', 'CSV']) {
    const dl = page.waitForEvent('download');
    await page.getByRole('button', { name: `Download ${format}`, exact: true }).click();
    expect((await dl).suggestedFilename()).toBe(`corewise-${uiReportId}.${format.toLowerCase()}`);
  }
  await page.reload();
  await page
    .getByRole('button', { name: 'Open report M7 UI evidence report', exact: true })
    .click();
  await expect(page.getByTestId('report-result')).toContainText('M7 UI evidence report');
  expect(
    await page.evaluate(() =>
      Boolean((window as unknown as Record<string, unknown>).reportInjection),
    ),
  ).toBe(false);
});
test('dashboard/settings integrate actual owned state, account/default changes and system theme', async ({
  page,
}) => {
  test.skip(!hardwareId, 'Measured integration fixture unavailable.');
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Saved project evidence' })).toContainText(
    'Latest prediction',
  );
  await expect(page.getByRole('region', { name: 'Saved project evidence' })).toContainText(
    'MEASURED',
  );
  await page.goto('/settings');
  await page.getByLabel('Display name', { exact: true }).fill('M7 Review Engineer');
  await page.getByRole('button', { name: 'Save account settings' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Account settings saved.' }),
  ).toBeVisible();
  await page.getByLabel('Default hardware', { exact: true }).selectOption(hardwareId);
  await page.getByRole('button', { name: 'Save default hardware' }).click();
  await expect(page.getByText('Default hardware profile saved.', { exact: true })).toBeVisible();
  await expect(
    page.getByText('M7 explicitly authorized integration runner', { exact: false }),
  ).toBeVisible();
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.getByLabel('Theme preference', { exact: true }).selectOption('system');
  await expect(page.locator('html')).toHaveClass('light');
  await page.reload();
  await expect(page.getByLabel('Theme preference', { exact: true })).toHaveValue('system');
});
for (const width of [375, 768, 1280, 1440])
  test(`reports and settings at ${width}px in both themes`, async ({ page }) => {
    test.skip(!uiReportId, 'Measured integration fixture unavailable.');
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ['dark', 'light']) {
      await page.goto('/reports');
      await page.getByRole('combobox', { name: 'Color theme', exact: true }).selectOption(theme);
      await page
        .getByRole('button', { name: 'Open report M7 UI evidence report', exact: true })
        .click();
      await expect(page.getByTestId('report-result')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: `.artifacts/test-results/m7-reports-${width}-${theme}.png`,
        fullPage: true,
      });
      await page.goto('/settings');
      await expect(page.getByRole('heading', { name: 'Appearance', exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: `.artifacts/test-results/m7-settings-${width}-${theme}.png`,
        fullPage: true,
      });
    }
  });
test('report deletion confirms intent and preserves original evidence', async ({ page }) => {
  test.skip(!uiReportId, 'Measured integration fixture unavailable.');
  await page.goto('/reports');
  await page
    .getByRole('button', { name: 'Delete report M7 UI evidence report', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect((await page.request.get(`/api/reports/${uiReportId}`)).status()).toBe(200);
  await page
    .getByRole('button', { name: 'Delete report M7 UI evidence report', exact: true })
    .click();
  await page.getByRole('button', { name: 'Delete report', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect((await page.request.get(`/api/reports/${uiReportId}`)).status()).toBe(404);
  expect((await page.request.get(`/api/reports/${reportId}`)).status()).toBe(200);
  expect((await (await page.request.get('/api/benchmarks/runs')).json()).data).toHaveLength(6);
});
test('automated WCAG A/AA checks cover implemented pages and both report/settings themes', async ({
  page,
  browser,
}) => {
  test.setTimeout(180000);
  const issues: {
    route: string;
    id: string;
    impact: string | null | undefined;
    targets: unknown[];
  }[] = [];
  async function audit(route: string) {
    const r = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    for (const v of r.violations)
      issues.push({ route, id: v.id, impact: v.impact, targets: v.nodes.map((n) => n.target) });
  }
  for (const route of [
    '/',
    '/profile',
    '/hardware-library',
    '/workload-analyzer',
    '/cpu-vs-gpu',
    '/benchmark-lab',
    '/ml-predictions',
    '/explainability',
    '/ai-assistant',
    '/reports',
    '/settings',
  ]) {
    await page.goto(route);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toBeVisible();
    if (route === '/reports' && reportId)
      await page.locator('.report-history-open').first().click();
    await audit(route);
  }
  for (const route of ['/reports', '/settings']) {
    await page.goto(route);
    await page.getByRole('combobox', { name: 'Color theme', exact: true }).selectOption('light');
    await audit(route + ' light');
  }
  const anonymous = await browser.newContext();
  const p = await anonymous.newPage();
  for (const route of ['/login', '/register']) {
    await p.goto('http://127.0.0.1:3000' + route);
    const r = await new AxeBuilder({ page: p })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    for (const v of r.violations)
      issues.push({ route, id: v.id, impact: v.impact, targets: v.nodes.map((n) => n.target) });
  }
  await anonymous.close();
  await writeFile(
    resolve('.artifacts/test-results/m7-accessibility.json'),
    JSON.stringify(issues, null, 2),
  );
  expect(issues, JSON.stringify(issues)).toEqual([]);
});
