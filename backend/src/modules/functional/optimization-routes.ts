import { isDeepStrictEqual } from 'node:util';
import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { rateLimit } from 'express-rate-limit';
import {
  optimizationInputSchema,
  hardwareSchema,
  workloadInputSchema,
  benchmarkMeasurementSchema,
  predictionResultSchema,
} from '@corewise/types';
import { db } from '../../lib/db.js';
import { ApiError, validate } from '../../lib/errors.js';
import { requireUser } from '../auth/routes.js';
import { serializeWorkload } from '../workloads/routes.js';
import { computePrediction } from '../ml/routes.js';
import { estimate, MODEL_VERSION } from '../analytical/model.js';
import { compatibleMeasurement, optimizationGrid, choose } from './optimization.js';
const json = (x: unknown) => JSON.parse(JSON.stringify(x)) as Prisma.InputJsonValue;
export function optimizationRoutes() {
  const r = Router();
  r.use(requireUser);
  r.use(
    rateLimit({
      windowMs: 60000,
      limit: 20,
      keyGenerator: (req) => req.session.userId!,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: {
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many optimization requests. Try again shortly.',
        },
      },
    }),
  );
  r.post(['/preview', '/run'], validate(optimizationInputSchema), async (req, res) => {
    res.json(
      await computeOptimization(
        req.session.userId!,
        optimizationInputSchema.parse(req.body),
        req.path === '/run',
      ),
    );
  });
  return r;
}
export async function computeOptimization(
  userId: string,
  input: ReturnType<typeof optimizationInputSchema.parse>,
  persist = false,
) {
  const [wr, hr, models] = await Promise.all([
    db.workload.findUnique({ where: { id_userId: { id: input.workloadId, userId } } }),
    db.hardwareProfile.findUnique({
      where: { id_userId: { id: input.hardwareProfileId, userId } },
    }),
    db.mLModel.findMany({ where: { userId, active: true, status: 'READY' } }),
  ]);
  if (!wr || !hr)
    throw new ApiError(404, 'NOT_FOUND', 'Select an owned workload and hardware profile.');
  if (
    input.benchmarkId &&
    !(await db.benchmarkRun.findUnique({
      where: { id_userId: { id: input.benchmarkId, userId } },
    }))
  )
    throw new ApiError(404, 'NOT_FOUND', 'Benchmark not found.');
  const w = workloadInputSchema.parse({
    ...workloadInputSchema.strip().parse(serializeWorkload(wr)),
    hardwareProfileId: hr.id,
  });
  const h = hardwareSchema.parse({
    ...Object.fromEntries(Object.entries(hr).filter(([key]) => key !== 'userId')),
    createdAt: hr.createdAt.toISOString(),
    updatedAt: hr.updatedAt.toISOString(),
  });
  const analytical = estimate(w, h, w.assumptions, w.tolerance),
    reasons: string[] = [],
    warnings: string[] = [];
  let predictionId: string | null = input.predictionId ?? null,
    comparisonId: string | null = null;
  let ml: ReturnType<typeof predictionResultSchema.parse> | null = null;
  if (input.predictionId) {
    const p = await db.mLPrediction.findUnique({
      where: { id_userId: { id: input.predictionId, userId } },
    });
    if (!p) throw new ApiError(404, 'NOT_FOUND', 'Prediction not found.');
    if (p.workloadId !== wr.id || p.hardwareProfileId !== hr.id)
      throw new ApiError(
        422,
        'INCOMPATIBLE_PREDICTION',
        'Prediction belongs to another workload/profile.',
      );
    const old = p.workloadSnapshot as unknown as typeof w;
    if (
      [
        'category',
        'inputSize',
        'inputUnit',
        'operationCount',
        'arithmeticIntensity',
        'parallelFraction',
        'memoryMiB',
        'transferMiB',
        'repetitions',
        'assumptions',
      ].some((k) => !isDeepStrictEqual(old[k as keyof typeof w], w[k as keyof typeof w]))
    )
      throw new ApiError(
        422,
        'SNAPSHOT_CHANGED',
        'Workload inputs changed; preserve this historical prediction and generate a new one.',
      );
    const oh = p.hardwareSnapshot as unknown as typeof h;
    if (
      [
        'cpuName',
        'gpuName',
        'physicalCores',
        'vramGb',
        'ramGb',
        'cpuBaseGhz',
        'memoryBandwidthGbps',
      ].some((k) => oh[k as keyof typeof h] !== h[k as keyof typeof h])
    )
      throw new ApiError(
        422,
        'SNAPSHOT_CHANGED',
        'Hardware inputs changed; generate a new prediction.',
      );
    ml = predictionResultSchema.parse(p.result);
    for (const target of ['CPU', 'GPU'] as const) {
      const ref = ml.models[target],
        m = await db.mLModel.findUnique({ where: { id_userId: { id: ref.id, userId } } });
      if (
        !m ||
        m.version !== ref.version ||
        m.target !== target ||
        (ref.artifactSha256 && m.sha256 !== ref.artifactSha256)
      )
        throw new ApiError(
          409,
          'MODEL_VERSION_MISMATCH',
          'Saved prediction registry version/hash does not match.',
        );
    }
  } else {
    for (const target of ['CPU', 'GPU'])
      if (!models.some((m) => m.target === target))
        reasons.push(
          `No active compatible ${target} model. Train measured data and activate a version, or use analytical estimation.`,
        );
    // Exact device metadata, when available, prevents single-machine models being silently applied elsewhere.
    for (const m of models) {
      const d = await db.dataset.findUnique({
        where: { id_userId: { id: m.datasetId, userId } },
      });
      const meta = d?.validation as {
        detectedHardware?: { cpuModel: string; gpuModel: string }[];
      } | null;
      if (
        meta?.detectedHardware?.length &&
        !meta.detectedHardware.some((e) => e.cpuModel === h.cpuName && e.gpuModel === h.gpuName)
      )
        reasons.push(
          `${m.target} model has no measured training evidence for the selected CPU/GPU identities.`,
        );
    }
    if (!reasons.length) {
      try {
        const computed = await computePrediction(userId, {
          workloadId: wr.id,
          hardwareProfileId: hr.id,
          assumptions: w.assumptions,
        });
        ml = computed.result;
        if (persist) {
          const p = await db.mLPrediction.create({
            data: {
              userId,
              workloadId: wr.id,
              hardwareProfileId: hr.id,
              workloadSnapshot: json(computed.w),
              hardwareSnapshot: json(computed.h),
              features: json(computed.parsed.data),
              result: json(ml),
              provenance: 'PREDICTED',
            },
          });
          predictionId = p.id;
        }
      } catch (e) {
        if (e instanceof ApiError && e.status < 500) reasons.push(e.message);
        else reasons.push('Private ML service unavailable; analytical fallback remains available.');
      }
    }
  }
  if (persist) {
    const record = await db.comparisonResult.create({
      data: {
        userId,
        workloadId: wr.id,
        hardwareProfileId: hr.id,
        kind: 'COMPARISON',
        workloadSnapshot: json(w),
        hardwareSnapshot: json(h),
        result: json(analytical),
        modelVersion: MODEL_VERSION,
        provenance: 'ANALYTICAL',
      },
    });
    comparisonId = record.id;
  }
  const runs = await db.benchmarkRun.findMany({
    where: { userId, ...(input.benchmarkId ? { id: input.benchmarkId } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  if (input.benchmarkId && !runs.length)
    throw new ApiError(404, 'NOT_FOUND', 'Benchmark not found.');
  const agentId = (hr.detectionSnapshot as { agentId?: string } | null)?.agentId;
  const matching = runs.find(
    (run) =>
      run.agentId === agentId &&
      compatibleMeasurement(w, h, benchmarkMeasurementSchema.parse(run.measurement)),
  );
  const measured = matching ? benchmarkMeasurementSchema.parse(matching.measurement) : null;
  const compatibility: string[] = [];
  if (input.benchmarkId && !matching)
    compatibility.push(
      'Measurement does not match detected runner, workload family/size/unit/precision, correctness, one-thread policy, end-to-end scope or hardware. No error percentage is computed.',
    );
  const ac = analytical.cpu ? analytical.cpu.totalSeconds * 1000 : null,
    ag = h.gpuName && analytical.gpu ? analytical.gpu.totalSeconds * 1000 : null;
  const measuredTraining =
    !!ml &&
    ml.models.CPU.datasetProvenance === 'MEASURED' &&
    ml.models.GPU.datasetProvenance === 'MEASURED';
  const basis = measured
    ? 'MEASURED'
    : measuredTraining
      ? 'PREDICTED'
      : ac !== null && ag !== null
        ? 'ANALYTICAL'
        : 'INSUFFICIENT_DATA';
  const cpuMs = measured
    ? measured.cpu.summary.medianMs * w.repetitions
    : basis === 'PREDICTED'
      ? ml!.cpuTimeMs
      : ac;
  const gpuMs = measured
    ? measured.gpu!.summary.medianMs * w.repetitions
    : basis === 'PREDICTED'
      ? ml!.gpuTimeMs
      : ag;
  if (ml) warnings.push(...ml.warnings, ml.label);
  warnings.push(...analytical.warnings);
  if (ml && !measuredTraining)
    warnings.push(
      'Synthetic-trained predictions are shown for demonstration and do not outrank analytical estimates for real-device recommendations.',
    );
  warnings.push(
    'Measured validation applies only to this exact compatible configuration; no global hardware superiority or calibrated accuracy is established.',
    'Thread count is not an ML feature. This comparison supports the one-thread measured collection policy only.',
    'Batch-size/resident-data optimization is unsupported by the current invocation contract; no automatic batch recommendation is fabricated.',
  );
  const sizes = [
    ...new Set(
      input.sizes ??
        [0.25, 0.5, 1, 2, 4, 8].map((x) =>
          Math.min(1e9, Math.max(16, Math.round(w.inputSize * x))),
        ),
    ),
  ].sort((a, b) => a - b);
  const threadRuns = await db.benchmarkRun.findMany({
    where: { userId, ...(agentId ? { agentId } : { id: '__none__' }) },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  const threadComparisons = threadRuns
    .filter((run) =>
      compatibleMeasurement(w, h, benchmarkMeasurementSchema.parse(run.measurement), 0),
    )
    .map((run) => {
      const m = benchmarkMeasurementSchema.parse(run.measurement);
      return {
        id: run.id,
        threads: m.config.threads,
        cpuMs: m.cpu.summary.medianMs,
        seed: m.config.seed,
        dtype: m.config.dtype,
      };
    });
  const comparison = measured
    ? {
        benchmarkId: matching!.id,
        predictionId,
        compatible: true,
        scope: measured.config.scope,
        cpuMeasuredMs: measured.cpu.summary.medianMs * w.repetitions,
        gpuMeasuredMs: measured.gpu!.summary.medianMs * w.repetitions,
        cpuErrorPercent:
          ml && measured.cpu.summary.medianMs * w.repetitions > 1e-9
            ? (100 * (ml.cpuTimeMs - measured.cpu.summary.medianMs * w.repetitions)) /
              (measured.cpu.summary.medianMs * w.repetitions)
            : null,
        gpuErrorPercent:
          ml && measured.gpu!.summary.medianMs * w.repetitions > 1e-9
            ? (100 * (ml.gpuTimeMs - measured.gpu!.summary.medianMs * w.repetitions)) /
              (measured.gpu!.summary.medianMs * w.repetitions)
            : null,
      }
    : null;
  return {
    data: {
      readiness: {
        ml: {
          ready: !!ml,
          reasons,
          models: models.map((m) => ({
            id: m.id,
            target: m.target,
            version: m.version,
            provenance: m.provenance,
          })),
        },
        analytical: { ready: ac !== null && ag !== null, missing: analytical.missingFields },
      },
      recommendation: {
        ...choose(cpuMs, gpuMs, w.tolerance),
        basis,
        cpuMs,
        gpuMs,
        validated: !!measured,
      },
      analytical,
      mlPrediction: ml,
      comparison,
      threadComparisons,
      compatibility,
      crossover: optimizationGrid(w, h, w.assumptions, sizes),
      references: {
        workloadId: wr.id,
        hardwareProfileId: hr.id,
        predictionId,
        comparisonId,
        benchmarkId: matching?.id ?? null,
      },
      warnings,
      limitations: [
        'Crossover uses the analytical model and declared scaling only; brackets are not measured thresholds.',
        'Capabilities are explicit supplied inputs; no FLOPS are inferred from GHz.',
      ],
      modelVersion: MODEL_VERSION,
    },
  };
}
