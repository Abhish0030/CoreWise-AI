'use client';
import Link from 'next/link';
import { useState } from 'react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  emptyCapabilities,
  hardwareListSchema,
  workloadListSchema,
  modelCatalogSchema,
  predictionListSchema,
  predictionResponseSchema,
  type CurrentUser,
  type Capabilities,
  type MLPrediction,
} from '@corewise/types';
import { Button } from '@/components/ui/button';
import { CapabilityFields } from '@/features/workloads/capability-fields';
import { apiData } from '@/lib/api';
import { SavedPredictionExplanation } from '@/features/explainability/saved-prediction-explanation';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type Inputs = {
  workloadId: string;
  hardwareProfileId: string;
  assumptions: Capabilities;
  tolerance: number;
  cpuModelId: string;
  gpuModelId: string;
};
export function PredictionPlayground({ user }: { user: CurrentUser }) {
  const client = useQueryClient();
  const workloads = useQuery({
    queryKey: ['workloads', user.id],
    queryFn: () => apiData('/api/workloads', workloadListSchema),
  });
  const hardware = useQuery({
    queryKey: ['hardware-profiles', user.id],
    queryFn: () => apiData('/api/hardware-profiles', hardwareListSchema),
  });
  const models = useQuery({
    queryKey: ['ml-model-catalog', user.id],
    queryFn: () => apiData('/api/ml/model-catalog', modelCatalogSchema),
    refetchInterval: 5000,
  });
  const history = useQuery({
    queryKey: ['ml-predictions', user.id],
    queryFn: () => apiData('/api/ml/predictions', predictionListSchema),
  });
  const [shown, setShown] = useState<MLPrediction | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const form = useForm<Inputs>({
    defaultValues: {
      workloadId: '',
      hardwareProfileId: user.selectedProfileId ?? user.defaultProfileId ?? '',
      assumptions: { ...emptyCapabilities },
      tolerance: 0.05,
      cpuModelId: '',
      gpuModelId: '',
    },
  });
  const v = useWatch({ control: form.control }) as Inputs;
  const profile = hardware.data?.data.find((h) => h.id === v.hardwareProfileId);
  const active = models.data?.data.private.filter((m) => m.active) ?? [];
  const shared = models.data?.data.shared ?? [];
  const ready = (['CPU', 'GPU'] as const).every((target) => {
    const id = target === 'CPU' ? v.cpuModelId : v.gpuModelId;
    return id
      ? [...active, ...shared].some((m) => m.target === target && m.id === id)
      : active.some((m) => m.target === target);
  });
  async function predict(value: Inputs) {
    setBusy(true);
    setError('');
    setShown(null);
    try {
      const { workloadId, hardwareProfileId, assumptions, cpuModelId, gpuModelId } = value;
      const input = { workloadId, hardwareProfileId, assumptions };
      const response = await apiData('/api/ml/predict', predictionResponseSchema, {
        method: 'POST',
        body: JSON.stringify({
          ...input,
          ...(cpuModelId ? { cpuModelId } : {}),
          ...(gpuModelId ? { gpuModelId } : {}),
        }),
      });
      setShown(response.data);
      await client.invalidateQueries({ queryKey: ['ml-predictions'] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Prediction failed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel ml-playground" id="prediction-playground">
      <div className="section-heading">
        <div>
          <span className="eyebrow">TRAINED PIPELINES · EXPLICIT INPUTS</span>
          <h2>Prediction playground</h2>
        </div>
        <span className="badge">PREDICTED</span>
      </div>
      {!ready && (
        <p className="notice">
          Model unavailable. Train and activate a compatible CPU and GPU model.{' '}
          <Link href="/ml-predictions">Manage models</Link>. Analytical estimates remain available.
        </p>
      )}
      <h3>Shared Experimental Models</h3>
      {shared.length === 0 && !models.isPending && !models.isError && (
        <p>No shared models are currently available.</p>
      )}
      {shared.map((m) => (
        <div className="notice" key={m.id}>
          <strong>
            {m.target} · {m.algorithm} · SHARED_EXPERIMENTAL
          </strong>
          <p>
            {m.compatibility.cpuModel} / {m.compatibility.gpuModel}
          </p>
          <p>
            Workloads: {m.compatibility.workloads.join(', ')}. Precisions:{' '}
            {m.compatibility.precisions.join(', ')}.
          </p>
          <p>
            Test MAE {m.evaluation.test.maeMs.toPrecision(4)} ms; RMSE{' '}
            {m.evaluation.test.rmseMs.toPrecision(4)} ms; R² {m.evaluation.test.r2.toFixed(3)}.
          </p>
          <p>{m.limitations}</p>
          <p>
            Exact approved identities and feature ranges are required. Matching names alone do not
            establish equivalent performance.
          </p>
        </div>
      ))}
      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(predict)} onChange={() => setShown(null)}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="ml-workload">Prediction workload</label>
              <select
                id="ml-workload"
                value={v.workloadId ?? ''}
                {...form.register('workloadId', { required: true })}
                onChange={(e) => {
                  const w = workloads.data?.data.find((w) => w.id === e.target.value);
                  form.setValue('workloadId', e.target.value);
                  if (w) {
                    form.setValue('assumptions', w.assumptions);
                    if (w.hardwareProfileId)
                      form.setValue('hardwareProfileId', w.hardwareProfileId);
                  }
                }}
              >
                <option value="">Select saved workload…</option>
                {workloads.data?.data.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
              {form.formState.errors.workloadId && (
                <small className="field-error">Select a workload.</small>
              )}
            </div>
            <div className="field">
              <label htmlFor="ml-hardware">Prediction hardware</label>
              <select
                id="ml-hardware"
                value={v.hardwareProfileId ?? ''}
                {...form.register('hardwareProfileId', { required: true })}
                onChange={(e) => {
                  form.setValue('hardwareProfileId', e.target.value);
                  form.setValue('assumptions', {
                    ...emptyCapabilities,
                    precision: v.assumptions.precision,
                  });
                }}
              >
                <option value="">Select saved profile…</option>
                {hardware.data?.data.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
              {form.formState.errors.hardwareProfileId && (
                <small className="field-error">Select hardware.</small>
              )}
            </div>
            {(['CPU', 'GPU'] as const).map((target) => (
              <div className="field" key={target}>
                <label htmlFor={`ml-${target}-model`}>{target} active model</label>
                <select
                  id={`ml-${target}-model`}
                  {...form.register(target === 'CPU' ? 'cpuModelId' : 'gpuModelId')}
                >
                  <option value="">Use active {target} model</option>
                  <optgroup label="My Models">
                    {active
                      .filter((m) => m.target === target)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} · {m.provenance} · {m.version.slice(0, 8)}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Shared Experimental Models">
                    {shared
                      .filter((m) => m.target === target)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.algorithm} · experimental · {m.version.slice(0, 8)}
                        </option>
                      ))}
                  </optgroup>
                </select>
              </div>
            ))}
          </div>
          <details className="assumptions-section" open>
            <summary>ML feature inputs and units</summary>
            <CapabilityFields hardware={profile} mode="ml" />
            <p className="muted">
              Each profile shows its USER_ENTERED or MEASURED source. Frequency and capacity may
              remain unknown and use the model’s training-only imputation policy. Effective
              throughput is supplied explicitly. Predictions cover all saved repetitions, with
              repeated transfer and launch.
            </p>
          </details>
          {(workloads.isError || hardware.isError || models.isError || history.isError) && (
            <p role="alert" className="form-error">
              Couldn’t load ML configurations.{' '}
              <Button
                type="button"
                variant="outline"
                onClick={() => void client.invalidateQueries()}
              >
                Retry
              </Button>
            </p>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <Button disabled={busy || !ready}>{busy ? 'Predicting…' : 'Generate prediction'}</Button>
        </form>
      </FormProvider>
      {shown && <PredictionView prediction={shown} userId={user.id} />}
      <h3>Prediction history</h3>
      {history.isPending ? (
        <div
          role="status"
          className="skeleton comparison-loading"
          aria-label="Loading predictions"
        />
      ) : !history.data?.data.length ? (
        <p className="muted">No saved ML predictions yet.</p>
      ) : (
        <div className="ml-history">
          {history.data.data.map((p) => (
            <button key={p.id} type="button" onClick={() => setShown(p)}>
              <strong>{p.workloadSnapshot.name}</strong>
              <span>
                {p.hardwareSnapshot.name} · {p.result.cpuTimeMs.toPrecision(4)} /{' '}
                {p.result.gpuTimeMs.toPrecision(4)} ms · {p.result.speedup.toPrecision(3)}×
              </span>
              <small>
                PREDICTED · CPU {p.result.models.CPU.datasetProvenance} / GPU{' '}
                {p.result.models.GPU.datasetProvenance} · {new Date(p.createdAt).toLocaleString()}
                {' · '}CPU v{p.result.models.CPU.version.slice(0, 8)} / GPU v
                {p.result.models.GPU.version.slice(0, 8)}
              </small>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
function PredictionView({ prediction: p, userId }: { prediction: MLPrediction; userId: string }) {
  const r = p.result;
  return (
    <div className="ml-prediction-result" data-testid="ml-prediction-result">
      <span className="eyebrow">SAVED MODEL OUTPUT · PREDICTED</span>
      <h3>
        {p.workloadSnapshot.name} · {p.hardwareSnapshot.name}
      </h3>
      <p className="notice">{r.label}</p>
      <div className="ml-metrics">
        <div>
          <span>CPU prediction</span>
          <strong>
            {r.cpuTimeMs.toPrecision(4)} <small>ms</small>
          </strong>
        </div>
        <div>
          <span>GPU prediction</span>
          <strong>
            {r.gpuTimeMs.toPrecision(4)} <small>ms</small>
          </strong>
        </div>
        <div>
          <span>CPU / GPU</span>
          <strong>{r.speedup.toPrecision(4)}×</strong>
          <small>
            {r.speedup > 1
              ? 'GPU predicted faster'
              : r.speedup < 1
                ? 'CPU predicted faster'
                : 'Equal predicted times'}
          </small>
        </div>
      </div>
      <div className="ml-chart" role="img" aria-label="Predicted CPU and GPU execution times">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={[
              { device: 'CPU', ms: r.cpuTimeMs },
              { device: 'GPU', ms: r.gpuTimeMs },
            ]}
          >
            <XAxis dataKey="device" />
            <YAxis width={55} />
            <Tooltip />
            <Bar dataKey="ms" fill="var(--accent)" isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="muted">
        Immutable prediction snapshot. No analytical fallback. CPU model {r.models.CPU.version} (
        {r.models.CPU.datasetProvenance}); GPU model {r.models.GPU.version} (
        {r.models.GPU.datasetProvenance}).
      </p>
      {r.warnings.map((w) => (
        <p key={w} className="muted">
          {w}
        </p>
      ))}
      <SavedPredictionExplanation key={p.id} userId={userId} predictionId={p.id} />
    </div>
  );
}
