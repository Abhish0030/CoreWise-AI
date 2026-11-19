'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  modelListSchema,
  datasetListSchema,
  predictionListSchema,
  explanationListSchema,
  explanationResponseSchema,
  type CurrentUser,
  type ModelExplanation,
} from '@corewise/types';
import { apiData } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { GlobalImportance, ImportanceComparison } from './explanation-views';
import { SavedPredictionExplanation } from './saved-prediction-explanation';
export function ExplainabilityWorkspace({ user }: { user: CurrentUser }) {
  const client = useQueryClient();
  const models = useQuery({
    queryKey: ['ml-models', user.id],
    queryFn: () => apiData('/api/ml/models', modelListSchema),
  });
  const datasets = useQuery({
    queryKey: ['ml-datasets', user.id],
    queryFn: () => apiData('/api/ml/datasets', datasetListSchema),
  });
  const predictions = useQuery({
    queryKey: ['ml-predictions', user.id],
    queryFn: () => apiData('/api/ml/predictions', predictionListSchema),
  });
  const history = useQuery({
    queryKey: ['explanation-history', user.id],
    queryFn: () => apiData('/api/explanations', explanationListSchema),
    refetchInterval: (q) =>
      q.state.data?.data.some((r) => ['QUEUED', 'RUNNING'].includes(r.status)) ? 1500 : false,
  });
  const [cpuId, setCpuId] = useState(''),
    [gpuId, setGpuId] = useState(''),
    [predictionId, setPredictionId] = useState(''),
    [background, setBackground] = useState(32),
    [samples, setSamples] = useState(32),
    [family, setFamily] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [requestedGlobals, setRequestedGlobals] = useState<Record<string, string>>({});
  const ids = {
    CPU:
      cpuId ||
      models.data?.data.find((m) => m.target === 'CPU' && m.active)?.id ||
      models.data?.data.find((m) => m.target === 'CPU')?.id,
    GPU:
      gpuId ||
      models.data?.data.find((m) => m.target === 'GPU' && m.active)?.id ||
      models.data?.data.find((m) => m.target === 'GPU')?.id,
  };
  function globalFor(id: string | undefined) {
    const rows = history.data?.data.filter((r) => r.kind === 'GLOBAL' && r.modelId === id);
    return rows?.find((r) => r.status === 'COMPLETED') ?? rows?.[0];
  }
  const cpuRequest = ids.CPU ? (requestedGlobals[ids.CPU] ?? globalFor(ids.CPU)?.id) : undefined;
  const gpuRequest = ids.GPU ? (requestedGlobals[ids.GPU] ?? globalFor(ids.GPU)?.id) : undefined;
  const cpuQuery = useQuery({
    queryKey: ['explanation', user.id, cpuRequest],
    queryFn: () =>
      apiData(`/api/explanations/${encodeURIComponent(cpuRequest!)}`, explanationResponseSchema),
    enabled: !!cpuRequest,
    refetchInterval: (q) =>
      q.state.data && ['QUEUED', 'RUNNING'].includes(q.state.data.data.status) ? 1500 : false,
  });
  const gpuQuery = useQuery({
    queryKey: ['explanation', user.id, gpuRequest],
    queryFn: () =>
      apiData(`/api/explanations/${encodeURIComponent(gpuRequest!)}`, explanationResponseSchema),
    enabled: !!gpuRequest,
    refetchInterval: (q) =>
      q.state.data && ['QUEUED', 'RUNNING'].includes(q.state.data.data.status) ? 1500 : false,
  });
  const cpu = cpuQuery.data?.data ?? globalFor(ids.CPU),
    gpu = gpuQuery.data?.data ?? globalFor(ids.GPU);
  async function compute() {
    setBusy(true);
    setError('');
    try {
      if (
        background < 8 ||
        background > 128 ||
        samples < 2 ||
        samples > 128 ||
        !Number.isInteger(background) ||
        !Number.isInteger(samples)
      )
        throw Error('Use 8–128 background and 2–128 evaluation samples.');
      for (const modelId of [ids.CPU, ids.GPU].filter((id): id is string => !!id)) {
        const response = await apiData('/api/explanations', explanationResponseSchema, {
          method: 'POST',
          body: JSON.stringify({
            kind: 'GLOBAL',
            modelId,
            backgroundLimit: background,
            sampleLimit: samples,
            ...(family.trim() ? { workloadFamily: family.trim() } : {}),
          }),
        });
        client.setQueryData(['explanation', user.id, response.data.id], response);
        setRequestedGlobals((previous) => ({ ...previous, [modelId]: response.data.id }));
      }
      await client.invalidateQueries({ queryKey: ['explanation-history', user.id] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'SHAP unavailable.');
    } finally {
      setBusy(false);
    }
  }
  const selectedPrediction = predictionId || predictions.data?.data[0]?.id;
  return (
    <div className="dashboard explanation-workspace">
      <div className="page-heading">
        <div>
          <div className="eyebrow">ATTRIBUTION WITH AN AUDIT TRAIL</div>
          <h1>
            Explainability<span className="title-dot">.</span>
          </h1>
          <p>Calculated SHAP explanations of fitted CPU/GPU regression models.</p>
        </div>
        <span className="badge">M5 · SHAP</span>
      </div>
      <div className="notice">
        SHAP explains model behavior, not causality. Synthetic-trained explanations are
        demonstrations, not real-world accuracy evidence. Contributions use ln(ms); analytical
        estimates, predictions and measured benchmarks retain their separate provenance.
      </div>
      <div className="ml-overview">
        {(['CPU', 'GPU'] as const).map((target) => {
          const active = models.data?.data.find((m) => m.target === target && m.active);
          const dataset = datasets.data?.data.find((d) => d.id === active?.datasetId);
          return (
            <section className="panel" key={target}>
              <span className="eyebrow">ACTIVE {target} MODEL</span>
              <h2>{active ? active.algorithm : 'Model unavailable'}</h2>
              <span className="badge">{active?.provenance ?? 'NOT TRAINED / INACTIVE'}</span>
              <p className="muted">
                {active
                  ? `Version ${active.version} · dataset ${dataset?.version ?? active.datasetId}`
                  : 'Train and activate owned models to generate predictions. Historical fitted versions can be explained separately.'}
              </p>
            </section>
          );
        })}
      </div>
      {(models.isPending || history.isPending) && (
        <div
          role="status"
          className="skeleton explanation-loading"
          aria-label="Loading explainability workspace"
        />
      )}
      {(models.isError ||
        datasets.isError ||
        predictions.isError ||
        history.isError ||
        cpuQuery.isError ||
        gpuQuery.isError) && (
        <section className="panel">
          <p className="form-error" role="alert">
            Couldn’t load explainability data.
          </p>
          <Button variant="outline" onClick={() => void client.invalidateQueries()}>
            Retry
          </Button>
        </section>
      )}
      <section className="panel">
        <span className="eyebrow">01 · GLOBAL MODEL BEHAVIOR</span>
        <h2>Feature importance</h2>
        <p
          className="muted"
          title="Mean absolute SHAP magnitude over a deterministic held-out sample. Background rows come only from training data."
        >
          Compare mean absolute grouped SHAP for selected model versions. Each model uses its own
          dataset and baseline; this is not a speedup attribution.
        </p>
        <div className="form-grid">
          {(['CPU', 'GPU'] as const).map((target) => (
            <div className="field" key={target}>
              <label htmlFor={`shap-${target}-model`}>{target} explanation model</label>
              <select
                id={`shap-${target}-model`}
                value={ids[target] ?? ''}
                onChange={(e) =>
                  target === 'CPU' ? setCpuId(e.target.value) : setGpuId(e.target.value)
                }
              >
                <option value="">No {target} model</option>
                {models.data?.data
                  .filter((m) => m.target === target)
                  .map((m) => (
                    <option value={m.id} key={m.id}>
                      {m.algorithm} · {m.version.slice(0, 8)} · {m.provenance}
                      {m.active ? ' · Active' : ''}
                    </option>
                  ))}
              </select>
            </div>
          ))}
          <div className="field">
            <label htmlFor="shap-background">Training background sample limit</label>
            <input
              id="shap-background"
              type="number"
              min={8}
              max={128}
              value={background}
              onChange={(e) => setBackground(Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor="shap-samples">Held-out evaluation sample limit</label>
            <input
              id="shap-samples"
              type="number"
              min={2}
              max={128}
              value={samples}
              onChange={(e) => setSamples(Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor="shap-family">Workload family filter (optional)</label>
            <input
              id="shap-family"
              value={family}
              maxLength={100}
              placeholder="All eligible held-out families"
              onChange={(e) => setFamily(e.target.value)}
            />
          </div>
        </div>
        <Button disabled={busy || (!ids.CPU && !ids.GPU)} onClick={() => void compute()}>
          Compute global importance
        </Button>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {!models.isPending && !models.data?.data.length && (
          <p className="muted">
            No fitted models available. <Link href="/ml-predictions">Open ML Predictions</Link> to
            create real fitted artifacts.
          </p>
        )}
        <div className="explanation-statuses">
          {[cpu, gpu]
            .filter((r): r is ModelExplanation => !!r)
            .map((r) => (
              <div key={r.id}>
                <span className="badge">{r.status}</span>
                {r.error && (
                  <p className="form-error" role="alert">
                    {r.error}
                  </p>
                )}
                {['QUEUED', 'RUNNING'].includes(r.status) && (
                  <div
                    role="status"
                    className="skeleton explanation-loading"
                    aria-label="Computing global SHAP importance"
                  />
                )}
              </div>
            ))}
        </div>
      </section>
      {cpu?.result?.kind === 'GLOBAL' && <GlobalImportance data={cpu.result.global} />}{' '}
      {gpu?.result?.kind === 'GLOBAL' && <GlobalImportance data={gpu.result.global} />}{' '}
      {cpu?.result?.kind === 'GLOBAL' && gpu?.result?.kind === 'GLOBAL' && (
        <ImportanceComparison cpu={cpu.result.global} gpu={gpu.result.global} />
      )}
      <section className="panel">
        <span className="eyebrow">02 · LOCAL PREDICTION EXPLANATIONS</span>
        <h2>Individual prediction</h2>
        <div className="field">
          <label htmlFor="shap-prediction">Saved prediction to explain</label>
          <select
            id="shap-prediction"
            value={selectedPrediction ?? ''}
            onChange={(e) => setPredictionId(e.target.value)}
          >
            <option value="">Choose a saved prediction…</option>
            {predictions.data?.data.map((p) => (
              <option value={p.id} key={p.id}>
                {p.workloadSnapshot.name} · {new Date(p.createdAt).toLocaleString()} · PREDICTED
              </option>
            ))}
          </select>
        </div>
        {!predictions.isPending && !predictions.data?.data.length && (
          <p className="muted">
            No saved ML predictions yet.{' '}
            <Link href="/ml-predictions">Generate a model-backed prediction</Link> first. Analytical
            estimates and measured benchmark timings are not substituted.
          </p>
        )}
      </section>
      {selectedPrediction && (
        <SavedPredictionExplanation
          key={selectedPrediction}
          userId={user.id}
          predictionId={selectedPrediction}
        />
      )}
      <section className="panel">
        <h2>Explanation history</h2>
        {!history.data?.data.length ? (
          <p className="muted">No saved SHAP explanations.</p>
        ) : (
          <div className="ml-history">
            {history.data.data.map((r) => (
              <div className="explanation-history-row" key={r.id}>
                <strong>
                  {r.kind} · {r.status}
                </strong>
                <small>
                  {new Date(r.createdAt).toLocaleString()} · {r.id}
                </small>
                {r.error && <p className="form-error">{r.error}</p>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
