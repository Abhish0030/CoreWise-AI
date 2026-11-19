export function sanitizeDatabaseOutput(value, env) {
  let text = String(value ?? '');
  const secrets = [];
  for (const [key, val] of Object.entries(env)) {
    if (typeof val !== 'string' || !val) continue;
    if (/PASSWORD|SECRET|TOKEN|API_KEY|DATABASE_URL|DIRECT_URL/i.test(key)) secrets.push(val);
    if (/DATABASE_URL|DIRECT_URL/i.test(key)) {
      try {
        const password = new URL(val).password;
        if (password) secrets.push(password, decodeURIComponent(password));
      } catch {
        /* Invalid URLs remain redacted as complete configured values. */
      }
    }
  }
  for (const secret of [...new Set(secrets)].sort((a, b) => b.length - a.length))
    text = text.split(secret).join('[REDACTED]');
  return text
    .replace(/(?:postgres(?:ql)?|https?):\/\/[^\s"'<>]+/gi, '[REDACTED URL]')
    .replace(/\bBearer\s+[^\s"'<>]+/gi, 'Bearer [REDACTED]')
    .replace(/\b(?:gsk_|sk-)[A-Za-z0-9_-]{8,}/g, '[REDACTED]')
    .replace(/\b(password|api[_ -]?key|token|secret)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]');
}
export function databaseCommandResult(result, env) {
  const stdout = sanitizeDatabaseOutput(result.stdout, env);
  const stderr = sanitizeDatabaseOutput(result.stderr, env);
  const combined = stdout + '\n' + stderr;
  return {
    success: result.status === 0 && !result.error && !result.signal,
    exitCode: typeof result.status === 'number' ? result.status : 1,
    signal: result.signal ?? null,
    launchError: result.error
      ? sanitizeDatabaseOutput(result.error.code ?? 'PROCESS_START_FAILED', env)
      : null,
    prismaErrorCode: combined.match(/\bP\d{4}\b/)?.[0] ?? null,
    migrationName: combined.match(/Migration name:\s*([^\s]+)/i)?.[1] ?? null,
    stdout: stdout.slice(-12000).trim(),
    stderr: stderr.slice(-12000).trim(),
  };
}
