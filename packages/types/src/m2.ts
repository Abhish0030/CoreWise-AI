import { z } from 'zod';
import { hardwareSchema } from './m1.js';

const positive = (max: number) =>
  z
    .number()
    .finite()
    .min(1e-9, 'Supply a positive capability of at least 1e-9 in the stated units')
    .max(max)
    .nullable();
export const capabilitySchema = z
  .object({
    precision: z.enum(['FP32', 'FP64', 'FLOP_EQUIVALENT']),
    cpuPeakGflops: positive(1e8),
    cpuBandwidthGbps: positive(1e6),
    cpuCores: z.number().int().min(1).max(4096).nullable(),
    gpuPeakGflops: positive(1e9),
    gpuBandwidthGbps: positive(1e7),
    transferBandwidthGbps: positive(1e6),
    kernelLaunchUs: z.number().finite().min(0).max(1e9).nullable(),
    transferConvention: z.enum(['TOTAL_BYTES', 'ONE_WAY_ROUND_TRIP']),
  })
  .strict();
export type Capabilities = z.infer<typeof capabilitySchema>;
export const emptyCapabilities: Capabilities = {
  precision: 'FP32',
  cpuPeakGflops: null,
  cpuBandwidthGbps: null,
  cpuCores: null,
  gpuPeakGflops: null,
  gpuBandwidthGbps: null,
  transferBandwidthGbps: null,
  kernelLaunchUs: null,
  transferConvention: 'TOTAL_BYTES',
};
export const workloadCategorySchema = z.enum([
  'MATRIX_MULTIPLICATION',
  'VECTOR_ADDITION',
  'SORTING',
  'IMAGE_PROCESSING',
  'SCIENTIFIC_COMPUTATION',
  'CUSTOM',
  'REDUCTION',
]);
export const workloadShape = {
  name: z.string().trim().min(1, 'Enter a workload name').max(120),
  category: workloadCategorySchema,
  description: z.string().trim().max(2000),
  inputSize: z.number().finite().min(0).max(1e12),
  inputUnit: z.enum(['ELEMENTS', 'BYTES', 'MiB', 'GiB', 'ROWS', 'PIXELS', 'MATRIX_DIMENSION']),
  operationCount: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  arithmeticIntensity: z
    .number()
    .finite()
    .min(0)
    .max(1e12)
    .refine(
      (value) => value === 0 || value >= 1e-12,
      'Use zero only for zero operations, otherwise at least 1e-12 FLOPs/byte',
    ),
  parallelFraction: z.number().finite().min(0).max(1),
  memoryMiB: z.number().finite().min(0).max(1e9),
  transferMiB: z.number().finite().min(0).max(1e9),
  repetitions: z.number().int().min(1).max(10000),
  hardwareProfileId: z.string().min(1).max(100).nullable(),
  presetId: z.enum(['matrix', 'vector', 'sorting', 'image', 'scientific']).nullable(),
  assumptions: capabilitySchema,
  tolerance: z.number().finite().min(0).max(0.5),
};
export const workloadBaseSchema = z.object(workloadShape).strict();
function validateWorkload(
  value: { operationCount: number; arithmeticIntensity: number },
  ctx: z.RefinementCtx,
) {
  if (value.operationCount > 0 && value.arithmeticIntensity <= 0)
    ctx.addIssue({
      code: 'custom',
      path: ['arithmeticIntensity'],
      message: 'Arithmetic intensity must be greater than zero when operations are nonzero',
    });
}
export const workloadInputSchema = workloadBaseSchema.superRefine(validateWorkload);
export const workloadPatchSchema = workloadBaseSchema
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Supply at least one field');
export type WorkloadInput = z.infer<typeof workloadInputSchema>;
export const workloadSchema = workloadInputSchema.safeExtend({
  id: z.string(),
  provenance: z.enum(['USER_ENTERED', 'SYNTHETIC_DEMO']),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Workload = z.infer<typeof workloadSchema>;
export const workloadResponseSchema = z.object({ data: workloadSchema });
export const workloadListSchema = z.object({ data: z.array(workloadSchema) });
export const analyticalRequestSchema = z
  .object({
    workloadId: z.string().min(1).max(100),
    hardwareProfileId: z.string().min(1).max(100).optional(),
    assumptions: capabilitySchema,
    tolerance: z.number().finite().min(0).max(0.5),
  })
  .strict();
export const timingSchema = z.object({
  computeSeconds: z.number().finite().nonnegative(),
  memoryFloorSeconds: z.number().finite().nonnegative(),
  memoryStallSeconds: z.number().finite().nonnegative(),
  transferSeconds: z.number().finite().nonnegative(),
  launchSeconds: z.number().finite().nonnegative(),
  serialSeconds: z.number().finite().nonnegative(),
  parallelSeconds: z.number().finite().nonnegative(),
  totalSeconds: z.number().finite().nonnegative(),
  perRepetitionSeconds: z.number().finite().nonnegative(),
  effectiveThroughputGflops: z.number().finite().nonnegative().nullable(),
});
export type DeviceTiming = z.infer<typeof timingSchema>;
export const analyticalResultSchema = z.object({
  modelVersion: z.literal('cw-analytical-1.0.0'),
  provenance: z.literal('ANALYTICAL'),
  cpu: timingSchema.nullable(),
  gpu: timingSchema.nullable(),
  speedup: z.number().finite().nonnegative().nullable(),
  recommendation: z.enum(['CPU', 'GPU', 'SIMILAR', 'INSUFFICIENT_DATA']),
  reasons: z.array(z.string()),
  missingFields: z.array(z.string()),
  theoreticalCpuSpeedup: z.number().finite().positive().nullable(),
  assumptions: z.object({
    supplied: capabilitySchema,
    resolved: capabilitySchema,
    sources: z.record(z.string(), z.string()),
    tolerance: z.number(),
    repetitions: z.number(),
    memoryTrafficBytes: z.number().finite(),
    transferBytesPerRepetition: z.number().finite(),
    transferPolicy: z.string(),
    methodology: z.string(),
    presetNotes: z.array(z.string()),
  }),
  limitations: z.array(z.string()),
  warnings: z.array(z.string()),
});
export type AnalyticalResult = z.infer<typeof analyticalResultSchema>;
export const comparisonSchema = z.object({
  id: z.string(),
  kind: z.enum(['ESTIMATE', 'COMPARISON']),
  workloadId: z.string().nullable(),
  hardwareProfileId: z.string().nullable(),
  workloadSnapshot: workloadInputSchema,
  hardwareSnapshot: hardwareSchema,
  result: analyticalResultSchema,
  provenance: z.literal('ANALYTICAL'),
  modelVersion: z.string(),
  createdAt: z.string(),
});
export type Comparison = z.infer<typeof comparisonSchema>;
export const comparisonResponseSchema = z.object({ data: comparisonSchema });
export const comparisonListSchema = z.object({ data: z.array(comparisonSchema) });

const base: WorkloadInput = {
  name: '',
  category: 'CUSTOM',
  description: '',
  inputSize: 0,
  inputUnit: 'ELEMENTS',
  operationCount: 0,
  arithmeticIntensity: 0,
  parallelFraction: 0,
  memoryMiB: 0,
  transferMiB: 0,
  repetitions: 1,
  hardwareProfileId: null,
  presetId: null,
  assumptions: { ...emptyCapabilities },
  tolerance: 0.05,
};
export const blankWorkload = base;
export const workloadPresets: {
  id: NonNullable<WorkloadInput['presetId']>;
  label: string;
  notes: string[];
  values: WorkloadInput;
}[] = [
  {
    id: 'matrix',
    label: 'Matrix multiplication',
    notes: [
      'Illustrative dense FP32 square matrices, N=1024; W=2N³.',
      'Three arrays require 3×N²×4 bytes. Idealized traffic touches each array once, so AI=W/(12N²). Editing input size does not automatically recalculate other fields.',
    ],
    values: {
      ...base,
      name: 'Matrix multiplication · 1024²',
      category: 'MATRIX_MULTIPLICATION',
      presetId: 'matrix',
      inputSize: 1024,
      inputUnit: 'MATRIX_DIMENSION',
      operationCount: 2147483648,
      arithmeticIntensity: 1024 / 6,
      parallelFraction: 0.99,
      memoryMiB: 12,
      transferMiB: 12,
    },
  },
  {
    id: 'vector',
    label: 'Vector addition',
    notes: [
      'Illustrative FP32 vectors, N=1,048,576; W=N additions.',
      'Three arrays touch 12N bytes, AI=1/12 FLOPs/byte. Total transfer covers two inputs plus one output.',
    ],
    values: {
      ...base,
      name: 'Vector addition · 1M elements',
      category: 'VECTOR_ADDITION',
      presetId: 'vector',
      inputSize: 1048576,
      operationCount: 1048576,
      arithmeticIntensity: 1 / 12,
      parallelFraction: 0.99,
      memoryMiB: 12,
      transferMiB: 12,
    },
  },
  {
    id: 'sorting',
    label: 'Sorting',
    notes: [
      'Illustrative N=1,048,576, approximately N log₂N comparisons.',
      'Each comparison is treated as one FLOP-equivalent surrogate, not a floating-point instruction. AI=0.25 is an illustrative traffic assumption; this model is especially weak for sorting. Two FP32-size arrays occupy 8 MiB.',
    ],
    values: {
      ...base,
      name: 'Sorting · 1M elements',
      category: 'SORTING',
      presetId: 'sorting',
      inputSize: 1048576,
      operationCount: 20971520,
      arithmeticIntensity: 0.25,
      parallelFraction: 0.8,
      memoryMiB: 8,
      transferMiB: 8,
      assumptions: { ...emptyCapabilities, precision: 'FLOP_EQUIVALENT' },
    },
  },
  {
    id: 'image',
    label: 'Image processing',
    notes: [
      'Illustrative 1920×1080 single-channel FP32 3×3 convolution: 18 FLOPs/pixel.',
      'Input and output occupy 8 bytes/pixel; idealized AI=18/8. Border handling, reuse inefficiency, and padding are ignored.',
    ],
    values: {
      ...base,
      name: 'Image filter · 1080p',
      category: 'IMAGE_PROCESSING',
      presetId: 'image',
      inputSize: 2073600,
      inputUnit: 'PIXELS',
      operationCount: 37324800,
      arithmeticIntensity: 2.25,
      parallelFraction: 0.98,
      memoryMiB: 15.8203125,
      transferMiB: 15.8203125,
    },
  },
  {
    id: 'scientific',
    label: 'Scientific computation',
    notes: [
      'Illustrative 1M-cell FP64 stencil: 13 FLOPs/cell.',
      'Assume 64 bytes/cell traffic, AI=13/64. Two FP64 arrays occupy 16 MiB. This is a simplified numerical kernel, not a measured solver.',
    ],
    values: {
      ...base,
      name: 'Scientific stencil · 1M cells',
      category: 'SCIENTIFIC_COMPUTATION',
      presetId: 'scientific',
      inputSize: 1048576,
      operationCount: 13631488,
      arithmeticIntensity: 13 / 64,
      parallelFraction: 0.95,
      memoryMiB: 16,
      transferMiB: 16,
      assumptions: { ...emptyCapabilities, precision: 'FP64' },
    },
  },
];
