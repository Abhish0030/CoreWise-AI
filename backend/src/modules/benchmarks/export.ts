import {
  benchmarkExportSchema,
  mlFeaturesSchema,
  type BenchmarkMeasurement,
  type z,
} from '@corewise/types';
import { createHash } from 'node:crypto';
import { safeCsv } from '../../lib/csv.js';
export function measuredRows(
  runs: { id: string; measurement: BenchmarkMeasurement }[],
  capabilities: z.infer<typeof benchmarkExportSchema>['capabilities'],
) {
  const rows: Record<string, unknown>[] = [],
    excluded: { runId: string; reason: string }[] = [];
  for (const run of runs) {
    const m = run.measurement,
      c = m.config,
      n = c.size,
      bytes = c.dtype === 'float32' ? 4 : 8;
    if (!m.valid || !m.gpu || c.scope !== 'END_TO_END') {
      excluded.push({
        runId: run.id,
        reason: !m.valid
          ? 'Correctness invalid'
          : !m.gpu
            ? 'Missing GPU target'
            : 'Compute-only scope is incompatible with end-to-end M3 labels',
      });
      continue;
    }
    const elements = c.workload === 'MATRIX_MULTIPLICATION' ? n * n : n;
    const footprint =
      c.workload === 'REDUCTION'
        ? (elements + 1) * bytes
        : elements * bytes * (c.workload === 'SORTING' ? 2 : 3);
    const operations =
      c.workload === 'MATRIX_MULTIPLICATION'
        ? 2 * n ** 3
        : c.workload === 'VECTOR_ADDITION'
          ? n
          : c.workload === 'REDUCTION'
            ? n - 1
            : c.workload === 'IMAGE_PROCESSING'
              ? 2 * n
              : n * Math.log2(n);
    const features = mlFeaturesSchema.safeParse({
      workload_type: c.workload,
      workload_unit:
        c.workload === 'MATRIX_MULTIPLICATION'
          ? 'MATRIX_DIMENSION'
          : c.workload === 'IMAGE_PROCESSING'
            ? 'PIXELS'
            : 'ELEMENTS',
      precision:
        c.workload === 'SORTING' ? 'FLOP_EQUIVALENT' : c.dtype === 'float32' ? 'FP32' : 'FP64',
      workload_size: n,
      operation_count: operations,
      arithmetic_intensity: operations / footprint,
      parallel_fraction: capabilities.parallel_fraction,
      memory_mib: footprint / 2 ** 20,
      transfer_mib: footprint / 2 ** 20,
      cpu_cores: m.environment.physicalCores,
      cpu_frequency_ghz: null,
      cpu_gflops: capabilities.cpu_gflops,
      cpu_bandwidth_gbps: capabilities.cpu_bandwidth_gbps,
      gpu_gflops: capabilities.gpu_gflops,
      gpu_bandwidth_gbps: capabilities.gpu_bandwidth_gbps,
      gpu_memory_gb: (m.environment.gpuRuntime?.memoryBytes ?? 0) / 1e9 || null,
      transfer_bandwidth_gbps: capabilities.transfer_bandwidth_gbps,
      launch_overhead_us: capabilities.launch_overhead_us,
    });
    if (!features.success) {
      excluded.push({
        runId: run.id,
        reason: `Missing/invalid critical features: ${features.error.issues.map((i) => i.path.join('.')).join(', ')}`,
      });
      continue;
    }
    for (let i = 0; i < c.repetitions; i++)
      rows.push({
        ...features.data,
        cpu_time_ms: m.cpu.samplesMs[i],
        gpu_time_ms: m.gpu.endToEndMs[i],
        workload_family: c.workload,
        hardware_id: createHash('sha256')
          .update(
            JSON.stringify({
              cpu: m.environment.cpuModel,
              gpu: m.environment.gpuRuntime?.model,
              cores: m.environment.physicalCores,
              threads: c.threads,
              os: m.environment.os,
            }),
          )
          .digest('hex'),
        benchmark_source: `CoreWise local runner ${m.benchmarkVersion}; run ${run.id}`,
        measurement_methodology: `${m.methodology} Capabilities/parallelism USER_ENTERED external source: ${capabilities.source}. Operation count and intensity are algorithmic traffic assumptions, not measured counters. Threads=${c.threads}; dtype=${c.dtype}; seed=${c.seed}; scope=END_TO_END.`,
        provenance: 'MEASURED',
        dataset_version: 'measured-cw-bench-1',
        schema_version: 'cw-features-1',
      });
  }
  return { rows, excluded };
}
export function csv(rows: Record<string, unknown>[]) {
  if (!rows.length) return '';
  return safeCsv(rows);
}
