import { Router } from 'express';
import {
  workspaceSummarySchema,
  predictionResultSchema,
  benchmarkMeasurementSchema,
} from '@corewise/types';
import { db } from '../../lib/db.js';
import { requireUser } from '../auth/routes.js';
export function workspaceRoutes() {
  const router = Router();
  router.use(requireUser);
  router.get('/summary', async (req, res) => {
    const userId = req.session.userId!;
    const [
      hardware,
      workloads,
      comparisons,
      predictions,
      benchmarks,
      explanations,
      reports,
      models,
      prediction,
      runs,
      explanation,
      report,
    ] = await Promise.all([
      db.hardwareProfile.count({ where: { userId } }),
      db.workload.count({ where: { userId } }),
      db.comparisonResult.count({ where: { userId, kind: 'COMPARISON' } }),
      db.mLPrediction.count({ where: { userId } }),
      db.benchmarkRun.count({ where: { userId } }),
      db.modelExplanation.count({ where: { userId, status: 'COMPLETED' } }),
      db.generatedReport.count({ where: { userId } }),
      db.mLModel.findMany({
        where: { userId, active: true, status: 'READY' },
        select: { id: true, target: true, algorithm: true, version: true, provenance: true },
      }),
      db.mLPrediction.findFirst({
        where: { userId },
        select: { id: true, result: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      db.benchmarkRun.findMany({
        where: { userId },
        select: { id: true, measurement: true, valid: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 3,
      }),
      db.modelExplanation.findFirst({
        where: { userId, status: 'COMPLETED' },
        select: { id: true, kind: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      db.generatedReport.findFirst({
        where: { userId },
        select: { id: true, title: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const p = prediction ? predictionResultSchema.parse(prediction.result) : null;
    res.json(
      workspaceSummarySchema.parse({
        data: {
          version: '0.8.0',
          counts: {
            hardware,
            workloads,
            comparisons,
            predictions,
            benchmarks,
            explanations,
            reports,
          },
          models,
          prediction:
            prediction && p
              ? {
                  id: prediction.id,
                  cpuTimeMs: p.cpuTimeMs,
                  gpuTimeMs: p.gpuTimeMs,
                  trainingProvenance: [
                    p.models.CPU.datasetProvenance,
                    p.models.GPU.datasetProvenance,
                  ],
                  createdAt: prediction.createdAt.toISOString(),
                }
              : null,
          benchmarks: runs.map((r) => {
            const m = benchmarkMeasurementSchema.parse(r.measurement);
            return {
              id: r.id,
              workload: m.config.workload,
              scope: m.config.scope,
              cpuMedianMs: m.cpu.summary.medianMs,
              gpuMedianMs: m.gpu?.summary.medianMs ?? null,
              valid: r.valid,
              createdAt: r.createdAt.toISOString(),
            };
          }),
          explanation: explanation
            ? { ...explanation, createdAt: explanation.createdAt.toISOString(), unit: 'ln(ms)' }
            : null,
          report: report ? { ...report, createdAt: report.createdAt.toISOString() } : null,
        },
      }),
    );
  });
  return router;
}
