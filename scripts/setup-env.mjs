import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

// Generate local configuration once; preserve an existing real session secret.
let value = readFileSync(existsSync('.env') ? '.env' : '.env.example', 'utf8');
const existing = value.match(/^SESSION_SECRET=(.*)$/m)?.[1]?.trim();
if (!existing || existing.startsWith('replace-with-')) {
  const line = `SESSION_SECRET=${randomBytes(48).toString('base64url')}`;
  value = /^SESSION_SECRET=.*$/m.test(value)
    ? value.replace(/^SESSION_SECRET=.*$/m, line)
    : `${value}\n${line}\n`;
}
const mlSecret = value.match(/^ML_INTERNAL_TOKEN=(.*)$/m)?.[1]?.trim();
if (!mlSecret || mlSecret.startsWith('replace-with-')) {
  const line = `ML_INTERNAL_TOKEN=${randomBytes(48).toString('base64url')}`;
  value = /^ML_INTERNAL_TOKEN=.*$/m.test(value) ? value.replace(/^ML_INTERNAL_TOKEN=.*$/m, line) : `${value}\n${line}\n`;
}
if (!/^ML_ORIGIN=/m.test(value)) value += '\nML_ORIGIN=http://127.0.0.1:8000\n';
writeFileSync('.env', value, { mode: 0o600 });
console.info('Local .env is ready. Existing credentials were preserved; no secrets were printed.');
