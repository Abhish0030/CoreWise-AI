import { Router } from 'express';
import {
  Prisma,
  type Dataset,
  type MLModel,
  type TrainingJob,
  type MLPrediction,
} from '@prisma/client';
import {
  z,
  datasetInputSchema,
  trainingInputSchema,
  predictionInputSchema,
  mlFeaturesSchema,
  predictionResultSchema,
  datasetSchema,
  modelSchema,
  jobSchema,
  predictionSchema,
  hardwareSchema,
} from '@corewise/types';
import { db } from '../../lib/db.js';
import { ApiError, validate } from '../../lib/errors.js';
import { requireUser } from '../auth/routes.js';
import { publicationActive, sharedView, assertSharedCompatibility } from './shared.js';
import { serializeWorkload } from '../workloads/routes.js';

export async function mlRequest(path: string, body: unknown): Promise<unknown> {
  const token = process.env.ML_INTERNAL_TOKEN;
  if (!token || token.length < 32 || token.startsWith('replace-with-'))
    throw new ApiError(
      503,
      'ML_UNAVAILABLE',
      'Configure the private ML service credentials first.',
    );
  let response: globalThis.Response;
  try {
    response = await fetch(`${process.env.ML_ORIGIN ?? 'http://127.0.0.1:8000'}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new ApiError(
      503,
      'ML_UNAVAILABLE',
      'The private ML service is unavailable. Analytical estimates remain available.',
    );
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = z
      .object({ error: z.string().optional(), detail: z.string().optional() })
      .safeParse(payload);
    throw new ApiError(
      response.status === 409 ? 409 : response.status === 422 ? 422 : 503,
      response.status === 409
        ? 'MODEL_UNAVAILABLE'
        : response.status === 422
          ? 'ML_INPUT_INVALID'
          : 'ML_UNAVAILABLE',
      parsed.success
        ? (parsed.data.error ?? parsed.data.detail ?? 'ML request failed.')
        : 'ML service request failed.',
    );
  }
  return payload;
}
const ingestionSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())),
  rowCount: z.number().int().min(60).max(5000),
  provenance: z.enum(['MEASURED', 'SYNTHETIC_DEMO']),
  version: z.string(),
  schemaVersion: z.literal('cw-features-1'),
  validation: z.record(z.string(), z.unknown()),
});
const asJson = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
function datasetView(d: Dataset, preview = false) {
  return datasetSchema.parse({
    ...d,
    createdAt: d.createdAt.toISOString(),
    ...(preview ? { preview: (d.rows as Prisma.JsonArray).slice(0, 8) } : {}),
  });
}
function modelView(m: MLModel) {
  return modelSchema.parse({ ...m, createdAt: m.createdAt.toISOString() });
}
function jobView(j: TrainingJob & { models: { id: string }[] }) {
  return jobSchema.parse({
    ...j,
    createdAt: j.createdAt.toISOString(),
    startedAt: j.startedAt?.toISOString() ?? null,
    completedAt: j.completedAt?.toISOString() ?? null,
    modelIds: j.models.map((m) => m.id),
  });
}
function predictionView(p: MLPrediction) {
  return predictionSchema.parse({ ...p, createdAt: p.createdAt.toISOString() });
}

export async function computePrediction(
  userId: string,
  input: z.infer<typeof predictionInputSchema>,
) {
  const [workload, hardware] = await Promise.all([
    db.workload.findUnique({ where: { id_userId: { id: input.workloadId, userId } } }),
    db.hardwareProfile.findUnique({
      where: { id_userId: { id: input.hardwareProfileId, userId } },
    }),
  ]);
  if (!workload || !hardware)
    throw new ApiError(404, 'NOT_FOUND', 'Owned workload or hardware profile not found.');
  for (const id of [input.cpuModelId, input.gpuModelId].filter((v): v is string => !!v)) {
    const model = await db.mLModel.findUnique({ where: { id }, include: { publication: true } });
    if (!model || (model.userId !== userId && !publicationActive(model, model.publication)))
      throw new ApiError(404, 'NOT_FOUND', 'Model not found.');
  }
  const a = input.assumptions;
  const parsed = mlFeaturesSchema.safeParse({
    workload_type: workload.category,
    workload_unit: workload.inputUnit,
    precision: a.precision,
    workload_size: workload.inputSize,
    operation_count: workload.operationCount,
    arithmetic_intensity: workload.arithmeticIntensity,
    parallel_fraction: workload.parallelFraction,
    memory_mib: workload.memoryMiB,
    transfer_mib: workload.transferMiB * (a.transferConvention === 'ONE_WAY_ROUND_TRIP' ? 2 : 1),
    cpu_cores: a.cpuCores ?? hardware.physicalCores,
    cpu_frequency_ghz: hardware.cpuBaseGhz,
    cpu_gflops: a.cpuPeakGflops,
    cpu_bandwidth_gbps: a.cpuBandwidthGbps,
    gpu_gflops: a.gpuPeakGflops,
    gpu_bandwidth_gbps: a.gpuBandwidthGbps ?? hardware.memoryBandwidthGbps,
    gpu_memory_gb: hardware.vramGb,
    transfer_bandwidth_gbps: a.transferBandwidthGbps,
    launch_overhead_us: a.kernelLaunchUs,
  });
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new ApiError(
      422,
      'FEATURES_REQUIRED',
      `Supply valid ML features: ${missing}. No performance capability is inferred from GHz.`,
    );
  }
  if (hardware.vramGb !== null && workload.memoryMiB * 2 ** 20 > hardware.vramGb * 1e9)
    throw new ApiError(
      422,
      'CAPACITY_EXCEEDED',
      'Workload footprint exceeds declared GPU capacity.',
    );
  for (const id of [input.cpuModelId, input.gpuModelId].filter((v): v is string => !!v)) {
    const model = await db.mLModel.findUnique({ where: { id }, include: { publication: true } });
    if (!model || (model.userId !== userId && !publicationActive(model, model.publication)))
      throw new ApiError(404, 'NOT_FOUND', 'Model not found.');
    if (model.userId !== userId)
      assertSharedCompatibility(model.publication!, hardware, parsed.data);
  }
  const result = predictionResultSchema.parse(
    await mlRequest('/internal/predict', {
      userId,
      features: parsed.data,
      cpuModelId: input.cpuModelId,
      gpuModelId: input.gpuModelId,
      hardwareProfileId: hardware.id,
    }),
  );
  // Re-authorize before persisting/returning; the Python service independently
  // checks the same publication. Whitelist shared metadata at this boundary too.
  for (const target of ['CPU', 'GPU'] as const) {
    const reference = result.models[target];
    const model = await db.mLModel.findUnique({
      where: { id: reference.id },
      include: { publication: true },
    });
    if (!model || model.target !== target)
      throw new ApiError(409, 'MODEL_UNAVAILABLE', 'Prediction model is no longer available.');
    if (model.userId !== userId) {
      if (!publicationActive(model, model.publication))
        throw new ApiError(409, 'MODEL_UNAVAILABLE', 'Shared publication was revoked or changed.');
      assertSharedCompatibility(model.publication!, hardware, parsed.data);
      result.models[target] = {
        id: model.id,
        version: model.version,
        algorithm: model.algorithm,
        schemaVersion: model.schemaVersion,
        datasetProvenance: model.provenance,
        access: 'SHARED_EXPERIMENTAL',
        limitations: model.publication!.limitations,
      };
    }
  }
  result.cpuTimeMs *= workload.repetitions;
  result.gpuTimeMs *= workload.repetitions;
  const w = serializeWorkload(workload);
  const h = hardwareSchema.parse({
    ...Object.fromEntries(Object.entries(hardware).filter(([key]) => key !== 'userId')),
    createdAt: hardware.createdAt.toISOString(),
    updatedAt: hardware.updatedAt.toISOString(),
  });

  return { workload, hardware, parsed, result, w, h };
}
export function mlRoutes() {
  const router = Router();
  router.use(requireUser);
  router.get('/model-catalog', async (req, res) => {
    const userId = req.session.userId!;
    const models = await db.mLModel.findMany({
      where: { OR: [{ userId }, { publication: { revokedAt: null } }] },
      include: { publication: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({
      data: {
        private: models
          .filter((m) => m.userId === userId)
          .map((m) => ({ ...modelView(m), access: 'PRIVATE' })),
        shared: models
          .filter((m) => m.userId !== userId && publicationActive(m, m.publication))
          .map((m) => sharedView(m, m.publication!)),
      },
    });
  });
  router.get('/dataset-schema', (_req, res) =>
    res.json({
      data: {
        schemaVersion: 'cw-features-1',
        maxBytes: 2_000_000,
        minRows: 60,
        maxRows: 5000,
        featureSchema: z.toJSONSchema(mlFeaturesSchema),
        additionalRequiredColumns: [
          'cpu_time_ms',
          'gpu_time_ms',
          'workload_family',
          'hardware_id',
          'benchmark_source',
          'measurement_methodology',
          'provenance',
          'dataset_version',
          'schema_version',
        ],
        targets:
          'Finite positive milliseconds for one end-to-end invocation, including host serial work, transfer and launch. No analytical or predicted labels.',
        provenance: ['MEASURED', 'SYNTHETIC_DEMO'],
        optionalFeatures: ['cpu_frequency_ghz', 'gpu_memory_gb'],
      },
    }),
  );
  router.post('/datasets', validate(datasetInputSchema), async (req, res) => {
    const { name, ...input } = datasetInputSchema.parse(req.body);
    const parsed = ingestionSchema.parse(await mlRequest('/internal/datasets', input));
    const saved = await db.dataset.create({
      data: {
        userId: req.session.userId!,
        name,
        version: parsed.version,
        schemaVersion: parsed.schemaVersion,
        provenance: parsed.provenance,
        rowCount: parsed.rowCount,
        rows: asJson(parsed.rows),
        validation: asJson(parsed.validation),
      },
    });
    res.status(201).json({ data: datasetView(saved, true) });
  });
  router.get('/datasets', async (req, res) =>
    res.json({
      data: (
        await db.dataset.findMany({
          where: { userId: req.session.userId! },
          orderBy: { createdAt: 'desc' },
        })
      ).map((d) => datasetView(d)),
    }),
  );
  router.get('/datasets/:id', async (req, res) => {
    const d = await db.dataset.findUnique({
      where: { id_userId: { id: String(req.params.id), userId: req.session.userId! } },
    });
    if (!d) throw new ApiError(404, 'NOT_FOUND', 'Dataset not found.');
    res.json({ data: datasetView(d, true) });
  });
  router.post('/training-jobs', validate(trainingInputSchema), async (req, res) => {
    const { datasetId, ...config } = trainingInputSchema.parse(req.body);
    const userId = req.session.userId!;
    if (!(await db.dataset.findUnique({ where: { id_userId: { id: datasetId, userId } } })))
      throw new ApiError(404, 'NOT_FOUND', 'Dataset not found.');
    try {
      const job = await db.trainingJob.create({
        data: { userId, datasetId, config },
        include: { models: { select: { id: true } } },
      });
      res.status(202).json({ data: jobView(job) });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')
        throw new ApiError(
          409,
          'TRAINING_CONFLICT',
          'A training job is already queued or running for this account.',
        );
      throw err;
    }
  });
  router.get('/training-jobs', async (req, res) =>
    res.json({
      data: (
        await db.trainingJob.findMany({
          where: { userId: req.session.userId! },
          orderBy: { createdAt: 'desc' },
          include: { models: { select: { id: true } } },
        })
      ).map(jobView),
    }),
  );
  router.get('/training-jobs/:id', async (req, res) => {
    const job = await db.trainingJob.findUnique({
      where: { id_userId: { id: String(req.params.id), userId: req.session.userId! } },
      include: { models: { select: { id: true } } },
    });
    if (!job) throw new ApiError(404, 'NOT_FOUND', 'Training job not found.');
    res.json({ data: jobView(job) });
  });
  router.get('/models', async (req, res) =>
    res.json({
      data: (
        await db.mLModel.findMany({
          where: { userId: req.session.userId! },
          orderBy: { createdAt: 'desc' },
        })
      ).map(modelView),
    }),
  );
  router.get('/models/:id', async (req, res) => {
    const model = await db.mLModel.findUnique({
      where: { id_userId: { id: String(req.params.id), userId: req.session.userId! } },
    });
    if (!model) throw new ApiError(404, 'NOT_FOUND', 'Model not found.');
    res.json({ data: modelView(model) });
  });
  router.post(
    '/models/:id/activate',
    validate(z.object({ active: z.boolean() }).strict()),
    async (req, res) => {
      const userId = req.session.userId!,
        id = String(req.params.id);
      const model = await db.mLModel.findUnique({ where: { id_userId: { id, userId } } });
      if (!model) throw new ApiError(404, 'NOT_FOUND', 'Model not found.');
      if (model.status !== 'READY')
        throw new ApiError(
          409,
          'MODEL_UNAVAILABLE',
          'Only successfully fitted model versions can be activated.',
        );
      const active = z.object({ active: z.boolean() }).parse(req.body).active;
      const updated = await db.$transaction(async (tx) => {
        // Account row lock serializes concurrent activation requests for this owner.
        await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
        if (active)
          await tx.mLModel.updateMany({
            where: { userId, target: model.target, active: true },
            data: { active: false },
          });
        return tx.mLModel.update({ where: { id_userId: { id, userId } }, data: { active } });
      });
      res.json({ data: modelView(updated) });
    },
  );
  router.post('/predict', validate(predictionInputSchema), async (req, res) => {
    const input = predictionInputSchema.parse(req.body),
      userId = req.session.userId!;
    const { workload, hardware, parsed, result, w, h } = await computePrediction(userId, input);
    const record = await db.mLPrediction.create({
      data: {
        userId,
        workloadId: workload.id,
        hardwareProfileId: hardware.id,
        workloadSnapshot: asJson({
          ...w,
          assumptions: input.assumptions,
          hardwareProfileId: hardware.id,
        }),
        hardwareSnapshot: asJson(h),
        features: parsed.data,
        result,
        provenance: 'PREDICTED',
      },
    });
    res.status(201).json({ data: predictionView(record) });
  });
  router.get('/predictions', async (req, res) =>
    res.json({
      data: (
        await db.mLPrediction.findMany({
          where: { userId: req.session.userId! },
          orderBy: { createdAt: 'desc' },
        })
      ).map(predictionView),
    }),
  );
  router.get('/predictions/:id', async (req, res) => {
    const record = await db.mLPrediction.findUnique({
      where: { id_userId: { id: String(req.params.id), userId: req.session.userId! } },
    });
    if (!record) throw new ApiError(404, 'NOT_FOUND', 'Prediction not found.');
    res.json({ data: predictionView(record) });
  });
  return router;
}
