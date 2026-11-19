import { spawnSync } from 'node:child_process';
export function verifyDatabaseBranch(env, environment) {
  const python =
    process.platform === 'win32'
      ? 'backend/ml/.venv/Scripts/python.exe'
      : 'backend/ml/.venv/bin/python';
  const probe = spawnSync(
    python,
    ['scripts/neon-transfer.py', '--environment', environment, 'inspect'],
    { env, encoding: 'utf8', timeout: 60000 },
  );
  let result;
  try {
    result = JSON.parse(probe.stdout?.trim().split('\n').at(-1) || '{}');
  } catch {
    throw Error('Could not verify the selected Neon branch.');
  }
  const target = new URL(env.DIRECT_URL);
  if (
    probe.status !== 0 ||
    !result.connected ||
    !result.branchVerified ||
    result.endpointHost !== target.hostname ||
    result.endpointPort !== Number(target.port || 5432) ||
    result.databaseName !== decodeURIComponent(target.pathname.slice(1)) ||
    result.databaseRole !== decodeURIComponent(target.username)
  )
    throw Error(
      'Verify the exact intended Neon endpoint/branch with the read-only probe before remote writes.',
    );
  return result;
}
