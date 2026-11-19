'use client';
import { useFormContext } from 'react-hook-form';
import type { WorkloadInput, HardwareProfile } from '@corewise/types';
import { Cpu, Layers3, Cable } from 'lucide-react';

export function CapabilityFields({
  hardware,
  mode = 'analytical',
}: {
  hardware?: HardwareProfile;
  mode?: 'analytical' | 'ml';
}) {
  const {
    register,
    formState: { errors },
  } = useFormContext<Pick<WorkloadInput, 'assumptions' | 'tolerance'>>();
  const groups = [
    {
      title: 'CPU capabilities',
      icon: Cpu,
      fields: [
        [
          'cpuPeakGflops',
          mode === 'ml' ? 'Effective CPU throughput (GFLOP/s)' : 'Aggregate CPU peak (GFLOP/s)',
          'Whole CPU, at the selected precision. Never calculated from GHz.',
        ],
        [
          'cpuBandwidthGbps',
          'CPU memory bandwidth (GB/s)',
          'Whole-device sustained/assumed memory bandwidth.',
        ],
        [
          'cpuCores',
          'Effective physical cores',
          hardware?.physicalCores
            ? `Blank uses ${hardware.physicalCores} profile cores (${hardware.provenance}).`
            : mode === 'ml'
              ? 'Supply physical cores associated with the effective CPU throughput.'
              : 'Supply the number of cores sharing the aggregate CPU peak.',
        ],
      ],
    },
    {
      title: 'GPU capabilities',
      icon: Layers3,
      fields: [
        [
          'gpuPeakGflops',
          mode === 'ml' ? 'Effective GPU throughput (GFLOP/s)' : 'Aggregate GPU peak (GFLOP/s)',
          mode === 'ml'
            ? 'Whole GPU effective throughput at the declared precision.'
            : 'Whole GPU at the same precision as the CPU assumption.',
        ],
        [
          'gpuBandwidthGbps',
          'GPU memory bandwidth (GB/s)',
          hardware?.memoryBandwidthGbps
            ? `Blank uses ${hardware.memoryBandwidthGbps} GB/s from the profile (${hardware.provenance}).`
            : mode === 'ml'
              ? 'Required GPU bandwidth feature for the trained pipeline.'
              : 'Required for the GPU roofline estimate.',
        ],
      ],
    },
    {
      title: 'Transfer & launch',
      icon: Cable,
      fields: [
        [
          'transferBandwidthGbps',
          'Host–device bandwidth (GB/s)',
          mode === 'ml'
            ? 'Required ML feature, including zero-transfer inputs. Decimal GB/s.'
            : 'Required for nonzero transfers. Decimal GB/s; no transfer/compute overlap.',
        ],
        [
          'kernelLaunchUs',
          'Kernel-launch overhead (µs)',
          'Explicitly enter zero if deliberately ignoring launch overhead. One launch per repetition.',
        ],
      ],
    },
  ];
  return (
    <div className="capability-fields">
      <div className="notice">
        <span>
          Supply explicit capability assumptions. Blank values stay unknown. Use throughput for the
          same precision and operation type on both devices.
        </span>
      </div>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="assumption-precision">Operation precision</label>
          <select id="assumption-precision" {...register('assumptions.precision')}>
            <option value="FP32">FP32</option>
            <option value="FP64">FP64</option>
            <option value="FLOP_EQUIVALENT">FLOP-equivalent surrogate</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="assumption-transfer">Transfer-size convention</label>
          <select id="assumption-transfer" {...register('assumptions.transferConvention')}>
            <option value="TOTAL_BYTES">Declared size is total bytes transferred</option>
            <option value="ONE_WAY_ROUND_TRIP">Declared size is one way; count a round trip</option>
          </select>
          <small>A round trip counts twice the workload’s transfer size.</small>
        </div>
      </div>
      {groups.map((group) => (
        <fieldset key={group.title}>
          <legend>
            <group.icon size={17} />
            {group.title}
          </legend>
          <div className="form-grid">
            {group.fields.map(([key, label, help]) => {
              const field = key as
                | 'cpuPeakGflops'
                | 'cpuBandwidthGbps'
                | 'cpuCores'
                | 'gpuPeakGflops'
                | 'gpuBandwidthGbps'
                | 'transferBandwidthGbps'
                | 'kernelLaunchUs';
              const error = errors.assumptions?.[field];
              return (
                <div className="field" key={field}>
                  <label htmlFor={`assumption-${field}`}>{label}</label>
                  <input
                    id={`assumption-${field}`}
                    type="number"
                    min={field === 'kernelLaunchUs' ? 0 : undefined}
                    step={field === 'cpuCores' ? 1 : 'any'}
                    placeholder="Not supplied"
                    {...register(`assumptions.${field}`, {
                      setValueAs: (value) =>
                        value === '' || value === null || value === undefined
                          ? null
                          : Number(value),
                    })}
                    aria-invalid={!!error}
                    aria-describedby={`assumption-help-${field}`}
                  />
                  <small id={`assumption-help-${field}`}>
                    {error ? <span className="field-error">{error.message}</span> : help}
                  </small>
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}
      {mode === 'analytical' && (
        <div className="field">
          <label htmlFor="comparison-tolerance">Similar-performance tolerance (fraction)</label>
          <input
            id="comparison-tolerance"
            type="number"
            min="0"
            max="0.5"
            step="0.01"
            {...register('tolerance', { valueAsNumber: true })}
            aria-invalid={!!errors.tolerance}
          />
          <small>
            {errors.tolerance?.message ??
              '0.05 means CPU/GPU time ratios from 0.95 to 1.05 are treated as similar.'}
          </small>
        </div>
      )}
    </div>
  );
}
