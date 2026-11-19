import { test } from './test';
import { expect, type Page } from '@playwright/test';
import { registerTestAccount, cleanupTestAccounts, createTestHardware } from './helpers';

test.use({ locale: 'en-IN', timezoneId: 'Asia/Kolkata' });

let account: Awaited<ReturnType<typeof registerTestAccount>>;
test.beforeAll(async ({ playwright }) => {
  const request = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:3000' });
  account = await registerTestAccount(request);
  expect((await request.get('/')).status()).toBe(200);
  await request.dispose();
});
test.afterAll(cleanupTestAccounts);

function captureHydrationErrors(page: Page) {
  const errors: string[] = [];
  const capture = (message: string) => {
    if (/hydration|hydrating|didn't match|did not match|server rendered|#418/i.test(message))
      errors.push(message);
  };
  page.on('pageerror', (error) => capture(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') capture(message.text());
  });
  return errors;
}
async function login(page: Page) {
  await page.goto('/login?next=/');
  await page.getByLabel('Email address', { exact: true }).fill(account.email);
  await page.getByLabel('Password', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL('/', { timeout: 30000 });
  await expect(page.locator('.dashboard-personal')).toBeVisible();
}
test('server HTML and hydrated homepage share the authenticated snapshot', async ({ page }) => {
  const errors = captureHydrationErrors(page);
  const csrf = (await (await page.request.get('/api/auth/csrf')).json()).data.token;
  expect(
    (
      await page.request.post('/api/auth/login', {
        headers: { 'x-csrf-token': csrf },
        data: { email: account.email, password: account.password },
      })
    ).status(),
  ).toBe(200);
  const response = await page.goto('/');
  await expect(page.getByRole('region', { name: 'Workload prediction journey' })).toBeVisible();
  expect(await response!.text()).toMatch(/<section[^>]+aria-label="Workload prediction journey"/);
  expect(errors).toEqual([]);
});
for (const theme of ['dark', 'light']) {
  test(`authenticated direct navigation and hard refresh hydrate in ${theme}`, async ({ page }) => {
    const errors = captureHydrationErrors(page);
    await login(page);
    await expect(page.getByText('API connected', { exact: true })).toBeVisible();
    await page.getByRole('combobox', { name: 'Color theme', exact: true }).selectOption(theme);
    await expect(page.locator('html')).toHaveClass(theme);
    const response = await page.goto('/');
    const html = await response!.text();
    expect(html).toMatch(/<section[^>]+aria-label="Workload prediction journey"/);
    expect(html.includes(account.password)).toBe(false);
    const session = (await page.context().cookies()).find(
      (cookie) => cookie.name === 'corewise.sid',
    );
    expect(session).toBeDefined();
    expect(html.includes(session!.value)).toBe(false);
    expect(html.includes(decodeURIComponent(session!.value))).toBe(false);
    expect(response!.headers()['cache-control']).toContain('no-store');
    await expect(page.locator('.dashboard-personal')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('region', { name: 'Workload prediction journey' })).toBeVisible();
    await expect(page.locator('html')).toHaveClass(theme);
    expect(errors).toEqual([]);
  });
  test(`anonymous direct navigation and hard refresh hydrate in ${theme}`, async ({ page }) => {
    const errors = captureHydrationErrors(page);
    const response = await page.goto('/');
    const html = await response!.text();
    expect(html).not.toContain(account.email);
    expect(html).not.toMatch(/<section[^>]+aria-label="Workload prediction journey"/);
    await expect(page.getByText('API connected', { exact: true })).toBeVisible();
    await page.getByRole('combobox', { name: 'Color theme', exact: true }).selectOption(theme);
    await expect(page.locator('html')).toHaveClass(theme);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'System overview.' })).toBeVisible();
    await expect(page.locator('.dashboard-personal')).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Workload prediction journey' })).toHaveCount(0);
    await expect(page.locator('html')).toHaveClass(theme);
    expect(errors).toEqual([]);
  });
}
test('server session stays personal while client session revalidation is pending', async ({
  page,
}) => {
  const errors = captureHydrationErrors(page);
  await login(page);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/auth/me', async (route) => {
    await pending;
    await route.continue();
  });
  try {
    const response = await page.goto('/');
    expect(await response!.text()).toMatch(/<section[^>]+aria-label="Workload prediction journey"/);
    await expect(page.locator('.dashboard-personal')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Workload prediction journey' })).toBeVisible();
  } finally {
    release();
    await page.unrouteAll({ behavior: 'wait' });
  }
  expect(errors).toEqual([]);
});
test('login, profile selection and logout do not resurrect cached personal state', async ({
  page,
}) => {
  const errors = captureHydrationErrors(page);
  await page.goto('/');
  await expect(page.locator('.dashboard-personal')).toHaveCount(0);
  await login(page);
  await createTestHardware(page.request);
  await page.goto('/hardware-library');
  const selectedProfile = page.waitForResponse(
    (response) =>
      /\/api\/hardware-profiles\/[^/]+\/select$/.test(response.url()) &&
      response.request().method() === 'POST',
  );
  await page
    .getByRole('article', { name: 'Developer workstation' })
    .getByRole('button', { name: 'Select profile', exact: true })
    .click();
  expect((await selectedProfile).status()).toBe(204);
  let releaseProfiles!: () => void;
  const profilesPending = new Promise<void>((resolve) => {
    releaseProfiles = resolve;
  });
  await page.route('**/api/hardware-profiles', async (route) => {
    await profilesPending;
    await route.continue();
  });
  try {
    await page.goto('/');
    await expect(
      page.locator('.hero').getByText('Loading selected hardware…', { exact: true }),
    ).toBeVisible();
    await expect(page.locator('.dashboard-personal')).toBeVisible();
  } finally {
    releaseProfiles();
    await page.unrouteAll({ behavior: 'wait' });
  }
  await expect(page.getByText('User-supplied 8-core processor', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('User-supplied 8-core processor', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL('/login');
  const response = await page.goto('/');
  expect(await response!.text()).not.toContain('User-supplied 8-core processor');
  await expect(page.locator('.dashboard-personal')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('region', { name: 'Workload prediction journey' })).toHaveCount(0);
  expect(errors).toEqual([]);
});
