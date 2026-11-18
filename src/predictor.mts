import type { PostgresBinding } from '@prisma/composer-prisma-cloud/orm';
import type { Db } from './service.mjs';

export type { Db };

export type Device = 'cpu' | 'gpu';
export type WorkloadKind = 'matmul' | 'conv2d' | 'attention' | 'reduction' | 'sort';

export const DEVICES: readonly Device[] = ['cpu', 'gpu'];
export const KINDS: readonly WorkloadKind[] = ['matmul', 'conv2d', 'attention', 'reduction', 'sort'];

/** Peak throughput per device, in GFLOPS — the yardstick for efficiency. */
const PEAK_GFLOPS: Record<Device, number> = { cpu: 900, gpu: 24000 };

/** Arithmetic intensity of one work item of each kind, so flops follow the size. */
const FLOPS_PER_SIZE: Record<WorkloadKind, (size: number) => number> = {
  matmul: (n) => 2 * n ** 3,
  conv2d: (n) => 2 * n ** 2 * 64 * 9,
  attention: (n) => 4 * n ** 2 * 256,
  reduction: (n) => 2 * n,
  sort: (n) => n * Math.log2(Math.max(n, 2)) * 4,
};

/** Base duration in ms for one reference work item on one thread. */
const BASE_MS: Record<WorkloadKind, Record<Device, number>> = {
  matmul: { cpu: 4200, gpu: 90 },
  conv2d: { cpu: 3800, gpu: 130 },
  attention: { cpu: 5100, gpu: 160 },
  reduction: { cpu: 0.9, gpu: 0.4 },
  sort: { cpu: 22, gpu: 30 },
};

/** How strongly each kind scales with size and parallelises over threads. */
const SCALING: Record<WorkloadKind, { size: number; threads: Record<Device, number> }> = {
  matmul: { size: 2.7, threads: { cpu: 0.75, gpu: 0.95 } },
  conv2d: { size: 2.0, threads: { cpu: 0.7, gpu: 0.9 } },
  attention: { size: 2.1, threads: { cpu: 0.65, gpu: 0.92 } },
  reduction: { size: 1.0, threads: { cpu: 0.85, gpu: 0.98 } },
  sort: { size: 1.15, threads: { cpu: 0.45, gpu: 0.5 } },
};

/** Per-device reference size the base durations are measured at. */
const REF_SIZE: Record<WorkloadKind, number> = {
  matmul: 1024,
  conv2d: 448,
  attention: 256,
  reduction: 10_000_000,
  sort: 10_000_000,
};

interface BenchRow {
  kind: string;
  device: string;
  matrixSize: number;
  threads: number;
  durationMs: number;
}

interface LinearModel {
  weights: [number, number, number];
  r2: number;
  rows: number;
}

/**
 * A deterministic PRNG (mulberry32) so the seeded training set — and with it
 * every trained model — is identical on every fresh database.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function logDuration(kind: WorkloadKind, device: Device, size: number, threads: number, noise: number): number {
  const s = SCALING[kind]!;
  const ref = REF_SIZE[kind]!;
  const sizeFactor = Math.max(size, 1) / ref;
  const threadFactor = Math.max(threads, 1) ** -s.threads[device];
  const ms = BASE_MS[kind]![device] * sizeFactor ** s.size * threadFactor * (1 + noise * 0.25);
  return Math.max(ms, 0.02);
}

/**
 * Seeds a fresh database with a synthetic benchmark suite: measured-style
 * runs of every workload kind on both devices over a grid of sizes and
 * thread counts. No-op when benchmarks already exist.
 */
export async function ensureSeed(db: Db): Promise<number> {
  const existing = await db.client.orm.public.Benchmark.all();
  if (existing.length > 0) return existing.length;

  const rand = mulberry32(0x5eed);
  const sizes: Record<WorkloadKind, number[]> = {
    matmul: [512, 1024, 2048, 4096],
    conv2d: [224, 448, 896],
    attention: [128, 256, 512, 1024],
    reduction: [1_000_000, 10_000_000, 100_000_000],
    sort: [1_000_000, 10_000_000, 100_000_000],
  };
  const threadCounts = [1, 4, 16, 64];

  const toCreate: Array<{
    workload: string;
    kind: WorkloadKind;
    device: Device;
    matrixSize: number;
    threads: number;
    durationMs: number;
    gflops: number;
    efficiency: number;
  }> = [];
  for (const kind of KINDS) {
    for (const device of DEVICES) {
      for (const size of sizes[kind]!) {
        for (const threads of threadCounts) {
          const noise = (rand() - 0.5) * 2;
          const durationMs = logDuration(kind, device, size, threads, noise);
          const gflops = FLOPS_PER_SIZE[kind]!(size) / durationMs / 1e9;
          const efficiency = Math.min(0.98, gflops / PEAK_GFLOPS[device]);
          toCreate.push({ workload: `${kind}@${size}`, kind, device, matrixSize: size, threads, durationMs, gflops, efficiency });
        }
      }
    }
  }
  for (const row of toCreate) await db.client.orm.public.Benchmark.create(row);
  return toCreate.length;
}

/** Solves a square linear system by Gaussian elimination with partial pivoting. */
function solve(a: number[][], b: number[]): number[] {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]!]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(m[row]![col]!) > Math.abs(m[pivot]![col]!)) pivot = row;
    }
    [m[col], m[pivot]] = [m[pivot]!, m[col]!];
    const p = m[col]![col]!;
    if (Math.abs(p) < 1e-10) return [0, 0, 0];
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const f = m[row]![col]! / p;
      for (let k = col; k <= n; k++) m[row]![k] = m[row]![k]! - f * m[col]![k]!;
    }
  }
  return m.map((row, i) => row[n]! / row[i]!);
}

/**
 * Fits an ordinary-least-squares model of log-duration over the features
 * [1, ln(size), ln(threads)] for one (kind, device) pair.
 */
function fit(rows: BenchRow[]): LinearModel {
  const xtX = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const xtY = [0, 0, 0];
  const ys = rows.map((r) => Math.log(r.durationMs));
  const meanY = ys.reduce((s, y) => s + y, 0) / ys.length;
  let ssTot = 0;
  let ssRes = 0;
  for (const r of rows) {
    const x = [1, Math.log(r.matrixSize), Math.log(Math.max(r.threads, 1))];
    const y = Math.log(r.durationMs);
    for (let i = 0; i < 3; i++) {
      xtY[i]! += x[i]! * y;
      for (let j = 0; j < 3; j++) xtX[i]![j]! += x[i]! * x[j]!;
    }
    ssTot += (y - meanY) ** 2;
  }
  const w = solve(xtX, xtY) as [number, number, number];
  for (const r of rows) {
    const x = [1, Math.log(r.matrixSize), Math.log(Math.max(r.threads, 1))];
    const y = Math.log(r.durationMs);
    const pred = w[0]! * x[0]! + w[1]! * x[1]! + w[2]! * x[2]!;
    ssRes += (y - pred) ** 2;
  }
  const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;
  return { weights: w, r2, rows: rows.length };
}

function predictWith(model: LinearModel, size: number, threads: number): number {
  const x = [1, Math.log(size), Math.log(Math.max(threads, 1))];
  return Math.exp(model.weights[0]! * x[0]! + model.weights[1]! * x[1]! + model.weights[2]! * x[2]!);
}

export interface AgentInput {
  workload: string;
  kind: WorkloadKind;
  matrixSize: number;
  threads: number;
}

export interface AgentReport {
  workload: string;
  kind: WorkloadKind;
  matrixSize: number;
  threads: number;
  recommendedDevice: Device;
  predictedDurationMs: number;
  efficiency: number;
  confidence: number;
  reasoning: string[];
  predictionId: number;
}

/**
 * The recommendation agent: loads the recorded benchmarks, trains one
 * duration model per (workload kind, device), predicts the workload's run on
 * each processing unit, weighs the predicted duration and efficiency against
 * how well the models fit, and records its recommendation and reasoning.
 */
export async function runAgent(db: Db, input: AgentInput): Promise<AgentReport> {
  const reasoning: string[] = [];
  const all = await db.client.orm.public.Benchmark.select('kind', 'device', 'matrixSize', 'threads', 'durationMs').all();
  const rows: BenchRow[] = all.map((r) => ({
    kind: String(r.kind),
    device: String(r.device),
    matrixSize: Number(r.matrixSize),
    threads: Number(r.threads),
    durationMs: Number(r.durationMs),
  }));
  reasoning.push(`Loaded ${rows.length} recorded benchmark runs over ${KINDS.length} workload kinds.`);

  const models = new Map<string, LinearModel>();
  for (const kind of KINDS) {
    for (const device of DEVICES) {
      const subset = rows.filter((r) => r.kind === kind && r.device === device);
      if (subset.length >= 3) models.set(`${kind}:${device}`, fit(subset));
    }
  }
  reasoning.push(
    `Trained ${models.size} duration models (least squares over log size and log threads) from the runs.` ,
  );

  const estimates = DEVICES.map((device) => {
    const model = models.get(`${input.kind}:${device}`);
    const durationMs = predictWith(model ?? { weights: [0, 0, 0], r2: 0, rows: 0 }, input.matrixSize, input.threads);
    const gflops = FLOPS_PER_SIZE[input.kind]!(input.matrixSize) / durationMs / 1e9;
    const efficiency = Math.min(0.98, gflops / PEAK_GFLOPS[device]);
    const fit = model ? ` (fit on ${model.rows} runs, R² ${model.r2.toFixed(3)})` : ' (no runs — weak estimate)';
    return { device, durationMs, efficiency, fit };
  });
  reasoning.push(
    ...estimates.map(
      (e) =>
        `Predicted ${input.workload} [${input.kind}, size=${input.matrixSize}, threads=${input.threads}] on ${e.device}: ${e.durationMs.toFixed(1)} ms, ${(e.efficiency * 100).toFixed(1)}% of peak${e.fit}.`,
    ),
  );

  const sorted = [...estimates].sort((a, b) => a.durationMs - b.durationMs);
  const best = sorted[0]!;
  const runnerUp = sorted[1]!;
  const margin = Math.max(runnerUp.durationMs / best.durationMs, 1);
  const speedup = runnerUp.durationMs / best.durationMs;
  const confidence = Math.min(0.99, 1 / (1 + Math.exp(-2 * Math.log(margin))) * 0.8 + best.efficiency * 0.2);
  reasoning.push(
    `${best.device.toUpperCase()} is ${speedup.toFixed(2)}× faster here and uses ${((best.efficiency - runnerUp.efficiency) * 100).toFixed(1)} pp more of its peak — recommending ${best.device} with ${(confidence * 100).toFixed(0)}% confidence.`,
  );

  const created = await db.client.orm.public.Prediction.create({
    workload: input.workload,
    kind: input.kind,
    matrixSize: input.matrixSize,
    threads: input.threads,
    recommendedDevice: best.device,
    predictedDurationMs: best.durationMs,
    confidence,
    reasoning: reasoning.join('\n'),
  });
  reasoning.push(`Recorded prediction #${created.id}.`);

  return {
    workload: input.workload,
    kind: input.kind,
    matrixSize: input.matrixSize,
    threads: input.threads,
    recommendedDevice: best.device,
    predictedDurationMs: best.durationMs,
    efficiency: best.efficiency,
    confidence,
    reasoning,
    predictionId: created.id,
  };
}

/** Average efficiency per (kind, device), the numbers the dashboard charts. */
export async function efficiencyByKindAndDevice(db: Db): Promise<Map<string, number>> {
  const rows = await db.client.orm.public.Benchmark.select('kind', 'device', 'efficiency').all();
  const sums = new Map<string, { total: number; n: number }>();
  for (const r of rows) {
    const key = `${String(r.kind)}:${String(r.device)}`;
    const acc = sums.get(key) ?? { total: 0, n: 0 };
    acc.total += Number(r.efficiency);
    acc.n += 1;
    sums.set(key, acc);
  }
  const averages = new Map<string, number>();
  for (const [key, { total, n }] of sums) averages.set(key, total / n);
  return averages;
}
