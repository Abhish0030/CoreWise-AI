import { PrismaClient } from '@prisma/client';

import { databaseSettings } from '../../../scripts/db-environment.mjs';
databaseSettings(process.env);

export const db = new PrismaClient();
export async function checkDatabase(): Promise<void> {
  await db.$queryRaw`SELECT 1`;
}
