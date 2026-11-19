import { defineConfig } from '@playwright/test';
import base from './playwright.config';

const development = process.env.COREWISE_HYDRATION_MODE !== 'production';
const reuseExistingServer = process.env.COREWISE_HYDRATION_REUSE === '1';
export default defineConfig({
  ...base,
  testMatch: /hydration\.spec\.ts/,
  webServer: [
    {
      command: development ? 'pnpm dev:api' : 'pnpm --filter @corewise/api start',
      env: { LOG_LEVEL: 'silent' },
      url: 'http://127.0.0.1:4000/api/health',
      reuseExistingServer,
      timeout: 120000,
    },
    {
      command: development
        ? 'pnpm --filter @corewise/web dev'
        : 'pnpm --filter @corewise/web start',
      url: 'http://127.0.0.1:3000',
      reuseExistingServer,
      timeout: 120000,
    },
  ],
});
