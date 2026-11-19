import { verifyDatabaseBranch } from './verify-database-branch.mjs';
import { databaseSettings } from './db-environment.mjs';
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { ingest } from '../backend/src/modules/knowledge/service.js';
import { db } from '../backend/src/lib/db.js';
// Operator-only, reviewed public methodology. Never glob the vault or private configurations.
const sources = ['obsidian/M2-ANALYTICAL-MODEL.md', 'obsidian/M4-BENCHMARK-METHODOLOGY.md'];
try {
  const settings = databaseSettings(process.env);
  if (settings.environment !== 'local') {
    verifyDatabaseBranch(process.env, settings.environment);
    process.env.COREWISE_VERIFIED_DATABASE_WRITE = 'true';
    if (process.argv.includes('--approve-production'))
      process.env.ALLOW_PRODUCTION_DB_WRITE = 'approved-cutover';
  }
  databaseSettings(process.env, true);
  for (const source of sources) {
    const original = await readFile(source, 'utf8');
    const text = source.includes('M4-')
      ? '# Curated performance-methodology excerpt\n\n## Workload implementations' +
        original
          .split('## Workload implementations')[1]!
          .split('## Pairing and credential security')[0]!
      : original;
    const result = await ingest(
      null,
      {
        title: source.split('/').at(-1)!,
        text,
        sourceType: 'PROJECT_DOCUMENTATION',
        sourceId: source,
        provenance: 'GENERAL_TECHNICAL_DOCUMENTATION',
      },
      process.argv.includes('--reindex'),
    );
    console.log(JSON.stringify({ source, ...result }));
  }
} finally {
  await db.$disconnect();
}
