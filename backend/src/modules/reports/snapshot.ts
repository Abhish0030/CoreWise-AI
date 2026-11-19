import {
  reportInputSchema,
  reportSnapshotSchema,
  hardwareSchema,
  workloadSchema,
  comparisonSchema,
  predictionSchema,
  benchmarkRunSchema,
  explanationSchema,
  type ReportInput,
  type ReportSnapshot,
  type ReportSection,
} from '@corewise/types';
import { db } from '../../lib/db.js';
import { ApiError } from '../../lib/errors.js';
import { clean } from '../assistant/safety.js';
export const reportLimitations = [
  'Selected records are independent evidence. Matching hardware, workload, precision, repetitions and transfer/timing scopes are required for direct comparisons.',
  'USER_ENTERED hardware and capability assumptions are unverified. ANALYTICAL estimates are mathematical approximations; PREDICTED values are fitted-model outputs, not measurements.',
  'SYNTHETIC_DEMO training/evaluation does not establish real hardware accuracy. MEASURED benchmark metadata is runner-reported, with correctness and methodology retained.',
  'SHAP contributions are grouped model attributions in ln(ms), not additive millisecond differences, physical causality or a speedup attribution. CPU and GPU use separate baselines.',
  'Missing values remain unknown. Reports retain immutable source snapshots; later source edits/deletion do not update generated evidence.',
];
const unit = (key: string) =>
  /(baselineOutput|finalOutput|reconstructedOutput|contributions\.\d+\.value|meanAbsShap|additivity\.(residual|maxAbsResidual|tolerance|maxTolerance))$/i.test(
    key,
  )
    ? 'ln(ms)'
    : /Seconds$/.test(key)
      ? 's'
      : /Ms$|_ms$/.test(key)
        ? 'ms'
        : /MiB$|_mib$/.test(key)
          ? 'MiB'
          : /Ghz$|_ghz$/.test(key)
            ? 'GHz'
            : /Mhz$/.test(key)
              ? 'MHz'
              : /Gbps$|_gbps$/.test(key)
                ? 'GB/s'
                : /Gflops$|_gflops$/.test(key)
                  ? 'GFLOP/s'
                  : /Gb$|_gb$/.test(key)
                    ? 'GB'
                    : /Us$|_us$/.test(key)
                      ? 'µs'
                      : '';
export function fields(value: unknown, prefix = ''): ReportSection['fields'] {
  if (value === null || typeof value !== 'object')
    return [
      {
        label: prefix,
        value:
          value === null
            ? null
            : typeof value === 'number' || typeof value === 'boolean'
              ? value
              : String(value),
        unit: unit(prefix),
      },
    ];
  return Object.entries(value).flatMap(([key, v]) => fields(v, prefix ? `${prefix}.${key}` : key));
}
function section(
  kind: string,
  id: string,
  title: string,
  provenance: string,
  details: unknown,
  notes: string[] = [],
  chart: ReportSection['chart'] = null,
): ReportSection {
  return { kind, id, title, provenance, fields: fields(details), notes, chart };
}
const timing = (
  title: string,
  cpu: number | null | undefined,
  gpu: number | null | undefined,
): ReportSection['chart'] => ({
  title,
  unit: 'ms',
  signed: false,
  bars: [
    ...(cpu !== null && cpu !== undefined ? [{ label: 'CPU', value: cpu }] : []),
    ...(gpu !== null && gpu !== undefined ? [{ label: 'GPU', value: gpu }] : []),
  ],
});
export function reportSections(s: ReportSnapshot['sources']): ReportSection[] {
  const out: ReportSection[] = [];
  for (const h of s.hardware)
    out.push(
      section('hardware', h.id, h.name, h.provenance, h, [
        'Specifications were entered by the user; they are not detected sensors or verified measurements.',
      ]),
    );
  for (const w of s.workloads)
    out.push(
      section('workload', w.id, w.name, w.provenance, w, [
        'Capability assumptions are explicit saved inputs. No throughput is inferred from frequency.',
      ]),
    );
  for (const c of s.comparisons) {
    const r = c.result;
    out.push(
      section(
        'analytical',
        c.id,
        `${c.workloadSnapshot.name} - analytical comparison`,
        'ANALYTICAL',
        {
          modelVersion: r.modelVersion,
          sourceCreatedAt: c.createdAt,
          workload: c.workloadSnapshot,
          hardware: c.hardwareSnapshot,
          cpu: r.cpu,
          gpu: r.gpu,
          ratioCpuOverGpu: r.speedup,
          recommendation: r.recommendation,
          assumptions: r.assumptions,
          missingFields: r.missingFields,
        },
        [...r.reasons, ...r.warnings, ...r.limitations],
        timing(
          'Analytical total execution time',
          r.cpu ? r.cpu.totalSeconds * 1000 : null,
          r.gpu ? r.gpu.totalSeconds * 1000 : null,
        ),
      ),
    );
  }
  for (const p of s.predictions) {
    const r = p.result;
    out.push(
      section(
        'prediction',
        p.id,
        `${p.workloadSnapshot.name} - ML prediction`,
        'PREDICTED',
        {
          sourceCreatedAt: p.createdAt,
          workload: p.workloadSnapshot,
          hardware: p.hardwareSnapshot,
          features: p.features,
          models: r.models,
          cpuTimeMs: r.cpuTimeMs,
          gpuTimeMs: r.gpuTimeMs,
          ratioCpuOverGpu: r.speedup,
        },
        [
          r.label,
          ...r.warnings,
          'Fitted predictions are not measured timings. The model versions and training provenance above are the actual saved references.',
        ],
        timing('Predicted total execution time', r.cpuTimeMs, r.gpuTimeMs),
      ),
    );
  }
  for (const b of s.benchmarks) {
    const m = b.measurement;
    out.push(
      section(
        'benchmark',
        b.id,
        `${m.config.workload} - measured run`,
        'MEASURED',
        {
          sourceCreatedAt: b.createdAt,
          valid: b.valid,
          config: m.config,
          environment: m.environment,
          benchmarkVersion: m.benchmarkVersion,
          methodology: m.methodology,
          cpuSummary: m.cpu.summary,
          cpuCorrectness: m.cpu.correctness,
          gpuSummary: m.gpu?.summary ?? null,
          gpuCorrectness: m.gpu?.correctness ?? null,
          gpuUnavailableReason: m.gpuUnavailableReason,
        },
        [
          b.valid
            ? 'Correctness passed for the recorded run.'
            : 'Correctness failed. Retained for diagnostics; do not use as valid performance evidence.',
          'Timing scope and raw samples are retained in the immutable snapshot/CSV. This is not a controlled general performance study.',
        ],
        timing(
          `Measured median - ${m.config.scope}`,
          m.cpu.summary.medianMs,
          m.gpu?.summary.medianMs,
        ),
      ),
    );
  }
  for (const e of s.explanations) {
    if (!e.result) continue;
    if (e.result.kind === 'LOCAL')
      for (const target of ['CPU', 'GPU'] as const) {
        const r = e.result.models[target];
        out.push(
          section(
            'explanation',
            e.id,
            `${target} - local SHAP model attribution`,
            'SHAP_MODEL_ATTRIBUTION',
            {
              predictionId: e.predictionId,
              sourceCreatedAt: e.createdAt,
              model: r.model,
              background: r.background,
              outputSpace: r.outputSpace,
              contributionUnits: r.contributionUnits,
              baselineOutput: r.baselineOutput,
              baselineReferenceMs: r.baselineReferenceMs,
              finalOutput: r.finalOutput,
              predictedTimeMs: r.predictedTimeMs,
              savedPredictionTimeMs: r.savedPredictionTimeMs,
              repetitions: r.repetitions,
              additivity: r.additivity,
            },
            [
              ...r.summary,
              ...r.limitations,
              'Signed chart contributions use ln(ms). exp(baseline) is a geometric reference time, not mean milliseconds.',
            ],
            {
              title: `${target} signed grouped SHAP contributions`,
              unit: 'ln(ms)',
              signed: true,
              bars: r.contributions.map((c) => ({ label: c.feature, value: c.value })),
            },
          ),
        );
      }
    else {
      const r = e.result.global;
      out.push(
        section(
          'explanation',
          e.id,
          `${r.model.target} - global SHAP importance`,
          'SHAP_MODEL_ATTRIBUTION',
          {
            sourceCreatedAt: e.createdAt,
            model: r.model,
            background: r.background,
            evaluation: r.evaluation,
            additivity: r.additivity,
            outputSpace: r.outputSpace,
            contributionUnits: r.contributionUnits,
          },
          r.limitations,
          {
            title: 'Held-out mean absolute grouped SHAP',
            unit: 'ln(ms)',
            signed: false,
            bars: r.importance.map((c) => ({
              label: `${c.rank}. ${c.feature}`,
              value: c.meanAbsShap,
            })),
          },
        ),
      );
    }
  }
  return out;
}
function view(r: object) {
  return JSON.parse(
    JSON.stringify(Object.fromEntries(Object.entries(r).filter(([key]) => key !== 'userId'))),
  );
}
export async function buildSnapshot(
  userId: string,
  raw: ReportInput,
  generatedAt = new Date().toISOString(),
): Promise<ReportSnapshot> {
  const input = reportInputSchema.parse(raw);
  return db.$transaction(
    async (tx) => {
      // A consistent read prevents mixed versions during concurrent edits.
      const [hardware, workloads, comparisons, predictions, benchmarks, explanations] =
        await Promise.all([
          tx.hardwareProfile.findMany({
            where: { userId, id: { in: input.hardwareProfileId ? [input.hardwareProfileId] : [] } },
          }),
          tx.workload.findMany({ where: { userId, id: { in: input.workloadIds } } }),
          tx.comparisonResult.findMany({
            where: { userId, id: { in: input.comparisonIds }, kind: 'COMPARISON' },
          }),
          tx.mLPrediction.findMany({ where: { userId, id: { in: input.predictionIds } } }),
          tx.benchmarkRun.findMany({ where: { userId, id: { in: input.benchmarkIds } } }),
          tx.modelExplanation.findMany({
            where: { userId, id: { in: input.explanationIds }, status: 'COMPLETED' },
          }),
        ]);
      const groups = [hardware, workloads, comparisons, predictions, benchmarks, explanations];
      const selections = [
        input.hardwareProfileId ? [input.hardwareProfileId] : [],
        input.workloadIds,
        input.comparisonIds,
        input.predictionIds,
        input.benchmarkIds,
        input.explanationIds,
      ];
      if (groups.some((rows, i) => rows.length !== selections[i]!.length))
        throw new ApiError(
          404,
          'SOURCE_NOT_FOUND',
          'A selected source is missing, unavailable, or belongs to another user.',
        );
      const ordered = <T extends { id: string }>(rows: T[], ids: string[]) =>
        ids.map((id) => rows.find((r) => r.id === id)!);
      const sources = {
        hardware: hardware.map((r) => hardwareSchema.parse(view(r))),
        workloads: ordered(workloads, input.workloadIds).map((r) => workloadSchema.parse(view(r))),
        comparisons: ordered(comparisons, input.comparisonIds).map((r) =>
          comparisonSchema.parse(view(r)),
        ),
        predictions: ordered(predictions, input.predictionIds).map((r) =>
          predictionSchema.parse(view(r)),
        ),
        benchmarks: ordered(benchmarks, input.benchmarkIds).map((r) =>
          benchmarkRunSchema.parse(view(r)),
        ),
        explanations: ordered(explanations, input.explanationIds).map((r) =>
          explanationSchema.parse(view(r)),
        ),
      };
      const references = Object.entries(sources).flatMap(([kind, rows]) =>
        rows.map((r) => ({
          kind,
          id: r.id,
          provenance: 'provenance' in r ? String(r.provenance) : 'SHAP_MODEL_ATTRIBUTION',
        })),
      );
      const snapshot = reportSnapshotSchema.parse(
        clean({
          schemaVersion: 'cw-report-1',
          title: input.title,
          type: input.type,
          generatedAt,
          references,
          sources,
          sections: reportSections(sources),
          limitations: reportLimitations,
        }),
      );
      if (Buffer.byteLength(JSON.stringify(snapshot), 'utf8') > 750000)
        throw new ApiError(
          422,
          'REPORT_TOO_LARGE',
          'Selected evidence exceeds the report limit. Select fewer records.',
        );
      return snapshot;
    },
    { isolationLevel: 'RepeatableRead', timeout: 15000 },
  );
}
