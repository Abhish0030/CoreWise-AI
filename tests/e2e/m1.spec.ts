import { test } from './test';
import { expect } from '@playwright/test';
import {
  testAccount,
  registerTestAccount,
  cleanupTestAccounts,
  createTestHardware,
} from './helpers';

test.afterAll(cleanupTestAccounts);

test('private pages redirect, registration validates, sessions persist, and logout protects pages', async ({
  page,
}) => {
  const account = testAccount();
  await page.goto('/hardware-library');
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.goto('/register');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByText('Use at least 12 characters')).toBeVisible();
  await page.getByLabel('Full name').fill(account.name);
  await page.getByLabel('Email address').fill(account.email);
  await page.getByLabel('Password', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page).toHaveURL('/hardware-library');
  await expect(page.getByText('Your hardware library starts here.')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Hardware Library.' })).toBeVisible();
  await page.getByRole('link', { name: 'Your profile', exact: true }).click();
  await expect(page.getByLabel('Email address')).toHaveValue(account.email);
  await page.getByLabel('Full name').fill('Updated Browser Engineer');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Profile updated.')).toBeVisible();
  const storage = await page.evaluate(() => ({
    local: { ...localStorage },
    session: { ...sessionStorage },
  }));
  expect(JSON.stringify(storage)).not.toContain(account.password);
  expect(JSON.stringify(storage)).not.toContain(account.email);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL('/login');
  await page.goto('/profile');
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.getByLabel('Email address').fill(account.email);
  await page.getByLabel('Password', { exact: true }).fill('incorrect passphrase');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Email or password is incorrect.' }),
  ).toBeVisible();
  await page.getByLabel('Password', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL('/profile');
});

test('hardware CRUD, details, filtering, selection, default, and confirmed deletion', async ({
  page,
}) => {
  await registerTestAccount(page.request);
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/hardware-library');
  await page.getByRole('button', { name: 'New profile' }).click();
  let form = page.getByRole('dialog', { name: 'Add a compute environment' });
  await form.getByRole('button', { name: 'Create profile', exact: true }).click();
  await expect(form.getByText('This field is required').first()).toBeVisible();
  await form.getByLabel('Profile name').fill('Browser workstation');
  await form.getByLabel('Device manufacturer').fill('User-built');
  await form.getByLabel('Device model').fill('M1 test system');
  await form.getByLabel('Operating system').fill('Test Linux');
  await form.getByLabel('CPU manufacturer').fill('User-supplied vendor');
  await form.getByLabel('CPU model').fill('User-supplied CPU');
  await form.getByLabel('Physical core count').fill('8');
  await form.getByLabel('Logical processor count').fill('16');
  await form.getByLabel('Base frequency (GHz)').fill('3.2');
  await form.getByLabel('Maximum frequency (GHz)').fill('4.8');
  await form.getByLabel('Installed RAM (GiB)').fill('32');
  await form.getByLabel('Memory type').fill('DDR5');
  await form.getByLabel('Profile description').fill('User-entered browser test data.');
  await form.getByRole('button', { name: 'Create profile', exact: true }).click();
  await expect(form).not.toBeVisible();
  let card = page.getByRole('article', { name: 'Browser workstation', exact: true });
  await expect(card).toBeVisible();
  await expect(card.getByText('USER_ENTERED')).toBeVisible();
  await card.getByRole('button', { name: 'View Browser workstation' }).click();
  await expect(
    page
      .getByRole('dialog', { name: 'Browser workstation' })
      .getByText('User-entered browser test data.'),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await card.getByRole('button', { name: 'Make Browser workstation default' }).click();
  await expect(card.getByText('DEFAULT', { exact: true })).toBeVisible();
  await card.getByRole('button', { name: 'Select profile' }).click();
  await expect(card.getByRole('button', { name: 'Selected', exact: true })).toBeDisabled();
  await page.goto('/');
  await expect(page.getByText('User-supplied CPU', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Live hardware monitoring requires a connected local agent.'),
  ).toBeVisible();
  await page.goto('/hardware-library');
  card = page.getByRole('article', { name: 'Browser workstation', exact: true });
  await card.getByRole('button', { name: 'Edit Browser workstation' }).click();
  form = page.getByRole('dialog', { name: 'Edit your system' });
  await expect(form.getByLabel('Installed RAM (GiB)')).toHaveValue('32');
  await form.getByLabel('Profile name').fill('Renamed workstation');
  await form.getByLabel('Installed RAM (GiB)').fill('64');
  await form.getByRole('button', { name: 'Save changes' }).click();
  card = page.getByRole('article', { name: 'Renamed workstation', exact: true });
  await expect(card.getByText('64 GiB · DDR5')).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search hardware profiles' }).fill('no-match');
  await expect(page.getByText('No profiles match your search.')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByRole('combobox', { name: 'Filter profiles' }).selectOption('gpu');
  await expect(page.getByText('No profiles match your search.')).toBeVisible();
  await page.getByRole('combobox', { name: 'Filter profiles' }).selectOption('all');
  await card.getByRole('button', { name: 'Delete Renamed workstation' }).click();
  await page.getByRole('button', { name: 'Keep profile' }).click();
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Delete Renamed workstation' }).click();
  await page
    .getByRole('dialog', { name: 'Delete hardware profile?' })
    .getByRole('button', { name: 'Delete profile', exact: true })
    .click();
  await expect(page.getByText('Your hardware library starts here.')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Your hardware library starts here.')).toBeVisible();
  expect(errors).toEqual([]);
});

for (const width of [375, 768, 1280, 1440]) {
  test(`M1 auth and hardware themes at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/login');
    for (const theme of ['dark', 'light']) {
      await page.getByRole('combobox', { name: 'Color theme' }).selectOption(theme);
      await expect(page.locator('html')).toHaveClass(theme);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await page.screenshot({
        path: `.artifacts/test-results/m1-login-${width}-${theme}.png`,
        fullPage: true,
      });
    }
    await registerTestAccount(page.request);
    await createTestHardware(page.request);
    await page.goto('/hardware-library');
    await expect(page.getByRole('heading', { name: 'Hardware Library.' })).toBeVisible();
    for (const theme of ['dark', 'light']) {
      await page.getByRole('combobox', { name: 'Color theme' }).selectOption(theme);
      await expect(page.locator('html')).toHaveClass(theme);
      await expect(page.getByRole('article', { name: 'Developer workstation' })).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await page.screenshot({
        path: `.artifacts/test-results/m1-library-${width}-${theme}.png`,
        fullPage: true,
      });
      await page.getByRole('button', { name: 'New profile' }).click();
      await expect(page.getByRole('dialog', { name: 'Add a compute environment' })).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await page.screenshot({
        path: `.artifacts/test-results/m1-profile-form-${width}-${theme}.png`,
        fullPage: true,
      });
      await page.keyboard.press('Escape');
    }
  });
}
