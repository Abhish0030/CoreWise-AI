import { defineConfig as composer } from '@prisma/composer/config';
import { nodeBuild } from '@prisma/composer/node/control';
import { prismaCloud, prismaState } from '@prisma/composer-prisma-cloud/control';
import { defineConfig as ormConfig } from '@prisma/orm-postgres/config';
import { definePrismaConfig } from 'prisma/config';

export default definePrismaConfig({
  // Prisma ORM 8: the data contract, the migrations directory and the
  // connection the CLI's database commands use when --db is not given.
  orm: ormConfig({
    contract: './src/prisma/contract.prisma',
    migrations: { dir: 'migrations' },
    db: { connection: process.env['DATABASE_URL'] ?? '' },
  }),
  // Prisma Composer: the app entry and its deploy target.
  composer: composer({
    entry: './module.mjs',
    extensions: [prismaCloud(), nodeBuild()],
    state: prismaState(),
  }),
});
