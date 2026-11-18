import nodeBuild from '@prisma/composer/node';
import { compute } from '@prisma/composer-prisma-cloud';
import { dataContract, postgres, type PostgresBinding } from '@prisma/composer-prisma-cloud/orm';
import type { Contract } from './prisma/contract.js';
import contractJson from './prisma/contract.json' with { type: 'json' };

/**
 * The Prisma ORM 8 data contract, emitted from `src/prisma/contract.prisma`
 * by `prisma contract emit`. Referenced by both ends of the database
 * connection: the `postgres(...)` resource the module provisions and the
 * `postgres(...)` dependency the service declares.
 */
export const orm = dataContract<Contract>(contractJson);

/** The hydrated database dependency `service.load()` returns: url, pool and the typed ORM client. */
export type Db = PostgresBinding<typeof orm>;

/**
 * The CoreWise-AI service. The built entry (`dist/server.mjs`, beside this
 * compiled declaration) imports this file to read its database through
 * `service.load()` and its port through `service.port()`. The build leaves
 * packages external, so deploy stages the installed packages the entry
 * imports.
 */
const api = compute({
  name: 'api',
  deps: { db: postgres(orm) },
  build: nodeBuild({
    module: import.meta.url,
    // Directory build: the whole compiled dist tree ships verbatim, so the
    // sibling service declaration and the emitted contract ride along.
    dir: '.',
    entry: './server.mjs',
    dependencies: 'external',
  }),
});

export default api;
