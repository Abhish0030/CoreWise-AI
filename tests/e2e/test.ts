import { test as base } from '@playwright/test';
import { setTimeout } from 'node:timers/promises';

// Keep the complete suite within the real API's per-IP rate limit. Assertions and
// production limits stay enabled; only simulated users' case-start cadence changes.
export const test = base.extend<{ requestCadence: void }>({
  requestCadence: [
    async ({ baseURL, request }, use, testInfo) => {
      if (!baseURL) throw new Error('Browser tests require the configured application origin.');
      // Every simulated user shares the API's real per-IP quota. Respect its
      // reset header before admitting another case; keep production limits intact.
      const health = await request.get(`${baseURL}/api/health`);
      const headers = health.headers();
      const budget = headers.ratelimit ?? '';
      const remaining = Number(budget.match(/\br=(\d+)/)?.[1] ?? 300);
      const reserve = /WCAG|bounded measured CPU\/GPU/.test(testInfo.title) ? 250 : 100;
      if (health.status() === 429 || remaining < reserve) {
        const seconds = Number(headers['retry-after'] ?? budget.match(/\bt=(\d+)/)?.[1] ?? 1);
        const wait = Math.min(60000, (seconds + 1) * 1000);
        testInfo.setTimeout(testInfo.timeout + wait);
        await setTimeout(wait);
      }
      await setTimeout(1500);
      await use();
    },
    { auto: true },
  ],
});
