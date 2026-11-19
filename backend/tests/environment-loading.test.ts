import { beforeEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
vi.mock('node:fs', () => ({ readFileSync: vi.fn() }));
import { loadDatabaseEnvironment } from '../../scripts/db-environment.mjs';
beforeEach(() => vi.mocked(readFileSync).mockReset());
it('loads only the explicitly selected Neon file and cannot inherit root database values', () => {
  vi.mocked(readFileSync).mockReturnValue(
    'COREWISE_DB_ENV=neon-development\nDATABASE_URL=private-pooled-fixture\nDIRECT_URL=private-direct-fixture\nNEON_BRANCH_NAME=development',
  );
  const env = loadDatabaseEnvironment('neon-development', {
    DATABASE_URL: 'wrong-root-fixture',
    NEON_API_KEY: 'wrong-root-key',
    SESSION_SECRET: 'inherited-process-setting',
  });
  expect(vi.mocked(readFileSync).mock.calls).toEqual([['.env.neon.development.local']]);
  expect(env.DATABASE_URL).toBe('private-pooled-fixture');
  expect(env.NEON_API_KEY).toBeUndefined();
  expect(env.SESSION_SECRET).toBe('inherited-process-setting');
  expect(env.COREWISE_ENV_LOADED).toBe('1');
});
it('loads local configuration without reading a Neon file or requiring Neon credentials', () => {
  vi.mocked(readFileSync).mockReturnValue('COREWISE_DB_ENV=local\nDATABASE_URL=local-fixture');
  const env = loadDatabaseEnvironment('local', { NEON_API_KEY: 'unrelated-stale-key' });
  expect(vi.mocked(readFileSync).mock.calls).toEqual([['.env']]);
  expect(env.COREWISE_DB_ENV).toBe('local');
  expect(env.NEON_API_KEY).toBeUndefined();
});
it('does not fall back when the selected file is missing and refuses unknown environments', () => {
  vi.mocked(readFileSync).mockImplementationOnce(() => {
    throw Error('private filesystem detail');
  });
  expect(() => loadDatabaseEnvironment('neon-development', {})).toThrow(
    'Selected private environment file',
  );
  expect(() => loadDatabaseEnvironment('unexpected', {})).toThrow('Unknown database environment');
  expect(vi.mocked(readFileSync).mock.calls).toEqual([['.env.neon.development.local']]);
});
