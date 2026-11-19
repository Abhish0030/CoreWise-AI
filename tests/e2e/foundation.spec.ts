import { test } from './test';
import { expect } from '@playwright/test';
import { createAssistantTestSession, cleanupTestAccounts } from './helpers';

// M0 exercises workspace behavior; M1/hydration cases cover actual auth forms.
// Real fixture sessions keep the full suite within the unchanged auth IP limit.
test.beforeEach(async ({ context }) => {
  await context.addCookies([await createAssistantTestSession()]);
});
test.afterAll(cleanupTestAccounts);

test('overview is honest, connected through Express, and interactive', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'System overview.' })).toBeVisible();
  await expect(page.getByText('API connected', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Live hardware monitoring requires a connected local agent.'),
  ).toBeVisible();
  await expect(page.getByText('SYNTHETIC_DEMO', { exact: true })).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Preview demo data' }).check();
  await expect(page.getByText('SYNTHETIC_DEMO', { exact: true })).toHaveCount(5);
  await expect(page.getByRole('img', { name: /Synthetic demonstration/ })).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export status' }).click();
  expect((await downloadPromise).suggestedFilename()).toBe('corewise-workspace-status.json');
  await page.getByRole('button', { name: 'Notifications', exact: true }).click();
  await expect(page.getByText('You’re all caught up')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Search pages' }).click();
  await page.getByRole('textbox', { name: 'Search pages' }).fill('workload');
  await page.getByRole('dialog').getByRole('link', { name: 'Workload Analyzer' }).click();
  await expect(page).toHaveURL('/workload-analyzer');
  await expect(page.getByText('ANALYTICAL ESTIMATE', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

for (const width of [375, 768, 1280, 1440]) {
  test(`responsive layout and themes at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'System overview.' })).toBeVisible();
    await expect(page.getByText('API connected', { exact: true })).toBeVisible();
    for (const theme of ['dark', 'light']) {
      await page.getByRole('combobox', { name: 'Color theme' }).selectOption(theme);
      await expect(page.locator('html')).toHaveClass(theme);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await page.screenshot({
        path: `.artifacts/test-results/overview-${width}-${theme}.png`,
        fullPage: true,
        animations: 'disabled',
      });
      await page.getByRole('checkbox', { name: 'Preview demo data' }).check();
      await expect(page.getByText('SYNTHETIC_DEMO', { exact: true })).toHaveCount(5);
      await expect(page.getByRole('img', { name: /Synthetic demonstration/ })).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await page.screenshot({
        path: `.artifacts/test-results/overview-${width}-${theme}-demo.png`,
        fullPage: true,
        animations: 'disabled',
      });
      await page.getByRole('checkbox', { name: 'Preview demo data' }).uncheck();
    }
    await page.reload();
    await expect(page.locator('html')).toHaveClass('light');
    await page.getByRole('combobox', { name: 'Color theme' }).selectOption('system');
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('html')).toHaveClass('dark');
    if (width === 375) {
      await page.getByRole('button', { name: 'Open navigation' }).click();
      await expect(page.getByRole('dialog', { name: 'Workspace navigation' })).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();
      await page
        .getByRole('navigation', { name: 'Mobile navigation' })
        .getByRole('link', { name: 'Hardware Library' })
        .click();
      await expect(page).toHaveURL('/hardware-library');
      await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).not.toBeVisible();
    }
    if (width >= 1280) {
      await page.getByRole('button', { name: 'Collapse sidebar' }).click();
      await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible();
      await page.getByRole('link', { name: 'Settings', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Appearance' })).toBeVisible();
    }
  });
}

test('all navigation destinations resolve, and unknown routes show 404', async ({ page }) => {
  for (const route of [
    'system-monitor',
    'hardware-library',
    'workload-analyzer',
    'cpu-vs-gpu',
    'benchmark-lab',
    'ml-predictions',
    'ai-assistant',
    'explainability',
    'reports',
    'settings',
  ]) {
    const response = await page.goto(`/${route}`);
    expect(response?.status()).toBe(200);
    await expect(page.locator('main h1')).toBeVisible();
  }
  const response = await page.goto('/does-not-exist');
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole('heading', { name: 'This page isn’t in your workspace.' }),
  ).toBeVisible();
});

test('keyboard search, dialog dismissal, and reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Search pages' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('database readiness and OpenAPI are served through the frontend proxy', async ({
  request,
}) => {
  const response = await request.get('/api/ready');
  expect(response.status()).toBe(200);
  expect((await response.json()).database).toBe('connected');
  const schema = await request.get('/api/openapi.json');
  expect(schema.status()).toBe(200);
  expect((await schema.json()).paths).toHaveProperty('/api/system/status');
});
