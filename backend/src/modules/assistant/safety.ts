import { createHash } from 'node:crypto';
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export function redact(text: string): string {
  let value = text
    .replace(/\bBearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer [REDACTED]')
    .replace(/\b(?:sk-|gsk_)[A-Za-z0-9_-]{8,}/g, '[REDACTED]')
    .replace(
      /\b(password|api[_ -]?key|token|secret|cookie|authorization)\s*[:=]\s*[^\s,;]+/gi,
      '$1=[REDACTED]',
    );
  for (const key of [
    'LLM_API_KEY',
    'GROQ_API_KEY',
    'ML_INTERNAL_TOKEN',
    'SESSION_SECRET',
    'DATABASE_URL',
    'DIRECT_URL',
    'NEON_API_KEY',
  ]) {
    const secret = process.env[key];
    if (secret && secret.length >= 8) value = value.split(secret).join('[REDACTED]');
  }
  return value;
}
export function clean<T>(value: T): T {
  if (typeof value === 'string') return redact(value) as T;
  if (Array.isArray(value)) return value.map((item) => clean(item)) as T;
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        /^(password|api_?key|authorization|cookie|token|secret|grant|csrf)$/i.test(key)
          ? '[REDACTED]'
          : clean(item),
      ]),
    ) as T;
  return value;
}
