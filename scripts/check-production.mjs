import { databaseSettings } from './db-environment.mjs';
// Validate a supplied process environment without printing credentials or contacting services.
import { pathToFileURL } from 'node:url';
export function productionIssues(env) {
  const issues = [];
  if (env.DATABASE_URL?.includes('.neon.tech')) {
    try {
      databaseSettings(env);
    } catch {
      issues.push(
        'Neon requires explicit environment, rotated credentials, matching direct/pooled TLS URLs and branch selection.',
      );
    }
  }
  if (env.NODE_ENV !== 'production') issues.push('NODE_ENV must be production.');
  for (const key of ['SESSION_SECRET', 'ML_INTERNAL_TOKEN'])
    if (!env[key] || env[key].length < 32 || /replace|change.?me|your.secret/i.test(env[key]))
      issues.push(`${key} must be a unique random value of at least 32 characters.`);
  if (env.SESSION_SECRET && env.SESSION_SECRET === env.ML_INTERNAL_TOKEN)
    issues.push('Session and internal-service credentials must be different.');
  try {
    const u = new URL(env.APP_ORIGIN);
    if (
      u.protocol !== 'https:' ||
      u.username ||
      u.password ||
      u.pathname !== '/' ||
      u.search ||
      u.hash
    )
      throw Error();
  } catch {
    issues.push('APP_ORIGIN must be an exact HTTPS origin.');
  }
  for (const key of ['API_ORIGIN', 'ML_ORIGIN', 'AGENT_API_ORIGIN'])
    try {
      const u = new URL(env[key]);
      if (
        !['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname) ||
        u.protocol !== 'http:' ||
        u.username ||
        u.password ||
        u.pathname !== '/' ||
        u.search ||
        u.hash
      )
        throw Error();
    } catch {
      issues.push(`${key} must be a loopback HTTP origin for the single-host reference topology.`);
    }
  try {
    const u = new URL(env.DATABASE_URL);
    if (
      !['postgresql:', 'postgres:'].includes(u.protocol) ||
      !u.username ||
      !u.password ||
      /replace|corewise_local|change.?me/i.test(u.password)
    )
      throw Error();
    if (
      !['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname) &&
      u.searchParams.get('sslmode') !== 'require'
    )
      throw Error();
  } catch {
    issues.push(
      'DATABASE_URL must use private credentials; remote PostgreSQL requires sslmode=require.',
    );
  }
  if (env.HOST !== '127.0.0.1')
    issues.push('HOST must remain 127.0.0.1 in the single-host topology.');
  if (env.TRUST_PROXY !== 'loopback')
    issues.push('TRUST_PROXY must be loopback behind the reference proxy.');
  if (!env.ML_ARTIFACT_ROOT || !/^(\/|[A-Za-z]:[\\/])/.test(env.ML_ARTIFACT_ROOT))
    issues.push('ML_ARTIFACT_ROOT must be an absolute private persistent directory.');
  if (
    Object.entries(env).some(
      ([k, v]) =>
        k.startsWith('NEXT_PUBLIC_') && v && /secret|token|key|password|database/i.test(k),
    )
  )
    issues.push('Secrets must never use NEXT_PUBLIC_ variables.');
  if (env.LLM_API_KEY || env.LLM_PROVIDER || env.LLM_MODEL || env.GROQ_API_KEY) {
    const groq = env.LLM_PROVIDER === 'groq';
    if (
      groq
        ? !env.GROQ_API_KEY
        : env.LLM_PROVIDER !== 'openai-compatible' || !env.LLM_API_KEY || !env.LLM_MODEL
    )
      issues.push('Provider configuration is incomplete.');
    if (
      groq &&
      env.GROQ_BASE_URL &&
      env.GROQ_BASE_URL.replace(/\/$/, '') !== 'https://api.groq.com/openai/v1'
    )
      issues.push('Groq credentials must use the official Groq API origin.');
    if (env.LLM_BASE_URL)
      try {
        const u = new URL(env.LLM_BASE_URL);
        if (
          u.protocol !== 'https:' &&
          !(u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname))
        )
          throw Error();
        if (u.username || u.password) throw Error();
      } catch {
        issues.push('Remote LLM_BASE_URL must use HTTPS without embedded credentials.');
      }
  }
  return issues;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const issues = productionIssues(process.env);
  if (issues.length) {
    for (const issue of issues) console.error(issue);
    process.exitCode = 1;
  } else
    console.log(
      'Production environment shape validated. Connectivity, TLS, backups and deployment are not verified by this command.',
    );
}
