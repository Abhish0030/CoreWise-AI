import { verifyDatabaseBranch } from './verify-database-branch.mjs';
// Explicit opt-in development runtime. Production uses the approved deployment runbook.
import { spawn } from 'node:child_process';
import { databaseSettings, loadDatabaseEnvironment } from './db-environment.mjs';
const environment = process.argv[2] || 'local';
try {
  if (!['local', 'neon-development'].includes(environment))
    throw Error('This development launcher cannot target production.');
  const env = loadDatabaseEnvironment(environment);
  databaseSettings(env);
  if (environment === 'neon-development') {
    const result = verifyDatabaseBranch(env, environment);
    if (!result.publicTables?.includes('_prisma_migrations'))
      throw Error('Restore the development schema/data before starting it.');
    env.COREWISE_VERIFIED_DATABASE_WRITE = 'true';
  }
  databaseSettings(env, true);
  console.log('Starting CoreWise with explicit database environment: ' + environment);
  const child = spawn(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['dev'], {
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  child.on('error', () => {
    console.error('Could not start workspace services.');
    process.exitCode = 1;
  });
  child.on('exit', (code) => {
    process.exitCode = code ?? 1;
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
