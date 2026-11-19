import { z } from 'zod';
import { capabilitySchema } from './m2.js';

export const mlAlgorithmSchema = z.enum(['LINEAR', 'RANDOM_FOREST', 'XGBOOST']);
export const datasetInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    mode: z.enum(['CSV', 'SYNTHETIC']),
    csv: z.string().max(2_000_000).optional(),
    count: z.number().int().min(120).max(5000).default(600),
    seed: z.number().int().min(0).max(2147483647).default(42),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.mode === 'CSV' && !v.csv)
      ctx.addIssue({ code: 'custom', path: ['csv'], message: 'Choose a CSV file.' });
    if (v.mode === 'SYNTHETIC' && v.csv !== undefined)
      ctx.addIssue({
        code: 'custom',
        path: ['csv'],
        message: 'Synthetic mode does not accept CSV.',
      });
  });
export const trainingInputSchema = z
  .object({
    datasetId: z.string().min(1).max(100),
    algorithms: z
      .array(mlAlgorithmSchema)
      .min(1)
      .max(3)
      .default(['LINEAR', 'RANDOM_FOREST', 'XGBOOST']),
    seed: z.number().int().min(0).max(2147483647).default(42),
    group_by: z.enum(['CONFIGURATION', 'WORKLOAD_FAMILY', 'HARDWARE']).default('CONFIGURATION'),
  })
  .strict();
export const mlFeaturesSchema = z
  .object({
    workload_type: z.string().min(1).max(80),
    workload_unit: z.enum([
      'ELEMENTS',
      'BYTES',
      'MiB',
      'GiB',
      'ROWS',
      'PIXELS',
      'MATRIX_DIMENSION',
    ]),
    precision: z.enum(['FP32', 'FP64', 'FLOP_EQUIVALENT']),
    workload_size: z.number().finite().positive().max(1e12),
    operation_count: z.number().finite().positive().max(9e15),
    arithmetic_intensity: z.number().finite().positive().max(1e12),
    parallel_fraction: z.number().min(0).max(1),
    memory_mib: z.number().min(0).max(1e9),
    transfer_mib: z.number().min(0).max(1e9),
    cpu_cores: z.number().int().min(1).max(4096),
    cpu_frequency_ghz: z.number().positive().max(20).nullable(),
    cpu_gflops: z.number().positive().max(1e8),
    cpu_bandwidth_gbps: z.number().positive().max(1e6),
    gpu_gflops: z.number().positive().max(1e9),
    gpu_bandwidth_gbps: z.number().positive().max(1e7),
    gpu_memory_gb: z.number().positive().max(1e6).nullable(),
    transfer_bandwidth_gbps: z.number().positive().max(1e6),
    launch_overhead_us: z.number().min(0).max(1e9),
  })
  .strict();
export type MLFeatures = z.infer<typeof mlFeaturesSchema>;
export const predictionInputSchema = z
  .object({
    workloadId: z.string().min(1).max(100),
    hardwareProfileId: z.string().min(1).max(100),
    assumptions: capabilitySchema,
    cpuModelId: z.string().min(1).max(100).optional(),
    gpuModelId: z.string().min(1).max(100).optional(),
  })
  .strict();
export const metricSchema = z.object({ maeMs: z.number(), rmseMs: z.number(), r2: z.number() });
export const evaluationSchema = z.object({
  validation: metricSchema,
  test: metricSchema,
  perFamily: z.record(
    z.string(),
    z.object({
      count: z.number(),
      maeMs: z.number(),
      rmseMs: z.number(),
      r2: z.number().nullable(),
    }),
  ),
  points: z.array(
    z.object({
      actualMs: z.number(),
      predictedMs: z.number(),
      residualMs: z.number(),
      family: z.string(),
    }),
  ),
  split: z.object({
    strategy: z.string(),
    seed: z.number(),
    trainRows: z.number(),
    validationRows: z.number(),
    testRows: z.number(),
    trainGroups: z.number(),
    validationGroups: z.number(),
    testGroups: z.number(),
    groupOverlap: z.boolean(),
  }),
  selectionMetric: z.string(),
  versions: z.record(z.string(), z.string()),
  provenance: z.string(),
  label: z.string(),
});
export const datasetSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  schemaVersion: z.string(),
  provenance: z.enum(['MEASURED', 'SYNTHETIC_DEMO']),
  rowCount: z.number(),
  createdAt: z.string(),
  validation: z.record(z.string(), z.unknown()),
  preview: z.array(z.record(z.string(), z.unknown())).optional(),
});
export const modelSchema = z.object({
  id: z.string(),
  name: z.string(),
  algorithm: mlAlgorithmSchema,
  target: z.enum(['CPU', 'GPU']),
  version: z.string(),
  datasetId: z.string(),
  trainingJobId: z.string(),
  schemaVersion: z.string(),
  provenance: z.string(),
  status: z.string(),
  active: z.boolean(),
  selected: z.boolean(),
  createdAt: z.string(),
  evaluation: evaluationSchema,
  featureSchema: z.record(z.string(), z.unknown()),
  trainingConfig: z.record(z.string(), z.unknown()),
});
export type MLModel = z.infer<typeof modelSchema>;
export const jobSchema = z.object({
  id: z.string(),
  datasetId: z.string(),
  status: z.enum(['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED']),
  config: z.record(z.string(), z.unknown()),
  logs: z.array(z.string()),
  error: z.string().nullable(),
  createdAt: z.string(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  modelIds: z.array(z.string()),
});
const modelReference = z.object({
  artifactSha256: z.string().length(64).optional(),
  id: z.string(),
  version: z.string(),
  algorithm: z.string(),
  datasetId: z.string().optional(),
  access: z.enum(['PRIVATE', 'SHARED_EXPERIMENTAL']).optional(),
  limitations: z.string().optional(),
  datasetProvenance: z.string(),
  schemaVersion: z.string(),
});
export const predictionResultSchema = z.object({
  cpuTimeMs: z.number().finite().positive(),
  gpuTimeMs: z.number().finite().positive(),
  speedup: z.number().finite().positive(),
  models: z.object({ CPU: modelReference, GPU: modelReference }),
  provenance: z.literal('PREDICTED'),
  readiness: z.literal('READY'),
  warnings: z.array(z.string()),
  label: z.string(),
});
export const predictionSchema = z.object({
  id: z.string(),
  workloadId: z.string().nullable(),
  hardwareProfileId: z.string().nullable(),
  workloadSnapshot: z.object({ name: z.string() }).passthrough(),
  hardwareSnapshot: z.object({ name: z.string() }).passthrough(),
  features: mlFeaturesSchema,
  result: predictionResultSchema,
  provenance: z.literal('PREDICTED'),
  createdAt: z.string(),
});
export type MLPrediction = z.infer<typeof predictionSchema>;
export const datasetListSchema = z.object({ data: z.array(datasetSchema) });
export const datasetResponseSchema = z.object({ data: datasetSchema });
export const modelListSchema = z.object({ data: z.array(modelSchema) });
export const sharedCompatibilitySchema = z
  .object({
    cpuModel: z.string().min(1),
    gpuModel: z.string().min(1),
    workloads: z.array(z.string()).min(1),
    precisions: z.array(z.string()).min(1),
    ranges: z.record(z.string(), z.tuple([z.number().finite(), z.number().finite()])),
  })
  .strict();
export const sharedModelSchema = z.object({
  id: z.string(),
  algorithm: mlAlgorithmSchema,
  target: z.enum(['CPU', 'GPU']),
  version: z.string(),
  access: z.literal('SHARED_EXPERIMENTAL'),
  compatibility: sharedCompatibilitySchema,
  limitations: z.string(),
  evaluation: z.object({ validation: metricSchema, test: metricSchema }),
});
export const modelCatalogSchema = z.object({
  data: z.object({
    private: z.array(modelSchema.extend({ access: z.literal('PRIVATE') })),
    shared: z.array(sharedModelSchema),
  }),
});
export const modelResponseSchema = z.object({ data: modelSchema });
export const jobListSchema = z.object({ data: z.array(jobSchema) });
export const jobResponseSchema = z.object({ data: jobSchema });
export const predictionListSchema = z.object({ data: z.array(predictionSchema) });
export const predictionResponseSchema = z.object({ data: predictionSchema });
