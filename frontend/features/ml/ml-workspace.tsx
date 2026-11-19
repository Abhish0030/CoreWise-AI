'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BrainCircuit, Database, FlaskConical, Play, Upload } from 'lucide-react';
import {
  datasetListSchema,
  datasetResponseSchema,
  jobListSchema,
  jobResponseSchema,
  modelListSchema,
  modelResponseSchema,
  type CurrentUser,
  type z,
  mlAlgorithmSchema,
} from '@corewise/types';
import { Button } from '@/components/ui/button';
import { apiData } from '@/lib/api';
import { Evaluation } from './evaluation';
import { PredictionPlayground } from './prediction-playground';

export function MLWorkspace({ user }: { user: CurrentUser }) {
  const client = useQueryClient();
  const datasets = useQuery({
    queryKey: ['ml-datasets', user.id],
    queryFn: () => apiData('/api/ml/datasets', datasetListSchema),
  });
  const jobs = useQuery({
    queryKey: ['ml-jobs', user.id],
    queryFn: () => apiData('/api/ml/training-jobs', jobListSchema),
    refetchInterval: (q) =>
      q.state.data?.data.some((j) => ['QUEUED', 'RUNNING'].includes(j.status)) ? 1500 : false,
  });
  const models = useQuery({
    queryKey: ['ml-models', user.id],
    queryFn: () => apiData('/api/ml/models', modelListSchema),
    refetchInterval: 5000,
  });
  const [datasetId, setDatasetId] = useState(''),
    [modelId, setModelId] = useState(''),
    [busy, setBusy] = useState(''),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const [name, setName] = useState('Demonstration dataset'),
    [count, setCount] = useState(600),
    [seed, setSeed] = useState(42),
    [csv, setCsv] = useState('');
  const [algorithms, setAlgorithms] = useState<z.infer<typeof mlAlgorithmSchema>[]>([
      'LINEAR',
      'RANDOM_FOREST',
      'XGBOOST',
    ]),
    [group, setGroup] = useState('CONFIGURATION');
  const selectedId = datasetId || datasets.data?.data[0]?.id || '';
  const preview = useQuery({
    queryKey: ['ml-dataset', selectedId],
    queryFn: () =>
      apiData(`/api/ml/datasets/${encodeURIComponent(selectedId)}`, datasetResponseSchema),
    enabled: !!selectedId,
  });
  const chosen = models.data?.data.find((m) => m.id === modelId) ?? models.data?.data[0];
  const active = models.data?.data.filter((m) => m.active) ?? [];
  const running = jobs.data?.data.some((j) => ['QUEUED', 'RUNNING'].includes(j.status));
  async function action(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError('');
    setMessage('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed.');
    } finally {
      setBusy('');
    }
  }
  async function createDataset(mode: 'SYNTHETIC' | 'CSV') {
    await action('dataset', async () => {
      const response = await apiData('/api/ml/datasets', datasetResponseSchema, {
        method: 'POST',
        body: JSON.stringify({ name, mode, count, seed, ...(mode === 'CSV' ? { csv } : {}) }),
      });
      setDatasetId(response.data.id);
      setMessage(`${response.data.rowCount} records validated and saved.`);
      await client.invalidateQueries({ queryKey: ['ml-datasets'] });
    });
  }
  return (
    <div className="dashboard ml-workspace">
      <div className="page-heading">
        <div>
          <div className="eyebrow">FIT. EVALUATE. PREDICT.</div>
          <h1>
            ML Predictions<span className="title-dot">.</span>
          </h1>
          <p>Versioned datasets, reproducible training, and predictions from fitted models.</p>
        </div>
        <span className="badge">
          <BrainCircuit size={14} />
          M3 · ML ENGINEERING
        </span>
      </div>
      <div className="notice ml-demo-notice">
        <FlaskConical size={20} />
        <span>
          <strong>Demonstration dataset — not measured hardware performance.</strong>
          <br />
          Synthetic validation results — not real-world benchmark accuracy. Measured uploads remain
          uploader-attested.
        </span>
      </div>
      <div className="ml-overview">
        {['CPU', 'GPU'].map((target) => {
          const m = active.find((m) => m.target === target);
          const d = datasets.data?.data.find((d) => d.id === m?.datasetId);
          return (
            <section className="panel" key={target}>
              <span className="eyebrow">ACTIVE {target} MODEL</span>
              <h2>{m ? m.algorithm : 'Not trained / inactive'}</h2>
              <span className="badge">{m ? 'READY' : 'MODEL UNAVAILABLE'}</span>
              <p>
                {d?.name ?? 'No active training dataset'}
                {m ? ` · ${m.provenance}` : ''}
              </p>
              <small>
                {m
                  ? `Trained ${new Date(m.createdAt).toLocaleString()} · version ${m.version.slice(0, 8)}`
                  : 'Train and activate a version to enable inference.'}
              </small>
            </section>
          );
        })}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {(datasets.isError || jobs.isError || models.isError) && (
        <div className="form-error" role="alert">
          Couldn’t load the ML workspace.{' '}
          <Button variant="outline" onClick={() => void client.invalidateQueries()}>
            Retry
          </Button>
        </div>
      )}
      {datasets.isPending ? (
        <div
          role="status"
          className="skeleton comparison-loading"
          aria-label="Loading ML workspace"
        />
      ) : null}
      <div className="ml-engineering-grid">
        <section className="panel ml-dataset">
          <div className="section-heading">
            <div>
              <span className="eyebrow">01 · IMMUTABLE INPUTS</span>
              <h2>
                <Database size={20} /> Dataset management
              </h2>
            </div>
            <span className="badge">cw-features-1</span>
          </div>
          <div className="field">
            <label htmlFor="dataset-name">Dataset name</label>
            <input
              id="dataset-name"
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="dataset-count">Synthetic records</label>
              <input
                id="dataset-count"
                type="number"
                min={120}
                max={5000}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              />
            </div>
            <div className="field">
              <label htmlFor="dataset-seed">Random seed</label>
              <input
                id="dataset-seed"
                type="number"
                min={0}
                max={2147483647}
                value={seed}
                onChange={(e) => setSeed(Number(e.target.value))}
              />
            </div>
          </div>
          <Button disabled={!!busy || !name.trim()} onClick={() => void createDataset('SYNTHETIC')}>
            <FlaskConical size={16} />
            {busy === 'dataset' ? 'Validating…' : 'Generate synthetic dataset'}
          </Button>
          <hr />
          <div className="field">
            <label htmlFor="dataset-csv">Upload CSV · UTF-8 · maximum 2 MB / 5,000 rows</label>
            <input
              id="dataset-csv"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                setCsv('');
                if (!f) return;
                if (f.size > 2_000_000) {
                  setError('CSV exceeds the 2 MB limit.');
                  return;
                }
                if (!f.name.toLowerCase().endsWith('.csv')) {
                  setError('Choose a CSV file.');
                  return;
                }
                void f
                  .text()
                  .then(setCsv)
                  .catch(() => setError('Could not read this file.'));
              }}
            />
            <small>
              Required unit-bearing columns and schema_version=cw-features-1. Labels must be
              MEASURED or SYNTHETIC_DEMO. Missing targets are rejected.{' '}
              <Link href="/api/ml/dataset-schema" target="_blank">
                View CSV schema
              </Link>
            </small>
          </div>
          <Button
            variant="outline"
            disabled={!!busy || !csv || !name.trim()}
            onClick={() => void createDataset('CSV')}
          >
            <Upload size={16} />
            Validate and upload CSV
          </Button>
          <div className="field">
            <label htmlFor="dataset-history">Dataset history</label>
            <select
              id="dataset-history"
              value={selectedId}
              onChange={(e) => setDatasetId(e.target.value)}
            >
              <option value="">No dataset selected</option>
              {datasets.data?.data.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} · {d.rowCount} rows · {d.provenance}
                </option>
              ))}
            </select>
          </div>
          {preview.isError ? (
            <p role="alert" className="form-error">
              Dataset preview unavailable.
            </p>
          ) : preview.data ? (
            <>
              <p className="muted">
                Schema valid · {preview.data.data.rowCount} records · {preview.data.data.version} ·{' '}
                {preview.data.data.provenance}
              </p>
              <details>
                <summary>Preview and validation policy</summary>
                <pre className="ml-code">
                  {JSON.stringify(preview.data.data.validation, null, 2)}
                </pre>
                <div className="ml-table-wrap">
                  <table className="ml-table">
                    <thead>
                      <tr>
                        <th>Workload</th>
                        <th>Hardware</th>
                        <th>CPU ms</th>
                        <th>GPU ms</th>
                        <th>Provenance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.data.data.preview?.map((r, i) => (
                        <tr key={i}>
                          <td>{String(r.workload_type)}</td>
                          <td>{String(r.hardware_id)}</td>
                          <td>{Number(r.cpu_time_ms).toPrecision(4)}</td>
                          <td>{Number(r.gpu_time_ms).toPrecision(4)}</td>
                          <td>{String(r.provenance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          ) : (
            <p className="muted">
              No dataset yet. Generate a reproducible demonstration or upload benchmark
              measurements.
            </p>
          )}
        </section>
        <section className="panel ml-training">
          <span className="eyebrow">02 · DURABLE POSTGRESQL JOBS</span>
          <h2>Model training</h2>
          <p className="muted">
            Train separate CPU and GPU regressors. Select the winner by validation RMSE; evaluate on
            held-out groups. Activation is explicit.
          </p>
          <fieldset>
            <legend>Algorithms</legend>
            {(['LINEAR', 'RANDOM_FOREST', 'XGBOOST'] as const).map((a) => (
              <label className="ml-check" key={a}>
                <input
                  type="checkbox"
                  checked={algorithms.includes(a)}
                  onChange={(e) =>
                    setAlgorithms(
                      e.target.checked ? [...algorithms, a] : algorithms.filter((v) => v !== a),
                    )
                  }
                />
                {a.replaceAll('_', ' ')}
              </label>
            ))}
          </fieldset>
          <div className="field">
            <label htmlFor="training-group">Evaluation grouping</label>
            <select id="training-group" value={group} onChange={(e) => setGroup(e.target.value)}>
              <option value="CONFIGURATION">Repeated workload / hardware configuration</option>
              <option value="WORKLOAD_FAMILY">Unseen workload families</option>
              <option value="HARDWARE">Unseen hardware configurations</option>
            </select>
            <small>
              At least six groups required. No optimistic random-split fallback. Uses the selected
              dataset and seed above.
            </small>
          </div>
          <Button
            disabled={!!busy || running || !selectedId || !algorithms.length}
            onClick={() =>
              void action('train', async () => {
                await apiData('/api/ml/training-jobs', jobResponseSchema, {
                  method: 'POST',
                  body: JSON.stringify({
                    datasetId: selectedId,
                    algorithms,
                    seed,
                    group_by: group,
                  }),
                });
                await client.invalidateQueries({ queryKey: ['ml-jobs'] });
                setMessage(
                  'Training job queued. The dedicated worker will fit the selected algorithms.',
                );
              })
            }
          >
            <Play size={16} />
            {running ? 'Training in progress…' : 'Start training'}
          </Button>
          <div className="ml-job-list">
            {jobs.data?.data.map((j) => (
              <article key={j.id} className="ml-job">
                <div>
                  <strong>{j.status}</strong>
                  <small>{new Date(j.createdAt).toLocaleString()}</small>
                </div>
                {['QUEUED', 'RUNNING'].includes(j.status) && (
                  <progress aria-label="Training job progress" />
                )}
                {j.error && (
                  <p className="form-error" role="alert">
                    {j.error}
                  </p>
                )}
                <p className="muted">
                  {j.modelIds.length} fitted artifacts · {j.id.slice(0, 12)}
                </p>
                <details>
                  <summary>Training logs</summary>
                  <pre className="ml-code">{j.logs.join('\n') || 'Waiting for worker…'}</pre>
                </details>
              </article>
            )) ?? null}
            {!jobs.data?.data.length && <p className="muted">No training jobs yet.</p>}
          </div>
        </section>
      </div>
      <section className="panel ml-registry">
        <div className="section-heading">
          <div>
            <span className="eyebrow">03 · TRUSTED ARTIFACTS</span>
            <h2>Model registry & version history</h2>
          </div>
          <Button variant="outline" onClick={() => void models.refetch()}>
            Refresh models
          </Button>
        </div>
        {!models.data?.data.length ? (
          <p className="muted">
            No fitted model versions. Completed training jobs create trusted Joblib artifacts;
            failed jobs never activate models.
          </p>
        ) : (
          <div className="ml-table-wrap">
            <table className="ml-table">
              <thead>
                <tr>
                  <th>Target / algorithm</th>
                  <th>Version / dataset</th>
                  <th>Validation RMSE ms</th>
                  <th>State</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {models.data.data.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <strong>
                        {m.target} · {m.algorithm}
                      </strong>
                      {m.selected && <small>Validation winner</small>}
                    </td>
                    <td>
                      <code>{m.version.slice(0, 8)}</code>
                      <small>{m.provenance}</small>
                    </td>
                    <td>{m.evaluation.validation.rmseMs.toPrecision(4)}</td>
                    <td>{m.active ? 'ACTIVE' : m.status}</td>
                    <td>
                      <div className="ml-actions">
                        <Button variant="ghost" onClick={() => setModelId(m.id)}>
                          Evaluate {m.target}
                        </Button>
                        <Button
                          variant="outline"
                          disabled={!!busy}
                          onClick={() =>
                            void action('activate', async () => {
                              await apiData(
                                `/api/ml/models/${m.id}/activate`,
                                modelResponseSchema,
                                { method: 'POST', body: JSON.stringify({ active: !m.active }) },
                              );
                              await client.invalidateQueries({ queryKey: ['ml-models'] });
                              setMessage(
                                `${m.target} model ${m.active ? 'deactivated' : 'activated'}.`,
                              );
                            })
                          }
                        >
                          {m.active ? 'Deactivate' : 'Activate'} {m.target}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {chosen && <Evaluation model={chosen} models={models.data?.data ?? []} />}
      <PredictionPlayground user={user} />
    </div>
  );
}
