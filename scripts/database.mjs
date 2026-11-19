import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { databaseCommandResult, sanitizeDatabaseOutput } from './database-output.mjs';
import { verifyDatabaseBranch } from './verify-database-branch.mjs';
import { spawnSync } from 'node:child_process';
import { databaseSettings, loadDatabaseEnvironment } from './db-environment.mjs';
const args = process.argv.slice(2);
const environment = args[args.indexOf('--environment') + 1] || 'local';
const command = args.at(-1);
try {
  const env = loadDatabaseEnvironment(environment);
  if (args.includes('--approve-production')) env.ALLOW_PRODUCTION_DB_WRITE = 'approved-cutover';
  databaseSettings(env);
  if (command === 'migrate' && environment !== 'local') {
    verifyDatabaseBranch(env, environment);
    env.COREWISE_VERIFIED_DATABASE_WRITE = 'true';
  }
  databaseSettings(env, command === 'migrate');
  const commands = {
    status: ['migrate', 'status'],
    migrate: ['migrate', 'deploy'],
    validate: ['validate'],
  };
  if (!commands[command]) throw Error('Use status, migrate or validate.');
  const cli = createRequire(import.meta.url).resolve('prisma/build/index.js');
  const result = spawnSync(
    process.execPath,
    [cli, ...commands[command], '--config', resolve('prisma.config.ts')],
    {
      env,
      encoding: 'utf8',
      shell: false,
      maxBuffer: 1024 * 1024,
    },
  );
  const diagnostics = databaseCommandResult(result, env);
  console.log(JSON.stringify({ environment, operation: command, ...diagnostics }));
  process.exitCode = diagnostics.success ? 0 : diagnostics.exitCode || 1;
} catch (e) {
  console.error(sanitizeDatabaseOutput(e.message, process.env));
  process.exitCode = 1;
}
