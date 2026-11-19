import { beforeEach, expect, it, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
vi.mock('node:child_process', () => ({ spawnSync: vi.fn() }));
import { verifyDatabaseBranch } from '../../scripts/verify-database-branch.mjs';
const env = {
  DIRECT_URL:
    'postgresql://fixture:must-not-print@ep-fixture.us-east-2.aws.neon.tech/neondb?sslmode=require',
};
const metadata = {
  connected: true,
  branchVerified: true,
  endpointHost: 'ep-fixture.us-east-2.aws.neon.tech',
  endpointPort: 5432,
  databaseName: 'neondb',
  databaseRole: 'fixture',
  publicTables: ['_prisma_migrations'],
};
function output(stdout: string, status = 0) {
  return {
    pid: 1,
    status,
    signal: null,
    stdout,
    stderr: '',
    output: [null, stdout, ''],
  } as unknown as ReturnType<typeof spawnSync>;
}
beforeEach(() => vi.mocked(spawnSync).mockReset());
it('admits an independently verified exact branch through only the read-only probe', () => {
  vi.mocked(spawnSync).mockReturnValue(output(JSON.stringify(metadata)));
  expect(verifyDatabaseBranch(env, 'neon-development').branchVerified).toBe(true);
  expect(vi.mocked(spawnSync).mock.calls[0]?.[1]).toEqual([
    'scripts/neon-transfer.py',
    '--environment',
    'neon-development',
    'inspect',
  ]);
});
it('refuses mismatched endpoint, port, database, role and unverified branch metadata', () => {
  for (const altered of [
    { branchVerified: false },
    { endpointHost: 'ep-other.us-east-2.aws.neon.tech' },
    { endpointPort: 5433 },
    { databaseName: 'other' },
    { databaseRole: 'other' },
  ]) {
    vi.mocked(spawnSync).mockReturnValue(output(JSON.stringify({ ...metadata, ...altered })));
    expect(() => verifyDatabaseBranch(env, 'neon-development')).toThrow('exact intended Neon');
  }
});
it('withholds provider/connection details when a probe fails or returns malformed output', () => {
  for (const result of [output('private-upstream-detail', 1), output('{}', 1)]) {
    vi.mocked(spawnSync).mockReturnValue(result);
    let message = '';
    try {
      verifyDatabaseBranch(env, 'neon-development');
    } catch (e) {
      message = String(e);
    }
    expect(message).toMatch(/Could not verify|Verify the exact/);
    expect(message).not.toMatch(/must-not-print|private-upstream-detail/);
  }
});
