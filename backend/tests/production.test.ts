import { it, expect } from 'vitest';
import { productionIssues } from '../../scripts/check-production.mjs';
const valid = () => ({
  NODE_ENV: 'production',
  HOST: '127.0.0.1',
  APP_ORIGIN: 'https://corewise.example.com',
  API_ORIGIN: 'http://127.0.0.1:4000',
  ML_ORIGIN: 'http://127.0.0.1:8000',
  AGENT_API_ORIGIN: 'http://127.0.0.1:4000',
  TRUST_PROXY: 'loopback',
  DATABASE_URL: 'postgresql://fixture:fixture-password@127.0.0.1:55432/fixture',
  SESSION_SECRET: 'fixture-session-credential-0000000000000000',
  ML_INTERNAL_TOKEN: 'fixture-internal-credential-1111111111111111',
  ML_ARTIFACT_ROOT: '/private/fixture/artifacts',
});
it('accepts the documented single-host environment shape without contacting external services', () => {
  expect(productionIssues(valid())).toEqual([]);
});
it('validates Groq configuration without exposing its key or permitting alternate hosts', () => {
  expect(productionIssues({...valid(),LLM_PROVIDER:'groq',GROQ_API_KEY:'fixture-groq-key',GROQ_MODEL:'openai/gpt-oss-120b'})).toEqual([]);
  const issues=productionIssues({...valid(),LLM_PROVIDER:'groq',GROQ_API_KEY:'fixture-groq-key',GROQ_BASE_URL:'https://attacker.invalid/v1'});
  expect(issues.join(' ')).toContain('official Groq');
  expect(issues.join(' ')).not.toContain('fixture-groq-key');
});
it('rejects placeholder/reused secrets and insecure public origins without echoing credentials', () => {
  const env = {
    ...valid(),
    SESSION_SECRET: 'REPLACE_WITH_SECRET',
    ML_INTERNAL_TOKEN: 'REPLACE_WITH_SECRET',
    APP_ORIGIN: 'http://public.example',
    NEXT_PUBLIC_API_KEY: 'never-print-this',
  };
  const issues = productionIssues(env);
  expect(issues.length).toBeGreaterThanOrEqual(4);
  expect(issues.join(' ')).not.toContain('never-print-this');
});
it('requires trusted loopback service boundaries and remote database/provider TLS', () => {
  expect(
    productionIssues({
      ...valid(),
      HOST: '0.0.0.0',
      API_ORIGIN: 'http://public.example',
      DATABASE_URL: 'postgresql://fixture:fixture-password@remote.example/fixture',
      LLM_PROVIDER: 'openai-compatible',
      LLM_API_KEY: 'fixture-key',
      LLM_MODEL: 'fixture-model',
      LLM_BASE_URL: 'http://remote.example/v1',
    }).length,
  ).toBeGreaterThanOrEqual(4);
});
