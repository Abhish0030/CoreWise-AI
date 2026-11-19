import { module } from '@prisma/composer';
import { postgres } from '@prisma/composer-prisma-cloud/orm';
import api, { orm } from './dist/service.mjs';

// CoreWise-AI: one api service with one Prisma-ORM-typed Postgres database.
// The service declaration is imported from the build output, which compiles it
// together with the app (src/service.mts -> dist/service.mjs).
export default module('corewise-ai', ({ provision }) => {
  const db = provision(postgres({ name: 'db', contract: orm, config: './prisma.config.ts' }));
  provision(api, { deps: { db } });
});
