import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
try {
  console.info(await db.$queryRaw`SELECT current_database() as database, version()`);
  console.info(`Hardware profiles: ${await db.hardwareProfile.count()}`);
} catch (error) {
  console.error('Database verification failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
