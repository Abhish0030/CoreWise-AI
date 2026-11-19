import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    '**/.next/**',
    '**/dist/**',
    '**/next-env.d.ts',
    'playwright-report/**',
    '.artifacts/**',
  ]),
  {
    files: ['backend/**/*.ts'],
    rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] },
  },
  { settings: { next: { rootDir: 'frontend/' }, react: { version: '19.1' } } },
]);
