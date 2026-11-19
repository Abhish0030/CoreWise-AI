import { describe, expect, it } from 'vitest';
import {
  blankWorkload,
  emptyCapabilities,
  workloadInputSchema,
  workloadPresets,
  type HardwareProfile,
} from '@corewise/types';
import {
  amdahl,
  roofline,
  mibToBytes,
  gigaToBase,
  transferSeconds,
  recommendation,
  estimate,
} from '../src/modules/analytical/model.js';

const hardware: HardwareProfile = {
  id: 'test',
  name: 'Test hardware',
  manufacturer: '',
  deviceModel: '',
  description: '',
  os: 'Test OS',
  cpuName: 'Test CPU',
  cpuManufacturer: 'Test',
  physicalCores: 8,
  logicalProcessors: 16,
  cpuBaseGhz: 3,
  cpuMaxGhz: 4,
  gpuManufacturer: 'Test',
  gpuName: 'Test GPU',
  vramGb: 16,
  memoryBandwidthGbps: 500,
  computeCapability: null,
  ramGb: 32,
  memoryType: '',
  memoryFrequencyMhz: null,
  provenance: 'USER_ENTERED',
  createdAt: '2026-11-12T00:00:00.000Z',
  updatedAt: '2026-11-12T00:00:00.000Z',
};
const work = {
  ...blankWorkload,
  name: 'Test workload',
  operationCount: 1e9,
  arithmeticIntensity: 100,
  parallelFraction: 1,
  memoryMiB: 1,
  transferMiB: 0,
};
const capabilities = {
  ...emptyCapabilities,
  cpuPeakGflops: 100,
  cpuBandwidthGbps: 100,
  gpuPeakGflops: 1000,
  transferBandwidthGbps: 10,
  kernelLaunchUs: 0,
};
describe('analytical mathematics', () => {
  it('uses Amdahl boundaries and known speedup', () => {
    expect(amdahl(0, 8)).toBe(1);
    expect(amdahl(1, 8)).toBe(8);
    expect(amdahl(0.5, 4)).toBeCloseTo(1.6);
    expect(amdahl(0.7, 1)).toBe(1);
    expect(() => amdahl(1, 0)).toThrow();
    expect(() => amdahl(-0.1, 2)).toThrow();
  });
  it('takes the lower compute or memory roof', () => {
    expect(roofline(1000, 100, 2)).toBe(200);
    expect(roofline(1000, 100, 20)).toBe(1000);
    expect(roofline(100, 10, 0)).toBe(0);
    expect(() => roofline(0, 10, 1)).toThrow();
  });
  it('converts binary memory units and decimal throughput units', () => {
    expect(mibToBytes(1)).toBe(1048576);
    expect(gigaToBase(1)).toBe(1e9);
    expect(transferSeconds(1e9, 10)).toBeCloseTo(0.1);
    expect(transferSeconds(0, null)).toBe(0);
    expect(() => transferSeconds(1, null)).toThrow();
  });
  it('handles CPU, GPU, tolerance, and zero-time comparisons', () => {
    expect(recommendation(1, 2, 0.05).recommendation).toBe('CPU');
    expect(recommendation(2, 1, 0.05).recommendation).toBe('GPU');
    expect(recommendation(1.05, 1, 0.05).recommendation).toBe('SIMILAR');
    expect(recommendation(0.95, 1, 0.05).recommendation).toBe('SIMILAR');
    expect(recommendation(0, 0, 0.05)).toEqual({ speedup: null, recommendation: 'SIMILAR' });
    expect(() => recommendation(1, 0, 0.05)).toThrow();
  });
});
describe('coherent CPU/GPU estimation', () => {
  it('uses aggregate CPU peak only once, with explicit per-core serial scaling', () => {
    const result = estimate({ ...work, parallelFraction: 0.5 }, hardware, capabilities, 0.05);
    expect(result.cpu!.computeSeconds).toBeCloseTo(0.045);
    expect(result.cpu!.totalSeconds).toBeCloseTo(0.045);
    expect(result.theoreticalCpuSpeedup).toBeCloseTo(1 / (0.5 + 0.5 / 8));
  });
  it('estimates faster GPU without CPU core scaling on GPU peak', () => {
    const result = estimate(work, hardware, capabilities, 0.05);
    expect(result.cpu!.totalSeconds).toBeCloseTo(0.01);
    expect(result.gpu!.totalSeconds).toBeCloseTo(0.001);
    expect(result.speedup).toBeCloseTo(10);
    expect(result.recommendation).toBe('GPU');
    expect(result.provenance).toBe('ANALYTICAL');
  });
  it('recommends CPU when transfers and launch dominate', () => {
    const result = estimate(
      { ...work, transferMiB: 1024 },
      hardware,
      { ...capabilities, kernelLaunchUs: 10 },
      0.05,
    );
    expect(result.recommendation).toBe('CPU');
    expect(result.gpu!.transferSeconds).toBeCloseTo(1073741824 / 1e10);
  });
  it('uses max(compute,memory), not their sum, and produces additive breakdowns', () => {
    const result = estimate({ ...work, arithmeticIntensity: 0.01 }, hardware, capabilities, 0.05);
    expect(result.cpu!.totalSeconds).toBeCloseTo(1);
    expect(result.cpu!.memoryStallSeconds).toBeCloseTo(0.99);
    for (const device of [result.cpu!, result.gpu!])
      expect(device.totalSeconds).toBeCloseTo(
        device.computeSeconds +
          device.memoryStallSeconds +
          device.transferSeconds +
          device.launchSeconds,
      );
  });
  it('doubles one-way transfer size and repeats transfers, kernels, and compute', () => {
    const result = estimate(
      { ...work, transferMiB: 1, repetitions: 3 },
      hardware,
      { ...capabilities, transferConvention: 'ONE_WAY_ROUND_TRIP', kernelLaunchUs: 20 },
      0.05,
    );
    expect(result.assumptions.transferBytesPerRepetition).toBe(2097152);
    expect(result.gpu!.transferSeconds).toBeCloseTo((2097152 / 1e10) * 3);
    expect(result.gpu!.launchSeconds).toBeCloseTo(0.00006);
    expect(result.cpu!.totalSeconds).toBeCloseTo(0.03);
  });
  it('reports missing capabilities honestly while retaining a valid CPU-only estimate', () => {
    const result = estimate(work, { ...hardware, gpuName: null }, capabilities, 0.05);
    expect(result.cpu).not.toBeNull();
    expect(result.gpu).toBeNull();
    expect(result.recommendation).toBe('INSUFFICIENT_DATA');
    expect(result.missingFields).toContain('hardware.gpuName');
    const missing = estimate(work, hardware, emptyCapabilities, 0.05);
    expect(missing.cpu).toBeNull();
    expect(missing.missingFields).toContain('assumptions.cpuPeakGflops');
  });
  it('uses only declared profile capabilities and flags capacity limits', () => {
    const result = estimate(work, hardware, capabilities, 0.05);
    expect(result.assumptions.resolved.cpuCores).toBe(8);
    expect(result.assumptions.sources.cpuCores).toBe('PROFILE_USER_ENTERED');
    expect(result.assumptions.resolved.gpuBandwidthGbps).toBe(500);
    expect(estimate({ ...work, memoryMiB: 20000 }, hardware, capabilities, 0.05).gpu).toBeNull();
    expect(estimate({ ...work, memoryMiB: 100000 }, hardware, capabilities, 0.05).cpu).toBeNull();
  });
  it('handles zero operations and serial boundaries with finite outputs', () => {
    const zero = estimate(
      { ...work, operationCount: 0, arithmeticIntensity: 0 },
      hardware,
      capabilities,
      0.05,
    );
    expect(zero.cpu!.totalSeconds).toBe(0);
    expect(zero.gpu!.totalSeconds).toBe(0);
    expect(zero.speedup).toBeNull();
    const serial = estimate(
      { ...work, parallelFraction: 0 },
      hardware,
      { ...capabilities, kernelLaunchUs: 10 },
      0.05,
    );
    expect(serial.cpu!.totalSeconds).toBeCloseTo(0.08);
    expect(serial.gpu!.totalSeconds).toBeCloseTo(0.08001);
  });
  it('is deterministic and accepts documented presets without supplying hardware peaks', () => {
    expect(estimate(work, hardware, capabilities, 0.05)).toEqual(
      estimate(work, hardware, capabilities, 0.05),
    );
    for (const preset of workloadPresets) {
      expect(workloadInputSchema.safeParse(preset.values).success).toBe(true);
      expect(preset.values.assumptions.cpuPeakGflops).toBeNull();
    }
  });
  it('rejects invalid, tiny, negative, nonfinite, and contradictory workload parameters', () => {
    for (const patch of [
      { operationCount: -1 },
      { arithmeticIntensity: 0 },
      { arithmeticIntensity: 1e-300 },
      { parallelFraction: 1.1 },
      { memoryMiB: -1 },
      { repetitions: 0 },
      { inputSize: Infinity },
    ])
      expect(workloadInputSchema.safeParse({ ...work, ...patch }).success).toBe(false);
    expect(() => estimate(work, hardware, { ...capabilities, cpuPeakGflops: 0 }, 0.05)).toThrow();
  });
});
