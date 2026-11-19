'use client';
import { useForm, type DefaultValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { hardwareInputSchema, type HardwareInput, type HardwareProfile } from '@corewise/types';
import { Button } from '@/components/ui/button';
import { ApiClientError } from '@/lib/api';
import { Cpu, Layers3, MemoryStick, Monitor } from 'lucide-react';

const empty: HardwareInput = {
  name: '',
  manufacturer: '',
  deviceModel: '',
  os: '',
  description: '',
  cpuManufacturer: '',
  cpuName: '',
  physicalCores: null,
  logicalProcessors: null,
  cpuBaseGhz: null,
  cpuMaxGhz: null,
  gpuManufacturer: '',
  gpuName: null,
  vramGb: null,
  memoryBandwidthGbps: null,
  computeCapability: null,
  ramGb: 16,
  memoryType: '',
  memoryFrequencyMhz: null,
};
type Field = {
  key: keyof HardwareInput;
  label: string;
  placeholder?: string;
  numeric?: boolean;
  required?: boolean;
  help?: string;
};
const groups = [
  {
    name: 'General information',
    icon: Monitor,
    fields: [
      {
        key: 'name',
        label: 'Profile name',
        required: true,
        placeholder: 'e.g. Development workstation',
      },
      { key: 'manufacturer', label: 'Device manufacturer', placeholder: 'e.g. Custom build' },
      { key: 'deviceModel', label: 'Device model' },
      { key: 'os', label: 'Operating system', required: true, placeholder: 'e.g. Ubuntu 24.04' },
    ],
  },
  {
    name: 'Processor',
    icon: Cpu,
    fields: [
      {
        key: 'cpuManufacturer',
        label: 'CPU manufacturer',
        required: true,
        placeholder: 'e.g. AMD',
      },
      { key: 'cpuName', label: 'CPU model', required: true },
      { key: 'physicalCores', label: 'Physical core count', numeric: true },
      { key: 'logicalProcessors', label: 'Logical processor count', numeric: true },
      { key: 'cpuBaseGhz', label: 'Base frequency (GHz)', numeric: true },
      { key: 'cpuMaxGhz', label: 'Maximum frequency (GHz)', numeric: true },
    ],
  },
  {
    name: 'Graphics · optional',
    icon: Layers3,
    fields: [
      { key: 'gpuManufacturer', label: 'GPU manufacturer' },
      { key: 'gpuName', label: 'GPU model', placeholder: 'Leave blank if none or unknown' },
      { key: 'vramGb', label: 'VRAM capacity (GB)', numeric: true },
      { key: 'memoryBandwidthGbps', label: 'Memory bandwidth (GB/s)', numeric: true },
      {
        key: 'computeCapability',
        label: 'Compute capability',
        help: 'Vendor capability/version, if known. Leave unknown specifications blank.',
      },
    ],
  },
  {
    name: 'Memory',
    icon: MemoryStick,
    fields: [
      { key: 'ramGb', label: 'Installed RAM (GiB)', required: true, numeric: true },
      { key: 'memoryType', label: 'Memory type', placeholder: 'e.g. DDR5' },
      { key: 'memoryFrequencyMhz', label: 'Memory frequency (MHz)', numeric: true },
    ],
  },
] satisfies { name: string; icon: typeof Cpu; fields: Field[] }[];

export function HardwareForm({
  profile,
  onSave,
  onCancel,
}: {
  profile?: HardwareProfile;
  onSave: (input: HardwareInput) => Promise<void>;
  onCancel: () => void;
}) {
  const defaults: DefaultValues<HardwareInput> = profile
    ? (Object.fromEntries(
        Object.keys(empty).map((key) => [key, profile[key as keyof HardwareInput]]),
      ) as HardwareInput)
    : { ...empty, ramGb: undefined };
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<HardwareInput>({
    resolver: zodResolver(hardwareInputSchema),
    defaultValues: defaults,
  });
  return (
    <form
      className="hardware-form"
      onSubmit={handleSubmit(async (value) => {
        try {
          await onSave(value);
        } catch (err) {
          setError('root', {
            message: err instanceof Error ? err.message : 'Could not save this profile.',
          });
          if (err instanceof ApiClientError && err.fields)
            for (const key of Object.keys(empty) as (keyof HardwareInput)[]) {
              if (err.fields[key]?.[0]) setError(key, { message: err.fields[key][0] });
            }
        }
      })}
      noValidate
    >
      <div className="hardware-form-body">
        <div className="notice">
          <span>
            Specifications are <strong>USER_ENTERED</strong>. Enter values from your system
            documentation; this form does not detect or verify local hardware.
          </span>
        </div>
        {groups.map((group) => (
          <fieldset key={group.name}>
            <legend>
              <group.icon size={18} />
              {group.name}
            </legend>
            <div className="form-grid">
              {group.fields.map((spec: Field) => (
                <div className="field" key={spec.key}>
                  <label htmlFor={`hardware-${spec.key}`}>
                    {spec.label}
                    {spec.required && <span className="required-mark"> *</span>}
                  </label>
                  <input
                    id={`hardware-${spec.key}`}
                    type={spec.numeric ? 'number' : 'text'}
                    step={
                      spec.numeric &&
                      [
                        'cpuBaseGhz',
                        'cpuMaxGhz',
                        'vramGb',
                        'memoryBandwidthGbps',
                        'ramGb',
                      ].includes(spec.key)
                        ? 'any'
                        : spec.numeric
                          ? '1'
                          : undefined
                    }
                    min={spec.numeric ? 0 : undefined}
                    placeholder={spec.placeholder}
                    aria-required={spec.required}
                    aria-invalid={!!errors[spec.key]}
                    aria-describedby={
                      errors[spec.key]
                        ? `error-${spec.key}`
                        : spec.help
                          ? `hint-${spec.key}`
                          : undefined
                    }
                    {...register(
                      spec.key,
                      spec.numeric
                        ? {
                            setValueAs: (value) =>
                              value === '' || value === null || value === undefined
                                ? null
                                : Number(value),
                          }
                        : ['gpuName', 'computeCapability'].includes(spec.key)
                          ? {
                              setValueAs: (value) =>
                                typeof value === 'string' && value.trim() ? value : null,
                            }
                          : {},
                    )}
                  />
                  {spec.help && <small id={`hint-${spec.key}`}>{spec.help}</small>}
                  {errors[spec.key] && (
                    <small className="field-error" id={`error-${spec.key}`}>
                      {errors[spec.key]?.message}
                    </small>
                  )}
                </div>
              ))}
            </div>
          </fieldset>
        ))}
        <div className="field">
          <label htmlFor="hardware-description">Profile description</label>
          <textarea
            id="hardware-description"
            rows={3}
            maxLength={2000}
            {...register('description')}
            placeholder="Notes about this system, its purpose, or configuration."
            aria-invalid={!!errors.description}
          />
          {errors.description && (
            <small className="field-error">{errors.description.message}</small>
          )}
        </div>
        {errors.root && (
          <div className="form-error" role="alert">
            {errors.root.message}
          </div>
        )}
      </div>
      <div className="hardware-form-footer">
        <span>* Required · unknown optional values can remain blank</span>
        <div>
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={onCancel}>
            Cancel
          </Button>
          <Button disabled={isSubmitting}>
            {isSubmitting ? 'Saving profile…' : profile ? 'Save changes' : 'Create profile'}
          </Button>
        </div>
      </div>
    </form>
  );
}
