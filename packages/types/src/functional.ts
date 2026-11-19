import { analyticalResultSchema } from './m2.js';
import { predictionResultSchema } from './m3.js';
import { z } from 'zod';
export const telemetrySampleSchema = z
  .object({
    version: z.literal('cw-telemetry-1'),
    provenance: z.literal('MEASURED'),
    capturedAt: z.iso.datetime({ offset: true }),
    cpuUtilizationPercent: z.number().finite().min(0).max(100).nullable(),
    ramUsedBytes: z.number().finite().nonnegative(),
    ramTotalBytes: z.number().finite().positive(),
    cpuTemperatureC: z.number().finite().min(-20).max(150).nullable(),
    gpu: z
      .object({
        model: z.string().max(200),
        utilizationPercent: z.number().finite().min(0).max(100).nullable(),
        memoryUsedBytes: z.number().finite().nonnegative().nullable(),
        memoryTotalBytes: z.number().finite().positive().nullable(),
        temperatureC: z.number().finite().min(-20).max(150).nullable(),
        powerWatts: z.number().finite().nonnegative().nullable().optional(),
        // Provider names are capability-based (for example nvidia-smi or a
        // future Windows/AMD/Intel provider). The provider must identify the
        // source; unsupported values remain null.
        source: z.string().min(1).max(100),
      })
      .strict()
      .nullable(),
    cpuSource: z.literal('psutil'),
    temperatureSource: z.string().max(100).nullable(),
    limitations: z.array(z.string().max(300)).max(10),
  })
  .strict()
  .refine((v) => v.ramUsedBytes <= v.ramTotalBytes, 'RAM used must not exceed total');
export type TelemetrySample = z.infer<typeof telemetrySampleSchema>;
export const connectionSchema = z.object({
  data: z.object({
    agents: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        status: z.enum(['FRESH', 'STALE', 'AWAITING_TELEMETRY', 'EXPIRED']),
        receivedAt: z.string().nullable(),
        telemetry: telemetrySampleSchema.nullable(),
      }),
    ),
    selectedAgentId: z.string().nullable(),
    profileMatched: z.boolean(),
  }),
});
export const hardwareImportSchema = z
  .object({
    agentId: z.string().min(1).max(100),
    name: z.string().trim().min(1).max(120),
    setDefault: z.boolean().default(true),
  })
  .strict();
export const optimizationInputSchema = z
  .object({
    workloadId: z.string().min(1).max(100),
    hardwareProfileId: z.string().min(1).max(100),
    predictionId: z.string().max(100).optional(),
    benchmarkId: z.string().max(100).optional(),
    sizes: z.array(z.number().finite().positive().max(1e9)).max(24).optional(),
  })
  .strict();

const recommendationValue = z.enum(['CPU', 'GPU', 'SIMILAR', 'INSUFFICIENT_DATA']);
export const optimizationResponseSchema = z.object({
  data: z.object({
    readiness: z.object({
      ml: z.object({
        ready: z.boolean(),
        reasons: z.array(z.string()),
        models: z.array(
          z.object({
            id: z.string(),
            target: z.string(),
            version: z.string(),
            provenance: z.string(),
          }),
        ),
      }),
      analytical: z.object({ ready: z.boolean(), missing: z.array(z.string()) }),
    }),
    recommendation: z.object({
      recommendation: recommendationValue,
      basis: z.enum(['MEASURED', 'PREDICTED', 'ANALYTICAL', 'INSUFFICIENT_DATA']),
      cpuMs: z.number().nullable(),
      gpuMs: z.number().nullable(),
      speedup: z.number().nullable(),
      validated: z.boolean(),
    }),
    analytical: analyticalResultSchema,
    mlPrediction: predictionResultSchema.nullable(),
    comparison: z
      .object({
        benchmarkId: z.string(),
        predictionId: z.string().nullable(),
        compatible: z.boolean(),
        scope: z.string(),
        cpuMeasuredMs: z.number(),
        gpuMeasuredMs: z.number(),
        cpuErrorPercent: z.number().nullable(),
        gpuErrorPercent: z.number().nullable(),
      })
      .nullable(),
    threadComparisons: z.array(
      z.object({
        id: z.string(),
        threads: z.number(),
        cpuMs: z.number(),
        seed: z.number(),
        dtype: z.string(),
      }),
    ),
    compatibility: z.array(z.string()),
    crossover: z.object({
      points: z.array(
        z.object({
          size: z.number(),
          cpuMs: z.number().nullable(),
          gpuMs: z.number().nullable(),
          recommendation: z.string(),
        }),
      ),
      brackets: z.array(
        z.object({
          lowerSize: z.number(),
          upperSize: z.number(),
          provenance: z.string(),
          modelVersion: z.string(),
        }),
      ),
      methodology: z.string(),
    }),
    references: z.object({
      workloadId: z.string(),
      hardwareProfileId: z.string(),
      predictionId: z.string().nullable(),
      comparisonId: z.string().nullable(),
      benchmarkId: z.string().nullable(),
    }),
    warnings: z.array(z.string()),
    limitations: z.array(z.string()),
    modelVersion: z.string(),
  }),
});
export type OptimizationData = z.infer<typeof optimizationResponseSchema>['data'];
