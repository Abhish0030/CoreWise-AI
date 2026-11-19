import { estimate, MODEL_VERSION } from '../analytical/model.js';
import { recommendation } from '../analytical/model.js';
import {
  type WorkloadInput,
  type HardwareProfile,
  type BenchmarkMeasurement,
  type Capabilities,
} from '@corewise/types';
export function compatibleMeasurement(
  w: WorkloadInput,
  h: HardwareProfile,
  m: BenchmarkMeasurement,
  threads = 1,
) {
  const c = m.config,
    e = m.environment;
  const expectedUnit =
    c.workload === 'MATRIX_MULTIPLICATION'
      ? 'MATRIX_DIMENSION'
      : c.workload === 'IMAGE_PROCESSING'
        ? 'PIXELS'
        : 'ELEMENTS';
  const precision =
    c.workload === 'SORTING' ? 'FLOP_EQUIVALENT' : c.dtype === 'float32' ? 'FP32' : 'FP64';
  const n = c.size,
    bytes = c.dtype === 'float32' ? 4 : 8,
    elements = c.workload === 'MATRIX_MULTIPLICATION' ? n * n : n;
  const footprint =
    c.workload === 'REDUCTION'
      ? (n + 1) * bytes
      : elements * bytes * (c.workload === 'SORTING' ? 2 : 3);
  const ops =
    c.workload === 'MATRIX_MULTIPLICATION'
      ? 2 * n ** 3
      : c.workload === 'VECTOR_ADDITION'
        ? n
        : c.workload === 'REDUCTION'
          ? n - 1
          : c.workload === 'IMAGE_PROCESSING'
            ? 2 * n
            : Math.round(n * Math.log2(n));
  const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(1e-6, Math.abs(b) * 1e-6);
  return (
    m.valid &&
    m.cpu.correctness.valid &&
    !!m.gpu?.correctness.valid &&
    c.scope === 'END_TO_END' &&
    c.workload === w.category &&
    c.size === w.inputSize &&
    w.inputUnit === expectedUnit &&
    precision === w.assumptions.precision &&
    (threads === 0 || c.threads === threads) &&
    e.cpuModel === h.cpuName &&
    (e.gpuRuntime?.model ?? e.gpus[0]?.model ?? null) === h.gpuName &&
    e.physicalCores === h.physicalCores &&
    close(w.operationCount, ops) &&
    close(w.memoryMiB, footprint / 2 ** 20) &&
    close(
      w.transferMiB * (w.assumptions.transferConvention === 'ONE_WAY_ROUND_TRIP' ? 2 : 1),
      footprint / 2 ** 20,
    ) &&
    w.parallelFraction === 1
  );
}
export function scaledWorkload(w: WorkloadInput, size: number): WorkloadInput | null {
  if (
    ![
      'VECTOR_ADDITION',
      'MATRIX_MULTIPLICATION',
      'SORTING',
      'IMAGE_PROCESSING',
      'REDUCTION',
      'CUSTOM',
    ].includes(w.category) ||
    w.inputSize <= 0 ||
    (w.category === 'REDUCTION' && w.inputSize <= 1)
  )
    return null;
  // CUSTOM may represent arbitrary algorithms: do not manufacture scaling for it.
  if (w.category === 'CUSTOM' || !['ELEMENTS', 'PIXELS', 'MATRIX_DIMENSION'].includes(w.inputUnit))
    return null;
  const ratio = size / w.inputSize,
    traffic =
      w.category === 'MATRIX_MULTIPLICATION'
        ? ratio ** 2
        : w.category === 'REDUCTION'
          ? (size + 1) / (w.inputSize + 1)
          : ratio;
  const operations =
    w.category === 'MATRIX_MULTIPLICATION'
      ? ratio ** 3
      : w.category === 'SORTING'
        ? (size * Math.log2(Math.max(2, size))) /
          (w.inputSize * Math.log2(Math.max(2, w.inputSize)))
        : w.category === 'REDUCTION'
          ? (size - 1) / (w.inputSize - 1)
          : ratio;
  if (
    w.memoryMiB * traffic > 1e9 ||
    w.transferMiB * traffic > 1e9 ||
    w.operationCount * operations > Number.MAX_SAFE_INTEGER
  )
    return null;
  return {
    ...w,
    inputSize: size,
    operationCount: Math.round(w.operationCount * operations),
    memoryMiB: w.memoryMiB * traffic,
    transferMiB: w.transferMiB * traffic,
    arithmeticIntensity: (w.arithmeticIntensity * operations) / traffic,
  };
}
export function optimizationGrid(
  w: WorkloadInput,
  h: HardwareProfile,
  a: Capabilities,
  sizes: number[],
) {
  const points = sizes.map((size) => {
    const scaled = scaledWorkload(w, size);
    if (!scaled) return { size, cpuMs: null, gpuMs: null, recommendation: 'UNSUPPORTED' };
    const v = estimate(scaled, h, a, w.tolerance);
    return {
      size,
      cpuMs: v.cpu ? v.cpu.totalSeconds * 1000 : null,
      gpuMs: v.gpu ? v.gpu.totalSeconds * 1000 : null,
      recommendation: v.recommendation,
    };
  });
  const brackets = [];
  for (let i = 1; i < points.length; i++) {
    const lo = points[i - 1]!,
      hi = points[i]!;
    if (
      lo.cpuMs !== null &&
      lo.gpuMs !== null &&
      hi.cpuMs !== null &&
      hi.gpuMs !== null &&
      (lo.cpuMs - lo.gpuMs) * (hi.cpuMs - hi.gpuMs) < 0
    )
      brackets.push({
        lowerSize: lo.size,
        upperSize: hi.size,
        provenance: 'ANALYTICAL',
        modelVersion: MODEL_VERSION,
      });
  }
  return {
    points,
    brackets,
    methodology:
      'Sampled analytical crossover brackets, not exact measured thresholds. Operations/traffic scale linearly for vector/image, cubic/quadratic for square matrix multiplication and n log2(n)/linear for sorting. Custom workloads are unsupported.',
  };
}
export function choose(cpu: number | null, gpu: number | null, tolerance: number) {
  if (cpu === null || gpu === null || cpu <= 1e-9 || gpu <= 1e-9)
    return { recommendation: 'INSUFFICIENT_DATA', speedup: null };
  const value = recommendation(cpu / 1000, gpu / 1000, tolerance);
  return value;
}
