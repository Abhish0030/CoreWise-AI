import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './.artifacts/test-results/playwright',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  // Match the existing bounded API request window, including cold local/remote I/O.
  expect: { timeout: 30_000 },
  use: { baseURL: 'http://127.0.0.1:3000', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel: 'msedge' } }],
  webServer: [
    {
      command: 'pnpm exec tsx tests/fixtures/llm-provider.ts --serve',
      url: 'http://127.0.0.1:8123/health',
      reuseExistingServer: false,
      timeout: 60000,
    },
    {
      command: 'pnpm dev:ml',
      env: {
        LLM_PROVIDER: 'openai-compatible',
        LLM_API_KEY: 'fixture-key-never-production',
        LLM_MODEL: 'corewise-test-model',
        LLM_BASE_URL: 'http://127.0.0.1:8123/v1',
      },
      url: 'http://127.0.0.1:8000/health',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'pnpm --filter @corewise/api start',
      url: 'http://127.0.0.1:4000/api/health',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'pnpm --filter @corewise/web start',
      url: 'http://127.0.0.1:3000',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
