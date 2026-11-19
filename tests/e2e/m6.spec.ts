import { test } from './test';
import { expect, type BrowserContext } from '@playwright/test';
import { createAssistantTestSession, cleanupTestAccounts, createTestHardware } from './helpers';
let cookies: Awaited<ReturnType<BrowserContext['cookies']>>;
test.describe.configure({ mode: 'serial' });
test.beforeAll(async ({ playwright }) => {
  const session = await createAssistantTestSession();
  const setup = await playwright.request.newContext({
    baseURL: 'http://127.0.0.1:3000',
    storageState: { cookies: [session], origins: [] },
  });
  await createTestHardware(setup);
  cookies = (await setup.storageState()).cookies;
  await setup.dispose();
});
test.beforeEach(async ({ context }) => context.addCookies(cookies));
test.afterAll(cleanupTestAccounts);

test('unconfigured provider is explicit, with empty history and secure conversation creation', async ({
  page,
  browser,
}) => {
  const anonymous = await browser.newContext();
  const p = await anonymous.newPage();
  await p.goto('http://127.0.0.1:3000/ai-assistant');
  await expect(p).toHaveURL(/login/);
  await anonymous.close();
  await page.route('**/api/agent/status', (route) =>
    route.fulfill({
      json: {
        data: {
          configured: false,
          connection: 'UNCONFIGURED',
          provider: null,
          model: null,
          message: 'AI Assistant unavailable — configure an LLM provider.',
          limits: {
            toolCalls: 6,
            iterations: 8,
            contextMessages: 10,
            outputTokens: 1024,
            timeoutSeconds: 75,
          },
        },
      },
    }),
  );
  await page.goto('/ai-assistant');
  await expect(page.getByRole('heading', { name: 'AI Assistant.' })).toBeVisible();
  await expect(
    page.getByText('AI Assistant unavailable — configure an LLM provider.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send message', exact: true })).toBeDisabled();
  await expect(page.getByText('No conversations yet.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'New conversation', exact: true }).click();
  await expect(page.locator('.assistant-conversation')).toHaveCount(1);
});
test('real graph with mocked provider streams authorized evidence and retains history and references', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.route('**/api/agent/conversations', async (route) => {
    if (route.request().method() === 'GET') await new Promise((r) => setTimeout(r, 800));
    await route.continue();
  });
  await page.goto('/ai-assistant');
  await page
    .getByLabel('Hardware profile', { exact: true })
    .selectOption({ label: 'Developer workstation' });
  await page.getByLabel('Message CoreWise', { exact: true }).fill('Show my hardware profiles.');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByTestId('agent-message-assistant').last()).toContainText(
    'Test provider response:',
    { timeout: 60000 },
  );
  await expect(page.getByTestId('agent-message-assistant').last()).toContainText('COMPLETED');
  await expect(page.getByTestId('agent-message-assistant').last()).toContainText('USER_ENTERED');
  await expect(page.getByRole('link').filter({ hasText: 'hardware ·' }).first()).toHaveAttribute(
    'href',
    '/hardware-library',
  );
  await expect(page.locator('.assistant-evidence')).toContainText('Developer workstation');
  await page.reload();
  await expect(page.getByTestId('agent-message-assistant').last()).toContainText(
    'Test provider response:',
  );
  await page.getByLabel('Search conversations', { exact: true }).fill('Show my hardware');
  await expect(page.locator('.assistant-conversation')).toHaveCount(1);
  await page.getByLabel('Search conversations', { exact: true }).fill('');
});
test('provider failures, retry and client cancellation retain honest statuses', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto('/ai-assistant');
  await page.getByLabel('Message CoreWise', { exact: true }).fill('provider fail');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry message', exact: true })).toBeVisible({
    timeout: 60000,
  });
  await expect(page.getByTestId('agent-message-assistant').last()).toContainText('FAILED');
  await expect(page.locator('.assistant-chat')).not.toContainText('should-not-leak');
  await page.getByLabel('Message CoreWise', { exact: true }).fill('slow response');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Stop response', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Stop response', exact: true }).click();
  await expect(page.locator('.assistant-chat .form-error[role=alert]')).toContainText(
    'Response stopped.',
  );
  await expect(page.locator('.assistant-conversation')).toHaveCount(1);
});
for (const width of [375, 768, 1280, 1440])
  test(`assistant at ${width}px in both themes`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/ai-assistant');
    await expect(page.getByTestId('agent-message-assistant').first()).toContainText(
      'Test provider response:',
    );
    for (const theme of ['dark', 'light']) {
      await page.getByRole('combobox', { name: 'Color theme' }).selectOption(theme);
      await expect(page.locator('html')).toHaveClass(theme);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: `.artifacts/test-results/m6-assistant-${width}-${theme}.png`,
        fullPage: true,
      });
    }
  });
test('conversation deletion requires confirmation and removes its history', async ({ page }) => {
  await page.goto('/ai-assistant');
  await page
    .getByRole('button', { name: 'Delete Show my hardware profiles.', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByTestId('agent-message-assistant').first()).toBeVisible();
  await page
    .getByRole('button', { name: 'Delete Show my hardware profiles.', exact: true })
    .click();
  await page.getByRole('button', { name: 'Delete conversation', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByTestId('agent-message-assistant')).toHaveCount(0);
});

test('renders safe Markdown/code and reloads without hydration errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && /hydration|hydrating|#418/i.test(m.text())) errors.push(m.text());
  });
  await page.goto('/ai-assistant');
  await page
    .getByLabel('Message CoreWise', { exact: true })
    .fill('markdown fixture: show my hardware');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  const card = page.getByTestId('agent-message-assistant').last();
  await expect(card).toContainText('COMPLETED', { timeout: 60000 });
  await expect(card.locator('strong').filter({ hasText: 'Evidence summary' })).toBeVisible();
  await expect(card.locator('pre code').first()).toContainText('const evidence = true;');
  await expect(card.locator('a[href*="attacker.invalid"], img, script')).toHaveCount(0);
  await page.reload();
  await expect(card.locator('pre code').first()).toContainText('const evidence = true;');
  expect(errors).toEqual([]);
});

test('message entry precedes the transcript and suggested questions send directly', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/ai-assistant');
  await page.getByRole('button', { name: 'New conversation', exact: true }).click();
  const message = page.getByLabel('Message CoreWise', { exact: true });
  await expect(message).toBeEnabled();
  const composer = await message.boundingBox();
  const transcript = await page.locator('.assistant-messages').boundingBox();
  expect(composer!.y).toBeLessThan(transcript!.y);
  const log = page.getByRole('log', { name: 'Conversation messages' });
  await log.focus();
  await expect(log).toBeFocused();
  await page.getByLabel('Search conversations', { exact: true }).fill('hy');
  await expect(page.getByTestId('agent-message-user')).toHaveCount(0);
  await expect(message).toHaveValue('');
  await page.getByLabel('Search conversations', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Analyze my hardware.', exact: true }).click();
  await expect(page.getByTestId('agent-message-user')).toContainText('Analyze my hardware.');
  await expect(page.getByTestId('agent-message-assistant').last()).toContainText('COMPLETED', {
    timeout: 60000,
  });
  await expect(page.getByTestId('agent-message-assistant').last()).toContainText(
    'Test provider response:',
  );
});
