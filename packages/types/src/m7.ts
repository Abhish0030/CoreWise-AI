import { z } from 'zod';
import { hardwareSchema } from './m1.js';
import { workloadSchema, comparisonSchema } from './m2.js';
import { predictionSchema } from './m3.js';
import { benchmarkRunSchema } from './m4.js';
import { explanationSchema } from './m5.js';
export const reportTypeSchema = z.enum([
  'OVERVIEW',
  'HARDWARE',
  'WORKLOAD',
  'ANALYTICAL',
  'ML_PREDICTION',
  'BENCHMARK',
  'EXPLAINABILITY',
]);
const ids = z.array(z.string().min(1).max(100)).max(6).default([]);
export const reportInputSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    type: reportTypeSchema,
    hardwareProfileId: z.string().min(1).max(100).optional(),
    workloadIds: ids,
    comparisonIds: ids,
    predictionIds: ids,
    benchmarkIds: ids,
    explanationIds: ids,
  })
  .strict()
  .superRefine((r, ctx) => {
    const all = [
      ...(r.hardwareProfileId ? [r.hardwareProfileId] : []),
      ...r.workloadIds,
      ...r.comparisonIds,
      ...r.predictionIds,
      ...r.benchmarkIds,
      ...r.explanationIds,
    ];
    if (all.length < 1 || all.length > 12)
      ctx.addIssue({ code: 'custom', message: 'Select 1–12 source records.' });
    for (const values of [
      r.workloadIds,
      r.comparisonIds,
      r.predictionIds,
      r.benchmarkIds,
      r.explanationIds,
    ])
      if (new Set(values).size !== values.length)
        ctx.addIssue({ code: 'custom', message: 'Duplicate source IDs are not allowed.' });
    const count = {
      OVERVIEW: all.length,
      HARDWARE: r.hardwareProfileId ? 1 : 0,
      WORKLOAD: r.workloadIds.length,
      ANALYTICAL: r.comparisonIds.length,
      ML_PREDICTION: r.predictionIds.length,
      BENCHMARK: r.benchmarkIds.length,
      EXPLAINABILITY: r.explanationIds.length,
    }[r.type];
    if (!count)
      ctx.addIssue({
        code: 'custom',
        message: 'Select at least one source matching the report type.',
      });
  });
export const reportReferenceSchema = z.object({
  kind: z.string(),
  id: z.string(),
  provenance: z.string(),
});
const field = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  unit: z.string().default(''),
});
export const reportSectionSchema = z.object({
  id: z.string(),
  kind: z.string(),
  title: z.string(),
  provenance: z.string(),
  fields: z.array(field),
  notes: z.array(z.string()),
  chart: z
    .object({
      title: z.string(),
      unit: z.string(),
      signed: z.boolean().default(false),
      bars: z.array(z.object({ label: z.string(), value: z.number().finite() })),
    })
    .nullable(),
});
export const reportSnapshotSchema = z.object({
  schemaVersion: z.literal('cw-report-1'),
  title: z.string(),
  type: reportTypeSchema,
  generatedAt: z.string(),
  references: z.array(reportReferenceSchema),
  sections: z.array(reportSectionSchema),
  limitations: z.array(z.string()),
  sources: z.object({
    hardware: z.array(hardwareSchema),
    workloads: z.array(workloadSchema),
    comparisons: z.array(comparisonSchema),
    predictions: z.array(predictionSchema),
    benchmarks: z.array(benchmarkRunSchema),
    explanations: z.array(explanationSchema),
  }),
});
export const reportSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  type: reportTypeSchema,
  status: z.literal('READY'),
  createdAt: z.string(),
  sourceCount: z.number(),
  exportMetadata: z.object({
    version: z.literal('cw-export-1'),
    pdfSha256: z.string(),
    csvSha256: z.string(),
    pdfBytes: z.number(),
    csvBytes: z.number(),
  }),
});
export const reportSchema = reportSummarySchema.extend({
  configuration: reportInputSchema,
  snapshot: reportSnapshotSchema,
});
export const reportListSchema = z.object({ data: z.array(reportSummarySchema) });
export const reportResponseSchema = z.object({ data: reportSchema });
export const reportPreviewSchema = z.object({ data: reportSnapshotSchema });
export const reportSourcesSchema = z.object({
  data: z.object({
    hardware: z.array(z.object({ id: z.string(), label: z.string() })),
    workloads: z.array(z.object({ id: z.string(), label: z.string() })),
    comparisons: z.array(z.object({ id: z.string(), label: z.string() })),
    predictions: z.array(z.object({ id: z.string(), label: z.string() })),
    benchmarks: z.array(z.object({ id: z.string(), label: z.string() })),
    explanations: z.array(z.object({ id: z.string(), label: z.string() })),
  }),
});
export type ReportInput = z.infer<typeof reportInputSchema>;
export type ReportSnapshot = z.infer<typeof reportSnapshotSchema>;
export type ReportSection = z.infer<typeof reportSectionSchema>;
export type GeneratedReport = z.infer<typeof reportSchema>;
export const workspaceSummarySchema = z.object({
  data: z.object({
    version: z.literal('0.8.0'),
    counts: z.object({
      hardware: z.number(),
      workloads: z.number(),
      comparisons: z.number(),
      predictions: z.number(),
      benchmarks: z.number(),
      explanations: z.number(),
      reports: z.number(),
    }),
    models: z.array(
      z.object({
        id: z.string(),
        target: z.string(),
        algorithm: z.string(),
        version: z.string(),
        provenance: z.string(),
      }),
    ),
    prediction: z
      .object({
        id: z.string(),
        cpuTimeMs: z.number(),
        gpuTimeMs: z.number(),
        trainingProvenance: z.array(z.string()),
        createdAt: z.string(),
      })
      .nullable(),
    benchmarks: z.array(
      z.object({
        id: z.string(),
        workload: z.string(),
        scope: z.string(),
        cpuMedianMs: z.number(),
        gpuMedianMs: z.number().nullable(),
        valid: z.boolean(),
        createdAt: z.string(),
      }),
    ),
    explanation: z
      .object({
        id: z.string(),
        kind: z.string(),
        createdAt: z.string(),
        unit: z.literal('ln(ms)'),
      })
      .nullable(),
    report: z.object({ id: z.string(), title: z.string(), createdAt: z.string() }).nullable(),
  }),
});
