import { expect, it } from 'vitest';
import { databaseCommandResult, sanitizeDatabaseOutput } from '../../scripts/database-output.mjs';
const env = {
  DIRECT_URL: 'postgresql://owner:private%40password@ep-fixture.neon.tech/neondb?sslmode=require',
  NEON_API_KEY: 'neon-private-key-fixture',
};
it('retains Prisma error code, migration and exit status while redacting credentials', () => {
  const report = databaseCommandResult(
    {
      status: 1,
      stdout: 'Datasource: ' + env.DIRECT_URL,
      stderr:
        'Error: P3018\nMigration name: 20261112050442_foundation\npassword=private@password\nBearer ' +
        env.NEON_API_KEY,
    },
    env,
  );
  expect(report.success).toBe(false);
  expect(report.exitCode).toBe(1);
  expect(report.prismaErrorCode).toBe('P3018');
  expect(report.migrationName).toBe('20261112050442_foundation');
  expect(JSON.stringify(report)).not.toMatch(
    /private%40password|private@password|neon-private-key-fixture|postgresql:\/\//,
  );
});
it('treats launch errors and termination signals as failures with a nonzero exit', () => {
  const failed = databaseCommandResult({ status: null, error: { code: 'ENOENT' } }, env);
  expect(failed.success).toBe(false);
  expect(failed.exitCode).toBe(1);
  expect(failed.launchError).toBe('ENOENT');
  expect(databaseCommandResult({ status: 0, signal: 'SIGTERM' }, env).success).toBe(false);
  expect(
    databaseCommandResult({ status: 0, stdout: 'No pending migrations to apply.' }, env).success,
  ).toBe(true);
});
it('preserves P3005 diagnostic text and removes unconfigured URLs and key patterns', () => {
  const report = databaseCommandResult(
    { status: 1, stderr: 'Error: P3005\nThe database schema is not empty.' },
    env,
  );
  expect(report.prismaErrorCode).toBe('P3005');
  expect(report.stderr).toContain('schema is not empty');
  const cleaned = sanitizeDatabaseOutput(
    'postgresql://someone:other-password@host/db gsk_another_fixture_key https://host/?token=private',
    {},
  );
  expect(cleaned).not.toMatch(/other-password|gsk_another|https:\/\//);
});
