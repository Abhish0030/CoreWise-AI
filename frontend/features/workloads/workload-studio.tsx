'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  blankWorkload,
  emptyCapabilities,
  workloadPresets,
  workloadInputSchema,
  workloadResponseSchema,
  workloadListSchema,
  hardwareListSchema,
  comparisonResponseSchema,
  type CurrentUser,
  type WorkloadInput,
  type Workload,
} from '@corewise/types';
import { Plus, Save, Play, Copy, Trash2, X, Workflow, Cpu, ArrowRight } from 'lucide-react';
import { useAuth } from '@/features/auth/use-auth';
import { apiData, apiRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { CapabilityFields } from './capability-fields';

const parameterFields = [
  [
    'inputSize',
    'Input size',
    'Descriptive input size. Changing it does not recalculate the operation count or other parameters.',
  ],
  [
    'operationCount',
    'Estimated operations (FLOPs)',
    'Total operations per repetition. For non-floating-point tasks, use an explicitly labeled FLOP-equivalent approximation.',
  ],
  [
    'arithmeticIntensity',
    'Arithmetic intensity (FLOPs/byte)',
    'Operations divided by total device-memory traffic. Must be positive for nonzero work.',
  ],
  [
    'parallelFraction',
    'Parallelizable fraction (0–1)',
    'The fraction of operations and traffic that can run in parallel or be offloaded.',
  ],
  [
    'memoryMiB',
    'Memory footprint (MiB)',
    'Resident workspace for capacity checks. 1 MiB = 1,048,576 bytes; not additional traffic.',
  ],
  [
    'transferMiB',
    'CPU–GPU transfer size (MiB)',
    'Per repetition. Choose total bytes or one-way round trip in the assumptions section.',
  ],
  [
    'repetitions',
    'Repetitions',
    'Repeat compute, memory traffic, transfers, and one GPU launch this many times.',
  ],
] as const;
export function WorkloadStudio({
  user,
  initialWorkload,
}: {
  user: CurrentUser;
  initialWorkload?: Workload;
}) {
  const auth = useAuth(user);
  const client = useQueryClient();
  const router = useRouter();
  const workloads = useQuery({
    queryKey: ['workloads', user.id],
    queryFn: () => apiData('/api/workloads', workloadListSchema),
  });
  const hardware = useQuery({
    queryKey: ['hardware-profiles', user.id],
    queryFn: () => apiData('/api/hardware-profiles', hardwareListSchema),
  });
  const preferred = user.selectedProfileId ?? user.defaultProfileId;
  const form = useForm<WorkloadInput>({
    resolver: zodResolver(workloadInputSchema),
    defaultValues: initialWorkload
      ? workloadInputSchema.strip().parse(initialWorkload)
      : { ...blankWorkload, assumptions: { ...emptyCapabilities }, hardwareProfileId: preferred },
  });
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    formState: { errors },
  } = form;
  const [editing, setEditing] = useState<string | null>(initialWorkload?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const deletion = useRef<HTMLDialogElement>(null);
  const current = useWatch({ control: form.control }) as WorkloadInput;
  const selected = hardware.data?.data.find((profile) => profile.id === current.hardwareProfileId);
  function load(workload: Workload) {
    setEditing(workload.id);
    reset(workloadInputSchema.strip().parse(workload));
    setNotice('Loaded saved configuration.');
  }
  function fresh() {
    setEditing(null);
    reset({
      ...blankWorkload,
      assumptions: { ...emptyCapabilities },
      hardwareProfileId: auth.data?.selectedProfileId ?? auth.data?.defaultProfileId ?? null,
    });
    setNotice('New workload.');
  }
  function profileChanged(id: string) {
    setValue('hardwareProfileId', id || null, { shouldDirty: true });
    setValue(
      'assumptions',
      { ...emptyCapabilities, precision: current.assumptions.precision },
      { shouldDirty: true },
    );
    setNotice(
      'Hardware changed. Capability assumptions were cleared; supply values for this system.',
    );
  }
  async function save(values: WorkloadInput, action: 'save' | 'analyze' | 'duplicate') {
    setBusy(true);
    setNotice('');
    try {
      const copying = action === 'duplicate';
      const payload = {
        ...values,
        name: copying ? `${values.name.slice(0, 112)} (copy)` : values.name,
      };
      const saved = await apiData(
        `/api/workloads${editing && !copying ? `/${editing}` : ''}`,
        workloadResponseSchema,
        { method: editing && !copying ? 'PATCH' : 'POST', body: JSON.stringify(payload) },
      );
      setEditing(saved.data.id);
      reset(workloadInputSchema.strip().parse(saved.data));
      await client.invalidateQueries({ queryKey: ['workloads'] });
      if (action === 'analyze') {
        const record = await apiData('/api/analytical/compare', comparisonResponseSchema, {
          method: 'POST',
          body: JSON.stringify({
            workloadId: saved.data.id,
            ...(payload.hardwareProfileId ? { hardwareProfileId: payload.hardwareProfileId } : {}),
            assumptions: payload.assumptions,
            tolerance: payload.tolerance,
          }),
        });
        client.setQueryData(['comparison', record.data.id], record);
        await client.invalidateQueries({ queryKey: ['comparisons'] });
        router.push(`/cpu-vs-gpu?comparison=${record.data.id}`);
      } else setNotice(copying ? 'Workload duplicated.' : 'Workload saved.');
    } catch (err) {
      setError('root', {
        message: err instanceof Error ? err.message : 'Unable to save workload.',
      });
    } finally {
      setBusy(false);
    }
  }
  const presets = workloadPresets.find((preset) => preset.id === current.presetId);
  return (
    <div className="dashboard workload-studio">
      <div className="page-heading">
        <div>
          <div className="eyebrow">CONFIGURE. UNDERSTAND. COMPARE.</div>
          <h1>
            Workload Analyzer<span className="title-dot">.</span>
          </h1>
          <p>Turn a workload description into an explainable analytical estimate.</p>
        </div>
        <span className="badge analytical-badge">ANALYTICAL ESTIMATE</span>
      </div>
      <div className="workload-layout">
        <aside className="panel workload-picker" aria-label="Workload selection">
          <div className="card-heading">
            <h2>Saved workloads</h2>
            <Button size="icon" variant="ghost" aria-label="New workload" onClick={fresh}>
              <Plus size={18} />
            </Button>
          </div>
          <input
            className="workload-search"
            type="search"
            placeholder="Find a workload…"
            aria-label="Search workloads"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {workloads.isPending ? (
            <div className="skeleton workload-list-loading" />
          ) : workloads.isError ? (
            <div className="picker-empty">
              <p>Couldn’t load workloads.</p>
              <Button variant="outline" onClick={() => void workloads.refetch()}>
                Retry
              </Button>
            </div>
          ) : workloads.data.data.length === 0 ? (
            <div className="picker-empty">
              <Workflow size={26} />
              <p>No saved workloads yet. Start from a preset or configure your own.</p>
            </div>
          ) : (
            <div className="workload-list">
              {workloads.data.data
                .filter((workload) => workload.name.toLowerCase().includes(search.toLowerCase()))
                .map((workload) => (
                  <button
                    key={workload.id}
                    className={editing === workload.id ? 'chosen' : ''}
                    onClick={() => load(workload)}
                  >
                    <Workflow size={16} />
                    <span>
                      <strong>{workload.name}</strong>
                      <small>
                        {workload.category.replaceAll('_', ' ')} ·{' '}
                        {new Date(workload.updatedAt).toLocaleDateString('en-GB', {
                          timeZone: 'UTC',
                        })}
                      </small>
                    </span>
                  </button>
                ))}
            </div>
          )}
          <Link className="picker-link" href="/cpu-vs-gpu">
            Saved comparisons
            <ArrowRight size={14} />
          </Link>
        </aside>
        <div className="workload-editor">
          <section className="panel preset-panel">
            <div>
              <h2>Start with a workload preset</h2>
              <p>Editable, illustrative assumptions. These are not measured characteristics.</p>
            </div>
            <div className="preset-options">
              {workloadPresets.map((preset) => (
                <button
                  key={preset.id}
                  className={current.presetId === preset.id ? 'active' : ''}
                  onClick={() => {
                    setEditing(null);
                    reset({
                      ...preset.values,
                      hardwareProfileId: current.hardwareProfileId,
                      assumptions: { ...preset.values.assumptions },
                    });
                    setNotice(
                      'Illustrative preset applied. Review all parameters before analysis.',
                    );
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            {presets && (
              <div className="preset-notes">
                <span className="badge provenance">SYNTHETIC_DEMO</span>
                {presets.notes.map((note) => (
                  <p key={note}>{note}</p>
                ))}
              </div>
            )}
          </section>
          <FormProvider {...form}>
            <form
              className="panel workload-form"
              onSubmit={handleSubmit((value) => save(value, 'save'))}
              noValidate
            >
              <div className="workload-form-content">
                <div className="section-heading">
                  <h2>{editing ? 'Edit workload' : 'Configure workload'}</h2>
                  <span className="badge">
                    {current.presetId ? 'ILLUSTRATIVE PRESET' : 'USER_ENTERED'}
                  </span>
                </div>
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="workload-name">Workload name</label>
                    <input id="workload-name" {...register('name')} aria-invalid={!!errors.name} />
                    {errors.name && <small className="field-error">{errors.name.message}</small>}
                  </div>
                  <div className="field">
                    <label htmlFor="workload-category">Category</label>
                    <select id="workload-category" {...register('category')}>
                      {[
                        'CUSTOM',
                        'REDUCTION',
                        'MATRIX_MULTIPLICATION',
                        'VECTOR_ADDITION',
                        'SORTING',
                        'IMAGE_PROCESSING',
                        'SCIENTIFIC_COMPUTATION',
                      ].map((value) => (
                        <option key={value} value={value}>
                          {value.replaceAll('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="workload-description">Workload description</label>
                  <textarea id="workload-description" rows={2} {...register('description')} />
                  {errors.description && (
                    <small className="field-error">{errors.description.message}</small>
                  )}
                </div>
                <fieldset>
                  <legend>Technical parameters</legend>
                  <div className="form-grid">
                    {parameterFields.map(([key, label, help]) => (
                      <div className="field" key={key}>
                        <label htmlFor={`workload-${key}`}>{label}</label>
                        <input
                          id={`workload-${key}`}
                          type="number"
                          step={
                            ['operationCount', 'inputSize', 'repetitions'].includes(key) ? 1 : 'any'
                          }
                          {...register(key, { valueAsNumber: true })}
                          aria-invalid={!!errors[key]}
                          aria-describedby={`workload-help-${key}`}
                        />
                        <small id={`workload-help-${key}`}>
                          {errors[key] ? (
                            <span className="field-error">{errors[key]?.message}</span>
                          ) : (
                            help
                          )}
                        </small>
                      </div>
                    ))}
                    <div className="field">
                      <label htmlFor="workload-unit">Input size unit</label>
                      <select id="workload-unit" {...register('inputUnit')}>
                        {[
                          'ELEMENTS',
                          'BYTES',
                          'MiB',
                          'GiB',
                          'ROWS',
                          'PIXELS',
                          'MATRIX_DIMENSION',
                        ].map((unit) => (
                          <option key={unit} value={unit}>
                            {unit.replaceAll('_', ' ')}
                          </option>
                        ))}
                      </select>
                      <small>
                        Input size is descriptive; explicit operations and intensity drive timing.
                      </small>
                    </div>
                  </div>
                </fieldset>
                <fieldset>
                  <legend>
                    <Cpu size={17} />
                    Hardware environment
                  </legend>
                  <div className="field">
                    <label htmlFor="workload-hardware">Selected hardware profile</label>
                    <select
                      id="workload-hardware"
                      value={current.hardwareProfileId ?? ''}
                      onChange={(e) => profileChanged(e.target.value)}
                    >
                      <option value="">Select hardware…</option>
                      {hardware.data?.data.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.name}
                          {profile.id === auth.data?.defaultProfileId ? ' · Default' : ''}
                        </option>
                      ))}
                    </select>
                    <small>
                      {hardware.isError
                        ? 'Hardware profiles could not be loaded.'
                        : selected
                          ? `${selected.cpuName} · ${selected.gpuName ?? 'GPU not specified'} · ${selected.ramGb} GiB RAM · ${selected.provenance}`
                          : 'A saved, owned hardware profile is required to analyze.'}
                    </small>
                  </div>
                  <div className="hardware-selection-actions">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!auth.data?.defaultProfileId}
                      onClick={() =>
                        auth.data?.defaultProfileId && profileChanged(auth.data.defaultProfileId)
                      }
                    >
                      Use default profile
                    </Button>
                    <Link href="/hardware-library">
                      Manage hardware
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </fieldset>
                <details className="assumptions-section" open>
                  <summary>Performance assumptions & comparison tolerance</summary>
                  <CapabilityFields hardware={selected} />
                </details>
                <div className="workload-summary">
                  <span>
                    <strong>
                      {Number.isFinite(current.operationCount)
                        ? current.operationCount.toLocaleString()
                        : '—'}
                    </strong>{' '}
                    operations / repetition
                  </span>
                  <span>
                    <strong>{current.memoryMiB ?? '—'} MiB</strong> resident footprint
                  </span>
                  <span>
                    <strong>{current.repetitions ?? '—'}×</strong> repetitions
                  </span>
                </div>
                {notice && (
                  <div className="success-notice" role="status">
                    {notice}
                  </div>
                )}
                {errors.root && (
                  <div className="form-error" role="alert">
                    {errors.root.message}
                  </div>
                )}
              </div>
              <div className="workload-form-actions">
                <Button variant="outline" disabled={busy}>
                  <Save size={15} />
                  Save workload
                </Button>
                <Button
                  type="button"
                  disabled={busy}
                  onClick={handleSubmit((value) => save(value, 'analyze'))}
                >
                  <Play size={15} />
                  {busy ? 'Working…' : 'Analyze'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy || !editing}
                  onClick={handleSubmit((value) => save(value, 'duplicate'))}
                >
                  <Copy size={15} />
                  Duplicate
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy || !editing}
                  onClick={() => deletion.current?.showModal()}
                >
                  <Trash2 size={15} />
                  Delete
                </Button>
                <small>
                  Analyze saves this configuration first. Estimates are not measurements.
                </small>
              </div>
            </form>
          </FormProvider>
        </div>
      </div>
      <dialog ref={deletion} className="confirm-dialog" aria-labelledby="delete-workload-title">
        <div className="dialog-heading">
          <h2 id="delete-workload-title">Delete workload?</h2>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Close workload deletion"
            onClick={() => deletion.current?.close()}
          >
            <X size={18} />
          </Button>
        </div>
        <div className="confirm-body">
          <p>
            Remove this saved workload? Existing analytical comparisons retain their immutable
            configuration snapshots.
          </p>
          <div className="form-actions">
            <Button variant="outline" onClick={() => deletion.current?.close()}>
              Keep workload
            </Button>
            <Button
              disabled={busy}
              onClick={async () => {
                if (!editing) return;
                setBusy(true);
                try {
                  await apiRequest(`/api/workloads/${editing}`, { method: 'DELETE' });
                  await client.invalidateQueries({ queryKey: ['workloads'] });
                  deletion.current?.close();
                  fresh();
                  setNotice('Workload deleted.');
                } catch (err) {
                  setError('root', {
                    message: err instanceof Error ? err.message : 'Delete failed.',
                  });
                  deletion.current?.close();
                } finally {
                  setBusy(false);
                }
              }}
            >
              Delete workload
            </Button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
