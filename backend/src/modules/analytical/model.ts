import {
  analyticalResultSchema,
  capabilitySchema,
  workloadInputSchema,
  workloadPresets,
  type WorkloadInput,
  type Capabilities,
  type AnalyticalResult,
  type DeviceTiming,
  type HardwareProfile,
} from '@corewise/types';

export const MODEL_VERSION = 'cw-analytical-1.0.0' as const;
export const mibToBytes = (value: number) => value * 2 ** 20;
export const gigaToBase = (value: number) => value * 1e9;
export function amdahl(parallelFraction: number, processors: number) {
  if (
    !Number.isFinite(parallelFraction) ||
    parallelFraction < 0 ||
    parallelFraction > 1 ||
    !Number.isInteger(processors) ||
    processors < 1
  )
    throw new RangeError('Amdahl requires 0 ≤ P ≤ 1 and a positive integer processor count');
  return 1 / (1 - parallelFraction + parallelFraction / processors);
}
export function roofline(peakGflops: number, bandwidthGbps: number, intensity: number) {
  if (
    ![peakGflops, bandwidthGbps, intensity].every(Number.isFinite) ||
    peakGflops <= 0 ||
    bandwidthGbps <= 0 ||
    intensity < 0
  )
    throw new RangeError('Invalid roofline capabilities or intensity');
  return Math.min(peakGflops, bandwidthGbps * intensity);
}
export function transferSeconds(bytes: number, bandwidthGbps: number | null) {
  if (!Number.isFinite(bytes) || bytes < 0)
    throw new RangeError('Transfer bytes must be finite and nonnegative');
  if (bytes === 0) return 0;
  if (bandwidthGbps === null || !Number.isFinite(bandwidthGbps) || bandwidthGbps <= 0)
    throw new RangeError('Positive transfer bandwidth is required for nonzero transfers');
  return bytes / gigaToBase(bandwidthGbps);
}
export function recommendation(
  cpu: number,
  gpu: number,
  tolerance: number,
): { speedup: number | null; recommendation: AnalyticalResult['recommendation'] } {
  if (
    ![cpu, gpu, tolerance].every(Number.isFinite) ||
    cpu < 0 ||
    gpu < 0 ||
    tolerance < 0 ||
    tolerance > 0.5
  )
    throw new RangeError('Invalid comparison times or tolerance');
  if (cpu === 0 && gpu === 0) return { speedup: null, recommendation: 'SIMILAR' };
  if (gpu === 0) throw new RangeError('A nonzero workload cannot have a zero GPU-path duration');
  const speedup = cpu / gpu;
  return {
    speedup,
    recommendation:
      Math.abs(speedup - 1) <= tolerance + Number.EPSILON * 8
        ? 'SIMILAR'
        : speedup > 1
          ? 'GPU'
          : 'CPU',
  };
}
function timings(
  serialCompute: number,
  serialMemory: number,
  parallelCompute: number,
  parallelMemory: number,
  transfer: number,
  launch: number,
  work: WorkloadInput,
): DeviceTiming {
  const compute = serialCompute + parallelCompute;
  const memoryStall =
    Math.max(0, serialMemory - serialCompute) + Math.max(0, parallelMemory - parallelCompute);
  const perRepetitionSeconds = compute + memoryStall + transfer + launch;
  const r = work.repetitions;
  return {
    computeSeconds: compute * r,
    memoryFloorSeconds: (serialMemory + parallelMemory) * r,
    memoryStallSeconds: memoryStall * r,
    transferSeconds: transfer * r,
    launchSeconds: launch * r,
    serialSeconds: Math.max(serialCompute, serialMemory) * r,
    parallelSeconds: Math.max(parallelCompute, parallelMemory) * r,
    totalSeconds: perRepetitionSeconds * r,
    perRepetitionSeconds,
    effectiveThroughputGflops:
      perRepetitionSeconds === 0 ? null : work.operationCount / perRepetitionSeconds / 1e9,
  };
}

export function estimate(
  workload: WorkloadInput,
  hardware: HardwareProfile,
  supplied: Capabilities,
  tolerance: number,
): AnalyticalResult {
  const w = workloadInputSchema.parse(workload);
  const assumptions = capabilitySchema.parse(supplied);
  if (!Number.isFinite(tolerance) || tolerance < 0 || tolerance > 0.5)
    throw new RangeError('Tolerance must be between 0 and 0.5');
  const resolved = {
    ...assumptions,
    cpuCores: assumptions.cpuCores ?? hardware.physicalCores,
    gpuBandwidthGbps: assumptions.gpuBandwidthGbps ?? hardware.memoryBandwidthGbps,
  };
  const sources = Object.fromEntries(
    Object.entries(assumptions).map(([key, value]) => [
      key,
      value === null ? 'NOT_SUPPLIED' : 'USER_ASSUMPTION',
    ]),
  );
  if (assumptions.cpuCores === null && hardware.physicalCores !== null)
    sources.cpuCores =
      hardware.provenance === 'MEASURED' ? 'PROFILE_DETECTED' : 'PROFILE_USER_ENTERED';
  if (assumptions.gpuBandwidthGbps === null && hardware.memoryBandwidthGbps !== null)
    sources.gpuBandwidthGbps =
      hardware.provenance === 'MEASURED' ? 'PROFILE_DETECTED' : 'PROFILE_USER_ENTERED';
  const missingFields: string[] = [];
  const warnings: string[] = [];
  if (resolved.cpuPeakGflops === null) missingFields.push('assumptions.cpuPeakGflops');
  if (resolved.cpuBandwidthGbps === null) missingFields.push('assumptions.cpuBandwidthGbps');
  if (resolved.cpuCores === null) missingFields.push('assumptions.cpuCores');
  const cpuMissing = missingFields.length > 0;
  const memoryBytes = mibToBytes(w.memoryMiB);
  const cpuCapacityExceeded = memoryBytes > gigaToBase(hardware.ramGb);
  if (cpuCapacityExceeded) missingFields.push('memoryMiB exceeds installed RAM');
  if (!hardware.gpuName) missingFields.push('hardware.gpuName');
  if (resolved.gpuPeakGflops === null) missingFields.push('assumptions.gpuPeakGflops');
  if (resolved.gpuBandwidthGbps === null) missingFields.push('assumptions.gpuBandwidthGbps');
  if (w.transferMiB > 0 && resolved.transferBandwidthGbps === null)
    missingFields.push('assumptions.transferBandwidthGbps');
  if (resolved.kernelLaunchUs === null) missingFields.push('assumptions.kernelLaunchUs');
  const gpuCapacityExceeded = hardware.vramGb !== null && memoryBytes > gigaToBase(hardware.vramGb);
  if (gpuCapacityExceeded) missingFields.push('memoryMiB exceeds GPU VRAM');
  if (hardware.vramGb === null)
    warnings.push('GPU VRAM is unknown; GPU capacity could not be validated.');
  if (w.memoryMiB === 0)
    warnings.push('Zero memory footprint does not establish actual allocation requirements.');
  if (w.category === 'SORTING')
    warnings.push(
      'Sorting uses FLOP-equivalent surrogate operations; floating-point throughput poorly models comparison and branch costs.',
    );
  const traffic = w.operationCount === 0 ? 0 : w.operationCount / w.arithmeticIntensity;
  const transferred =
    mibToBytes(w.transferMiB) * (assumptions.transferConvention === 'ONE_WAY_ROUND_TRIP' ? 2 : 1);
  let cpu: DeviceTiming | null = null;
  let gpu: DeviceTiming | null = null;
  if (!cpuMissing && !cpuCapacityExceeded) {
    const peak = gigaToBase(resolved.cpuPeakGflops!);
    const bandwidth = gigaToBase(resolved.cpuBandwidthGbps!);
    const n = resolved.cpuCores!;
    const serialCompute = (w.operationCount * (1 - w.parallelFraction)) / (peak / n);
    const serialMemory = (traffic * (1 - w.parallelFraction)) / bandwidth;
    cpu = timings(
      serialCompute,
      serialMemory,
      (w.operationCount * w.parallelFraction) / peak,
      (traffic * w.parallelFraction) / bandwidth,
      0,
      0,
      w,
    );
    if (missingFields.length === 0)
      gpu = timings(
        serialCompute,
        serialMemory,
        (w.operationCount * w.parallelFraction) / gigaToBase(resolved.gpuPeakGflops!),
        (traffic * w.parallelFraction) / gigaToBase(resolved.gpuBandwidthGbps!),
        transferSeconds(transferred, resolved.transferBandwidthGbps),
        resolved.kernelLaunchUs! / 1e6,
        w,
      );
  }
  const compared =
    cpu && gpu
      ? recommendation(cpu.totalSeconds, gpu.totalSeconds, tolerance)
      : { speedup: null, recommendation: 'INSUFFICIENT_DATA' as const };
  const reasons =
    compared.recommendation === 'INSUFFICIENT_DATA'
      ? ['Supply the missing capabilities or resolve capacity limits before choosing a device.']
      : compared.recommendation === 'SIMILAR'
        ? [
            cpu?.totalSeconds === 0 && gpu?.totalSeconds === 0
              ? 'Both analytical durations are zero; the speedup ratio is undefined.'
              : `The CPU/GPU time ratio is within ±${tolerance * 100}% of 1.0.`,
          ]
        : [
            `${compared.recommendation} has the lower estimated total duration under the supplied assumptions.`,
            'The GPU path includes serial CPU work, data movement, and one kernel launch per repetition.',
          ];
  return analyticalResultSchema.parse({
    modelVersion: MODEL_VERSION,
    provenance: 'ANALYTICAL',
    cpu,
    gpu,
    ...compared,
    reasons,
    missingFields,
    theoreticalCpuSpeedup: resolved.cpuCores ? amdahl(w.parallelFraction, resolved.cpuCores) : null,
    assumptions: {
      supplied: assumptions,
      resolved,
      sources,
      tolerance,
      repetitions: w.repetitions,
      memoryTrafficBytes: traffic,
      transferBytesPerRepetition: transferred,
      transferPolicy:
        'Every repetition transfers the declared total (or twice the declared one-way size) and pays one kernel launch, even for zero offloadable operations. No reuse or overlap.',
      methodology:
        'CPU aggregate peak is divided by physical/effective core count for the serial stage. Each stage overlaps compute and memory via max(). The GPU path retains the CPU serial stage and offloads only P to the GPU aggregate peak; CPU core scaling is never applied to GPU throughput.',
      presetNotes: workloadPresets.find((preset) => preset.id === w.presetId)?.notes ?? [],
    },
    limitations: [
      'Analytical approximation, not a measured benchmark or trained-model prediction.',
      'Peak throughput must match the declared precision and operation semantics; clock frequency alone is not a FLOPS estimate.',
      'Assumes uniform operations and traffic across serial and parallel fractions, linear per-core peak scaling, and full device bandwidth for each stage.',
      'Ignores caches, occupancy, SIMD efficiency, synchronization, scheduling, contention, allocation, power limits, and thermal throttling.',
      'Memory footprint is a capacity check, not a second memory-traffic term. The entire footprint is conservatively required to fit GPU VRAM when known.',
      'Repetitions repeat all work, transfers, and launches; these are total elapsed-time estimates without warmup or statistical measurement.',
    ],
    warnings,
  });
}
