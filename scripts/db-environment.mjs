import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';
export function databaseSettings(env, writing = false) {
  const environment = env.COREWISE_DB_ENV || 'local';
  if (!['local', 'neon-development', 'neon-production'].includes(environment))
    throw Error('Unknown database environment.');
  const parse = (value) => {
    try {
      const u = new URL(value);
      if (
        !['postgres:', 'postgresql:'].includes(u.protocol) ||
        !u.username ||
        !u.password ||
        !u.pathname ||
        u.pathname === '/'
      )
        throw Error();
      return u;
    } catch {
      throw Error('Database connection configuration is invalid; details withheld.');
    }
  };
  const pooled = parse(env.DATABASE_URL);
  const direct = parse(env.DIRECT_URL || env.DATABASE_URL);
  const local = (u) => ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
  if (environment === 'local') {
    if (!local(pooled) || !local(direct))
      throw Error(
        'Local commands cannot target a remote database. Select an explicit database environment.',
      );
  } else {
    for (const u of [pooled, direct])
      if (
        !u.hostname.endsWith('.neon.tech') ||
        !['require', 'verify-full'].includes(u.searchParams.get('sslmode'))
      )
        throw Error('Neon requires TLS and an actual Neon endpoint.');
    if (
      !pooled.hostname.includes('-pooler.') ||
      direct.hostname.includes('-pooler.') ||
      pooled.hostname.replace('-pooler.', '.') !== direct.hostname ||
      pooled.pathname !== direct.pathname ||
      pooled.username !== direct.username
    )
      throw Error('Neon pooled/direct endpoints must match the same database and role.');
    if (env.NEON_CREDENTIALS_ROTATED !== 'true')
      throw Error('Explicitly attest newly rotated Neon credentials before connecting.');
    if (
      !env.NEON_BRANCH_NAME ||
      (environment === 'neon-development' && /^(production|main)$/i.test(env.NEON_BRANCH_NAME))
    )
      throw Error('Development requires an explicitly identified nonproduction Neon branch.');
    if (
      writing &&
      environment === 'neon-production' &&
      env.ALLOW_PRODUCTION_DB_WRITE !== 'approved-cutover'
    )
      throw Error('Production writes require explicit approved cutover authorization.');
  }
  if (writing && environment !== 'local' && env.COREWISE_VERIFIED_DATABASE_WRITE !== 'true') {
    throw Error('Remote writes require verified branch proof through the guarded database helper.');
  }
  return { environment, url: env.DATABASE_URL, directUrl: env.DIRECT_URL || env.DATABASE_URL };
}

export function loadDatabaseEnvironment(environment = 'local', inherited = process.env) {
  if (!['local', 'neon-development', 'neon-production'].includes(environment))
    throw Error('Unknown database environment.');
  const file = environment === 'local' ? '.env' : `.env.${environment.replace('-', '.')}.local`;
  let values;
  try {
    values = parse(readFileSync(file));
  } catch {
    throw Error('Selected private environment file is missing or unreadable.');
  }
  const env = { ...inherited };
  for (const key of [
    'DATABASE_URL',
    'DIRECT_URL',
    'NEON_BRANCH_NAME',
    'NEON_CREDENTIALS_ROTATED',
    'NEON_PROJECT_ID',
    'NEON_API_KEY',
    'NEON_BRANCH_ID',
    'COREWISE_VERIFIED_DATABASE_WRITE',
    'ALLOW_PRODUCTION_DB_WRITE',
  ])
    delete env[key];
  return { ...env, ...values, COREWISE_DB_ENV: environment, COREWISE_ENV_LOADED: '1' };
}
