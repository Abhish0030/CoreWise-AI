import { config } from 'dotenv';
import { basename, resolve } from 'node:path';
// Explicit launcher environments are already loaded; hosted production supplies process secrets.
if (process.env.COREWISE_ENV_LOADED !== '1' && process.env.COREWISE_DB_ENV !== 'neon-production') {
  const environment = process.env.COREWISE_DB_ENV || 'local';
  if (!['local', 'neon-development'].includes(environment))
    throw Error('Unknown database environment.');
  const root = resolve(process.cwd(), basename(process.cwd()) === 'backend' ? '..' : '.');
  const result = config({
    path: resolve(root, environment === 'local' ? '.env' : '.env.neon.development.local'),
    quiet: true,
  });
  if (result.error) throw Error('Selected private environment file is missing or unreadable.');
}
