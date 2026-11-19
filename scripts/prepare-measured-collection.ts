import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { benchmarkMeasurementSchema, benchmarkExportSchema } from '@corewise/types';
import { measuredRows, csv } from '../backend/src/modules/benchmarks/export.js';
const directory = resolve(process.argv[2] ?? '');
if (!process.argv[2])
  throw Error('Usage: pnpm exec tsx scripts/prepare-measured-collection.ts <collection-directory>');
const manifest = JSON.parse(await readFile(resolve(directory, 'manifest.json'), 'utf8')) as {
  runs: string[];
  calibrations: Record<string, string>;
};
const measurements = await Promise.all(
  manifest.runs.map(async (name) => {
    if (!/^run-\d+\.json$/.test(name)) throw Error('Unexpected collection filename');
    const data = JSON.parse(await readFile(resolve(directory, name), 'utf8'));
    return { id: name, measurement: benchmarkMeasurementSchema.parse(data.measurement) };
  }),
);
const rows: Record<string, unknown>[] = [],
  excluded: unknown[] = [];
for (const dtype of ['float32', 'float64']) {
  const name = manifest.calibrations[dtype];
  if (!name) continue;
  if (name !== `calibration-${dtype}.json`) throw Error('Unexpected calibration filename');
  const raw = JSON.parse(await readFile(resolve(directory, name), 'utf8'));
  if (!raw.capabilities) {
    excluded.push({
      dtype,
      reason: 'No paired GPU calibration. Raw CPU results remain available.',
    });
    continue;
  }
  const caps = benchmarkExportSchema.shape.capabilities.parse(raw.capabilities);
  const result = measuredRows(
    measurements.filter((m) => m.measurement.config.dtype === dtype),
    caps,
  );
  rows.push(...result.rows);
  excluded.push(...result.excluded);
}
// Derived exports are immutable for this collection; never overwrite an existing dataset.
await writeFile(resolve(directory, 'measured.csv'), csv(rows), { flag: 'wx' });
await writeFile(
  resolve(directory, 'dataset-provenance.json'),
  JSON.stringify(
    {
      schemaVersion: 'cw-features-1',
      provenance: 'MEASURED',
      rowCount: rows.length,
      excluded,
      source: 'Original raw runs and separate independent calibration retained in this directory.',
      limitations: [
        'One CPU/GPU system, small workloads and one CPU thread only.',
        'Effective calibration throughput/logical traffic and host-overhead proxy are not vendor peaks or hardware-counter measurements.',
        'Calibration runs are excluded from training labels. No features are inferred from target times.',
      ],
    },
    null,
    2,
  ),
  { flag: 'wx' },
);
console.log(JSON.stringify({ rows: rows.length, excluded: excluded.length, directory }));
