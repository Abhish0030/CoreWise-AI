import {
  benchmarkMeasurementSchema,
  type BenchmarkConfig,
  type BenchmarkMeasurement,
} from '@corewise/types';
import { ApiError } from '../../lib/errors.js';
export function summarize(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b),
    n = samples.length;
  const mean = samples.reduce((a, b) => a + b, 0) / n;
  return {
    medianMs: n % 2 ? sorted[Math.floor(n / 2)]! : (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2,
    meanMs: mean,
    stddevMs: Math.sqrt(samples.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1)),
    minMs: sorted[0]!,
    maxMs: sorted[n - 1]!,
  };
}
export function validateMeasurement(input: unknown, config: BenchmarkConfig): BenchmarkMeasurement {
  const parsed = benchmarkMeasurementSchema.safeParse(input);
  if (!parsed.success) throw new ApiError(400, 'INVALID_MEASUREMENT', 'Malformed measured result.');
  const m = parsed.data;
  if (JSON.stringify(m.config) !== JSON.stringify(config))
    throw new ApiError(
      400,
      'CONFIG_MISMATCH',
      'Measurement configuration differs from the assigned job.',
    );
  if (!config.gpu && m.gpu)
    throw new ApiError(400, 'INVALID_MEASUREMENT', 'GPU results were not requested.');
  for (const device of [m.cpu, m.gpu]) {
    if (!device) continue;
    if (device.samplesMs.length !== config.repetitions || device.scope !== config.scope)
      throw new ApiError(
        400,
        'INVALID_MEASUREMENT',
        'Sample count or scope does not match the job.',
      );
    const summary = summarize(device.samplesMs);
    for (const key of Object.keys(summary) as (keyof typeof summary)[]) {
      if (Math.abs(summary[key] - device.summary[key]) > Math.max(1e-9, summary[key] * 1e-6))
        throw new ApiError(
          400,
          'INVALID_MEASUREMENT',
          'Timing aggregation does not match raw samples.',
        );
    }
    device.summary = summary;
  }
  if (m.cpu.includesTransfers || m.cpu.backend !== 'NumPy')
    throw new ApiError(400, 'INVALID_MEASUREMENT', 'Invalid CPU backend or transfer policy.');
  if (m.gpu) {
    if (
      m.gpu.backend !== 'CuPy/CUDA' ||
      m.gpu.includesTransfers !== (config.scope === 'END_TO_END')
    )
      throw new ApiError(400, 'INVALID_MEASUREMENT', 'Invalid GPU backend or transfer policy.');
    for (const values of [m.gpu.computeMs, m.gpu.h2dMs, m.gpu.d2hMs, m.gpu.endToEndMs])
      if (values.length !== config.repetitions)
        throw new ApiError(400, 'INVALID_MEASUREMENT', 'GPU timing components are incomplete.');
    const selected = config.scope === 'END_TO_END' ? m.gpu.endToEndMs : m.gpu.computeMs;
    if (selected.some((v, i) => v !== m.gpu!.samplesMs[i]))
      throw new ApiError(
        400,
        'INVALID_MEASUREMENT',
        'Selected GPU scope differs from its raw samples.',
      );
  }
  m.valid = m.valid && m.cpu.correctness.valid && (m.gpu === null || m.gpu.correctness.valid);
  m.speedup = m.valid && m.gpu ? m.cpu.summary.medianMs / m.gpu.summary.medianMs : null;
  return m;
}
