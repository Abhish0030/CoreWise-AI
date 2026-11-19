import { z } from 'zod';
export const benchmarkLimits = {
  VECTOR_ADDITION: 4_000_000,
  MATRIX_MULTIPLICATION: 1024,
  SORTING: 1_000_000,
  REDUCTION: 1_000_000,
  IMAGE_PROCESSING: 4_000_000,
} as const;
export const benchmarkConfigSchema = z
  .object({
    workload: z.enum([
      'VECTOR_ADDITION',
      'MATRIX_MULTIPLICATION',
      'SORTING',
      'REDUCTION',
      'IMAGE_PROCESSING',
    ]),
    size: z.number().int().min(16).max(4_000_000),
    dtype: z.enum(['float32', 'float64']).default('float32'),
    warmups: z.number().int().min(1).max(5).default(2),
    repetitions: z.number().int().min(3).max(30).default(5),
    seed: z.number().int().min(0).max(2147483647).default(42),
    threads: z.number().int().min(1).max(16).default(1),
    gpu: z.boolean().default(true),
    scope: z.enum(['COMPUTE_ONLY', 'END_TO_END']).default('END_TO_END'),
    timeoutSeconds: z.number().int().min(5).max(120).default(60),
  })
  .strict()
  .superRefine((v, c) => {
    if (v.size > benchmarkLimits[v.workload])
      c.addIssue({
        code: 'custom',
        path: ['size'],
        message: `Maximum size is ${benchmarkLimits[v.workload]}`,
      });
  });
export type BenchmarkConfig = z.infer<typeof benchmarkConfigSchema>;
export const benchmarkCatalog = Object.entries(benchmarkLimits).map(([id, maxSize]) => ({
  id,
  version: 'cw-bench-1',
  name: id.replaceAll('_', ' '),
  maxSize,
  sizeUnit:
    id === 'MATRIX_MULTIPLICATION'
      ? 'square matrix dimension'
      : id === 'IMAGE_PROCESSING'
        ? 'pixels'
        : 'elements',
  semantics:
    id === 'VECTOR_ADDITION'
      ? 'c[i] = a[i] + b[i]'
      : id === 'MATRIX_MULTIPLICATION'
        ? 'C = A @ B, dense square matrices'
        : id === 'REDUCTION'
          ? 'Sum of a real-valued vector; output is one scalar'
          : id === 'IMAGE_PROCESSING'
            ? 'Pixelwise grayscale blend: out = 0.5 * (a + b)'
            : 'Ascending stable value sort; CPU/GPU library algorithms may differ',
  backends: ['NumPy', 'CuPy/CUDA (optional)'],
}));
export const detectedEnvironmentSchema = z.object({
  source: z.literal('DETECTED'),
  cpuModel: z.string().nullable(),
  hostname: z.string().max(255).optional(),
  cpuManufacturer: z.string().max(200).nullable().optional(),
  logicalCpus: z.number().int().positive().nullable(),
  physicalCores: z.number().int().positive().nullable(),
  availableRamBytes: z.number().positive(),
  totalRamBytes: z.number().positive(),
  os: z.string(),
  python: z.string(),
  libraries: z.record(z.string(), z.string()),
  gpus: z
    .array(
      z.object({
        model: z.string(),
        memoryBytes: z.number().positive(),
        driverVersion: z.string(),
        source: z.string(),
      }),
    )
    .max(16),
  gpuRuntime: z
    .object({
      backend: z.string(),
      version: z.string(),
      runtimeVersion: z.string(),
      driverVersion: z.string(),
      model: z.string(),
      memoryBytes: z.number().positive(),
    })
    .nullable(),
  gpuUnavailableReason: z.string().max(2000).nullable(),
  threadConfiguration: z.record(z.string(), z.unknown()).optional(),
});
export const timingSummarySchema = z.object({
  medianMs: z.number().finite().positive(),
  meanMs: z.number().finite().positive(),
  stddevMs: z.number().finite().nonnegative(),
  minMs: z.number().finite().positive(),
  maxMs: z.number().finite().positive(),
});
const samples = z.array(z.number().finite().positive().max(120000)).min(3).max(30);
const deviceTimingSchema = z.object({
  backend: z.string().max(100),
  samplesMs: samples,
  summary: timingSummarySchema,
  correctness: z.object({
    valid: z.boolean(),
    rtol: z.number().nonnegative(),
    atol: z.number().nonnegative(),
    maxAbsoluteError: z.number().finite().nonnegative().nullable(),
    diagnostic: z.string().max(1000).optional(),
  }),
  timingMethod: z.string().max(1000),
  scope: z.enum(['COMPUTE_ONLY', 'END_TO_END']),
  includesTransfers: z.boolean(),
  allocationPolicy: z.string().optional(),
});
export const benchmarkMeasurementSchema = z
  .object({
    benchmarkVersion: z.literal('cw-bench-1'),
    provenance: z.literal('MEASURED'),
    config: benchmarkConfigSchema,
    environment: detectedEnvironmentSchema,
    cpu: deviceTimingSchema,
    gpu: deviceTimingSchema
      .extend({ computeMs: samples, h2dMs: samples, d2hMs: samples, endToEndMs: samples })
      .nullable(),
    gpuUnavailableReason: z.string().max(2000).nullable(),
    valid: z.boolean(),
    timestamp: z.iso.datetime({ offset: true }),
    methodology: z.string().max(4000),
    speedup: z.number().finite().positive().nullable(),
  })
  .strict();
export type BenchmarkMeasurement = z.infer<typeof benchmarkMeasurementSchema>;
export const localAgentSchema = z.object({
  id: z.string(),
  name: z.string(),
  environment: detectedEnvironmentSchema,
  createdAt: z.string(),
  lastSeenAt: z.string().nullable(),
  expiresAt: z.string(),
  revokedAt: z.string().nullable(),
});
export const agentListSchema = z.object({ data: z.array(localAgentSchema) });
export const benchmarkJobSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  status: z.enum([
    'QUEUED',
    'RUNNING',
    'COMPLETED',
    'INVALID',
    'FAILED',
    'CANCEL_REQUESTED',
    'CANCELLED',
  ]),
  config: benchmarkConfigSchema,
  error: z.string().nullable(),
  createdAt: z.string(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  runId: z.string().nullable(),
});
export const benchmarkJobListSchema = z.object({ data: z.array(benchmarkJobSchema) });
export const benchmarkJobResponseSchema = z.object({ data: benchmarkJobSchema });
export const benchmarkRunSchema = z.object({
  id: z.string(),
  jobId: z.string(),
  agentId: z.string(),
  measurement: benchmarkMeasurementSchema,
  provenance: z.literal('MEASURED'),
  valid: z.boolean(),
  createdAt: z.string(),
});
export const benchmarkRunListSchema = z.object({ data: z.array(benchmarkRunSchema) });
export const benchmarkRunResponseSchema = z.object({ data: benchmarkRunSchema });
export const pairCodeSchema = z.object({
  data: z.object({ code: z.string(), expiresAt: z.string() }),
});
export const benchmarkJobInputSchema = z
  .object({ agentId: z.string().min(1).max(100), config: benchmarkConfigSchema })
  .strict();
export const benchmarkExportSchema = z
  .object({
    runIds: z.array(z.string().min(1).max(100)).min(1).max(5000),
    capabilities: z
      .object({
        cpu_gflops: z.number().positive().nullable(),
        cpu_bandwidth_gbps: z.number().positive().nullable(),
        gpu_gflops: z.number().positive().nullable(),
        gpu_bandwidth_gbps: z.number().positive().nullable(),
        transfer_bandwidth_gbps: z.number().positive().nullable(),
        launch_overhead_us: z.number().nonnegative().nullable(),
        parallel_fraction: z.number().min(0).max(1).nullable(),
        source: z.string().trim().min(5).max(500),
      })
      .strict(),
  })
  .strict();
