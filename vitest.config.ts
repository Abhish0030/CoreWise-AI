import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    // Hardware suites share the runner's deliberate single-process OS lock.
    fileParallelism: false,
    include: ['backend/tests/**/*.test.ts'],
    env: {
      LOG_LEVEL: 'silent',
      SESSION_SECRET: 'integration-test-only-secret-not-for-deployment-2026',
    },
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
