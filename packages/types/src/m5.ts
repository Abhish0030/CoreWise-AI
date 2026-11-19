import { z } from 'zod';
const background = z.number().int().min(8).max(128).default(32);
export const explanationInputSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('LOCAL'),
      predictionId: z.string().min(1).max(100),
      backgroundLimit: background,
    })
    .strict(),
  z
    .object({
      kind: z.literal('GLOBAL'),
      modelId: z.string().min(1).max(100),
      backgroundLimit: background,
      sampleLimit: z.number().int().min(2).max(128).default(32),
      workloadFamily: z.string().trim().min(1).max(100).optional(),
    })
    .strict(),
]);
const modelMeta = z.object({
  modelId: z.string(),
  modelVersion: z.string(),
  artifactSha256: z.string(),
  target: z.enum(['CPU', 'GPU']),
  algorithm: z.string(),
  datasetId: z.string(),
  datasetVersion: z.string(),
  datasetProvenance: z.string(),
  featureSchemaVersion: z.string(),
  explainerType: z.string(),
  shapVersion: z.string(),
  policyVersion: z.literal('cw-shap-1'),
});
const backgroundRef = z.object({
  datasetId: z.string(),
  datasetVersion: z.string(),
  datasetProvenance: z.string(),
  datasetSha256: z.string(),
  schemaVersion: z.string(),
  splitStrategy: z.string(),
  trainingSeed: z.number(),
  samplingSeed: z.number(),
  trainingRowIndices: z.array(z.number().int()),
  sampleSize: z.number(),
  referenceSha256: z.string(),
  binding: z.string(),
  definition: z.string(),
});
const mapping = z.object({ transformed: z.string(), feature: z.string() });
const localDevice = z.object({
  model: modelMeta,
  background: backgroundRef,
  outputSpace: z.literal('LOG_TIME_MS'),
  contributionUnits: z.literal('ln(ms)'),
  baselineOutput: z.number().finite(),
  baselineReferenceMs: z.number().finite().positive(),
  finalOutput: z.number().finite(),
  predictedTimeMs: z.number().finite().positive(),
  savedPredictionTimeMs: z.number().finite().positive().nullable(),
  repetitions: z.number().int().positive(),
  reconstructedOutput: z.number().finite(),
  additivity: z.object({
    passed: z.literal(true),
    residual: z.number().finite(),
    tolerance: z.number().positive(),
  }),
  contributions: z.array(
    z.object({
      feature: z.string(),
      value: z.number().finite(),
      direction: z.enum(['INCREASE', 'DECREASE', 'NEUTRAL']),
      magnitude: z.number().nonnegative(),
    }),
  ),
  transformedContributions: z.array(mapping.extend({ value: z.number().finite() })),
  summary: z.array(z.string()),
  limitations: z.array(z.string()),
  predictionArtifactBinding: z.string().optional(),
});
export type LocalExplanation = z.infer<typeof localDevice>;
const globalDevice = z.object({
  model: modelMeta,
  background: backgroundRef,
  outputSpace: z.literal('LOG_TIME_MS'),
  contributionUnits: z.literal('ln(ms)'),
  baselineOutput: z.number().finite(),
  importance: z.array(
    z.object({
      feature: z.string(),
      meanAbsShap: z.number().nonnegative(),
      rank: z.number().int().positive(),
    }),
  ),
  evaluation: z.object({
    sampleSize: z.number().int().positive(),
    rowIndices: z.array(z.number().int()),
    samplingSeed: z.number(),
    split: z.literal('HELD_OUT_TEST'),
    workloadFamily: z.string().nullable(),
    families: z.record(z.string(), z.number().int()),
  }),
  transformedMapping: z.array(mapping),
  additivity: z.object({
    passed: z.literal(true),
    maxAbsResidual: z.number().finite().nonnegative(),
    maxTolerance: z.number().positive(),
  }),
  limitations: z.array(z.string()),
});
export type GlobalExplanation = z.infer<typeof globalDevice>;
export const explanationResultSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('LOCAL'),
    provenance: z.literal('SHAP_MODEL_ATTRIBUTION'),
    predictionProvenance: z.literal('PREDICTED'),
    models: z.object({ CPU: localDevice, GPU: localDevice }),
  }),
  z.object({
    kind: z.literal('GLOBAL'),
    provenance: z.literal('SHAP_MODEL_ATTRIBUTION'),
    global: globalDevice,
  }),
]);
export const explanationSchema = z.object({
  id: z.string(),
  kind: z.enum(['LOCAL', 'GLOBAL']),
  predictionId: z.string().nullable(),
  modelId: z.string().nullable(),
  options: z.record(z.string(), z.unknown()),
  status: z.enum(['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED']),
  result: explanationResultSchema.nullable(),
  error: z.string().nullable(),
  attempts: z.number().int(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type ModelExplanation = z.infer<typeof explanationSchema>;
export const explanationResponseSchema = z.object({ data: explanationSchema });
export const explanationListSchema = z.object({ data: z.array(explanationSchema) });
export const globalExplanationResponseSchema = z.object({ data: explanationSchema.nullable() });
