import './scripts/runtime-environment.mjs';
import { defineConfig } from 'prisma/config';
import { databaseSettings } from './scripts/db-environment.mjs';
const settings = databaseSettings(
  process.env,
  process.argv.some((a) => ['migrate', 'db'].includes(a)) && !process.argv.includes('status'),
);

export default defineConfig({
  schema: 'backend/prisma/schema.prisma',
  engine: 'classic',
  datasource: { url: settings.directUrl },
  migrations: { path: 'backend/prisma/migrations' },
});
