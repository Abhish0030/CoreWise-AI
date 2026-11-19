'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FlaskConical, Link2, Play, Download, ShieldCheck } from 'lucide-react';
import {
  agentListSchema,
  benchmarkConfigSchema,
  benchmarkLimits,
  benchmarkJobListSchema,
  benchmarkJobResponseSchema,
  benchmarkRunListSchema,
  pairCodeSchema,
  z,
  type CurrentUser,
  type BenchmarkConfig,
} from '@corewise/types';
import { apiData, apiRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { MeasuredResult } from './measured-result';
const exportResult = z.object({
  data: z.object({
    csv: z.string(),
    rowCount: z.number(),
    excluded: z.array(z.object({ runId: z.string(), reason: z.string() })),
    trainingReady: z.boolean(),
  }),
});
const datasetCreated = z.object({ data: z.object({ id: z.string(), rowCount: z.number() }) });
const featureFields = [
  ['cpu_gflops', 'CPU effective throughput (GFLOP/s)'],
  ['cpu_bandwidth_gbps', 'CPU bandwidth (GB/s)'],
  ['gpu_gflops', 'GPU effective throughput (GFLOP/s)'],
  ['gpu_bandwidth_gbps', 'GPU bandwidth (GB/s)'],
  ['transfer_bandwidth_gbps', 'Host–device bandwidth (GB/s)'],
  ['launch_overhead_us', 'Launch overhead (µs)'],
  ['parallel_fraction', 'Offloadable fraction (0–1)'],
] as const;
export function BenchmarkLab({ user }: { user: CurrentUser }) {
  const client = useQueryClient();
  const agents = useQuery({
    queryKey: ['benchmark-agents', user.id],
    queryFn: () => apiData('/api/benchmarks/agents', agentListSchema),
    refetchInterval: 10000,
  });
  const jobs = useQuery({
    queryKey: ['benchmark-jobs', user.id],
    queryFn: () => apiData('/api/benchmarks/jobs', benchmarkJobListSchema),
    refetchInterval: (q) =>
      q.state.data?.data.some((j) => ['QUEUED', 'RUNNING', 'CANCEL_REQUESTED'].includes(j.status))
        ? 2000
        : false,
  });
  const history = useQuery({
    queryKey: ['benchmark-runs', user.id],
    queryFn: () => apiData('/api/benchmarks/runs', benchmarkRunListSchema),
    refetchInterval: 5000,
  });
  const [agentId, setAgentId] = useState(''),
    [runId, setRunId] = useState(''),
    [pairCode, setPairCode] = useState<{ code: string; expiresAt: string } | null>(null),
    [busy, setBusy] = useState(''),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const [config, setConfig] = useState<BenchmarkConfig>({
    workload: 'VECTOR_ADDITION',
    size: 100000,
    dtype: 'float32',
    warmups: 2,
    repetitions: 5,
    seed: 42,
    threads: 1,
    gpu: true,
    scope: 'END_TO_END',
    timeoutSeconds: 60,
  });
  const [caps, setCaps] = useState<Record<string, string>>({ source: '' }),
    [selectedRuns, setSelectedRuns] = useState<string[]>([]);
  const selectedAgentId = agentId || agents.data?.data.find((a) => !a.revokedAt)?.id || '';
  const agent = agents.data?.data.find((a) => a.id === selectedAgentId);
  const run = history.data?.data.find((r) => r.id === runId) ?? history.data?.data[0];
  const pending = jobs.data?.data.some(
    (j) =>
      j.agentId === selectedAgentId && ['QUEUED', 'RUNNING', 'CANCEL_REQUESTED'].includes(j.status),
  );
  async function action(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError('');
    setMessage('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Benchmark request failed.');
    } finally {
      setBusy('');
    }
  }
  async function refresh() {
    await Promise.all(
      ['benchmark-agents', 'benchmark-jobs', 'benchmark-runs'].map((key) =>
        client.invalidateQueries({ queryKey: [key] }),
      ),
    );
  }
  function download(content: string) {
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'corewise-measured-ml-v1.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
  function exportInput() {
    return {
      runIds: selectedRuns,
      capabilities: Object.fromEntries([
        ...featureFields.map(([key]) => [key, caps[key]?.trim() ? Number(caps[key]) : null]),
        ['source', caps.source ?? ''],
      ]),
    };
  }
  return (
    <div className="dashboard benchmark-workspace">
      <div className="page-heading">
        <div>
          <div className="eyebrow">REAL EXECUTION. TRACEABLE EVIDENCE.</div>
          <h1>
            Benchmark Lab<span className="title-dot">.</span>
          </h1>
          <p>Bounded local CPU/GPU measurements, raw samples, and reproducible environments.</p>
        </div>
        <span className="badge">
          <FlaskConical size={14} />
          M4 · MEASURED
        </span>
      </div>
      <div className="notice">
        <ShieldCheck size={18} />
        <span>
          Benchmarks run only after explicit action on your paired device. No browser hardware
          detection, automatic stress tests, or power/clock controls.
        </span>
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
      {(agents.isError || jobs.isError || history.isError) && (
        <div className="form-error" role="alert">
          Couldn’t load benchmark data.{' '}
          <Button variant="outline" onClick={() => void refresh()}>
            Retry
          </Button>
        </div>
      )}
      <div className="ml-engineering-grid">
        <section className="panel">
          <span className="eyebrow">01 · OUTBOUND-ONLY RUNNER</span>
          <h2>
            <Link2 size={19} /> Hardware connection
          </h2>
          <p className="muted">
            Install the local Python environment, generate a one-time code, then pair from a trusted
            device. Long-lived credentials stay in the OS vault.
          </p>
          <Button
            disabled={!!busy}
            onClick={() =>
              void action('pair', async () => {
                const p = await apiData('/api/benchmarks/pairing', pairCodeSchema, {
                  method: 'POST',
                  body: '{}',
                });
                setPairCode(p.data);
              })
            }
          >
            Generate pairing code
          </Button>
          {pairCode && (
            <div className="benchmark-pair">
              <label htmlFor="pair-code">
                One-time pairing code · expires {new Date(pairCode.expiresAt).toLocaleTimeString()}
              </label>
              <input id="pair-code" readOnly value={pairCode.code} />
              <small>Paste only into the trusted runner’s hidden prompt.</small>
              <Button variant="ghost" onClick={() => setPairCode(null)}>
                Hide code
              </Button>
            </div>
          )}
          <pre className="ml-code">
            {
              'pnpm agent pair --url http://127.0.0.1:4000\n# Paste code at hidden prompt\n# After queuing a job:\npnpm agent run --execute'
            }
          </pre>
          <div className="field">
            <label htmlFor="benchmark-agent">Paired device</label>
            <select
              id="benchmark-agent"
              value={selectedAgentId}
              onChange={(e) => setAgentId(e.target.value)}
            >
              <option value="">Choose a paired runner…</option>
              {agents.data?.data.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.revokedAt ? ' · Revoked' : ''}
                </option>
              ))}
            </select>
          </div>
          {agents.isPending ? (
            <div
              role="status"
              className="skeleton comparison-loading"
              aria-label="Loading paired devices"
            />
          ) : agent ? (
            <>
              <span className="badge">
                {agent.revokedAt ? 'REVOKED' : 'PAIRED · EXPLICIT RUN REQUIRED'}
              </span>
              <dl className="benchmark-detection">
                <dt>CPU · DETECTED</dt>
                <dd>
                  {agent.environment.cpuModel ?? 'Unknown CPU'} ·{' '}
                  {agent.environment.physicalCores ?? '?'} physical /{' '}
                  {agent.environment.logicalCpus ?? '?'} logical
                </dd>
                <dt>RAM / OS · DETECTED</dt>
                <dd>
                  {(agent.environment.totalRamBytes / 2 ** 30).toFixed(1)} GiB ·{' '}
                  {agent.environment.os}
                </dd>
                <dt>GPU runtime</dt>
                <dd>
                  {agent.environment.gpuRuntime
                    ? `${agent.environment.gpuRuntime.model} · CuPy ${agent.environment.gpuRuntime.version}`
                    : (agent.environment.gpuUnavailableReason ?? 'Unavailable')}
                </dd>
                <dt>Last contact</dt>
                <dd>
                  {agent.lastSeenAt
                    ? new Date(agent.lastSeenAt).toLocaleString()
                    : 'No contact yet'}
                </dd>
              </dl>
              <Button
                variant="outline"
                disabled={!!busy || !!agent.revokedAt}
                onClick={() =>
                  void action('revoke', async () => {
                    await apiRequest(`/api/benchmarks/agents/${agent.id}/revoke`, {
                      method: 'POST',
                      body: '{}',
                    });
                    await refresh();
                  })
                }
              >
                Revoke runner
              </Button>
            </>
          ) : (
            <p className="muted">
              No paired devices. Hardware stays unknown until the local runner reports it.
            </p>
          )}
        </section>
        <section className="panel">
          <span className="eyebrow">02 · ALLOWLISTED & BOUNDED</span>
          <h2>Benchmark configuration</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void action('start', async () => {
                const parsed = benchmarkConfigSchema.safeParse(config);
                if (!parsed.success)
                  throw Error(parsed.error.issues.map((i) => i.message).join(' '));
                await apiData('/api/benchmarks/jobs', benchmarkJobResponseSchema, {
                  method: 'POST',
                  body: JSON.stringify({ agentId: selectedAgentId, config: parsed.data }),
                });
                await refresh();
                setMessage(
                  'Job queued. On your device run: pnpm agent run --execute. Nothing starts automatically.',
                );
              });
            }}
          >
            <div className="form-grid">
              <div className="field">
                <label htmlFor="benchmark-workload">Benchmark workload</label>
                <select
                  id="benchmark-workload"
                  value={config.workload}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      workload: e.target.value as BenchmarkConfig['workload'],
                      size: e.target.value === 'MATRIX_MULTIPLICATION' ? 128 : 100000,
                    })
                  }
                >
                  {Object.keys(benchmarkLimits).map((k) => (
                    <option key={k} value={k}>
                      {k.replaceAll('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="benchmark-size">
                  Input size{' '}
                  {config.workload === 'MATRIX_MULTIPLICATION'
                    ? '(square dimension)'
                    : '(elements)'}
                </label>
                <input
                  id="benchmark-size"
                  type="number"
                  min={16}
                  max={benchmarkLimits[config.workload]}
                  required
                  value={config.size}
                  onChange={(e) => setConfig({ ...config, size: Number(e.target.value) })}
                />
                <small>Maximum {benchmarkLimits[config.workload].toLocaleString()}.</small>
              </div>
              <div className="field">
                <label htmlFor="benchmark-dtype">Data type</label>
                <select
                  id="benchmark-dtype"
                  value={config.dtype}
                  onChange={(e) =>
                    setConfig({ ...config, dtype: e.target.value as BenchmarkConfig['dtype'] })
                  }
                >
                  <option value="float32">float32 · FP32</option>
                  <option value="float64">float64 · FP64</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="benchmark-scope">Timing scope</label>
                <select
                  id="benchmark-scope"
                  value={config.scope}
                  onChange={(e) =>
                    setConfig({ ...config, scope: e.target.value as BenchmarkConfig['scope'] })
                  }
                >
                  <option value="END_TO_END">End-to-end · GPU includes transfers</option>
                  <option value="COMPUTE_ONLY">Compute only · arrays resident</option>
                </select>
              </div>
              {(
                [
                  ['warmups', 'Warm-up runs', 1, 5],
                  ['repetitions', 'Measurement repetitions', 3, 30],
                  ['threads', 'BLAS threads', 1, 16],
                  ['seed', 'Input random seed', 0, 2147483647],
                  ['timeoutSeconds', 'Execution timeout (seconds)', 5, 120],
                ] as const
              ).map(([key, label, min, max]) => (
                <div className="field" key={key}>
                  <label htmlFor={`bench-${key}`}>{label}</label>
                  <input
                    id={`bench-${key}`}
                    type="number"
                    min={min}
                    max={max}
                    required
                    value={config[key]}
                    onChange={(e) => setConfig({ ...config, [key]: Number(e.target.value) })}
                  />
                </div>
              ))}
            </div>
            <label className="ml-check">
              <input
                type="checkbox"
                checked={config.gpu}
                onChange={(e) => setConfig({ ...config, gpu: e.target.checked })}
              />
              Measure GPU when supported
            </label>
            <p className="muted">
              CPU operations use resident host arrays. GPU end-to-end includes transfers and
              allocation. Setup/input generation is excluded. Sorting compares library
              implementations whose algorithms may differ.
            </p>
            <Button disabled={!!busy || !selectedAgentId || !!agent?.revokedAt || pending}>
              <Play size={15} />
              Queue benchmark
            </Button>
          </form>
        </section>
      </div>
      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">03 · EXECUTION</span>
            <h2>Jobs & progress</h2>
          </div>
          <Button variant="outline" onClick={() => void refresh()}>
            Refresh benchmark data
          </Button>
        </div>
        {jobs.isPending ? (
          <div className="skeleton comparison-loading" />
        ) : !jobs.data?.data.length ? (
          <p className="muted">
            No benchmark jobs yet. Pair a device and explicitly queue a workload.
          </p>
        ) : (
          <div className="benchmark-jobs">
            {jobs.data.data.map((j) => (
              <article className="ml-job" key={j.id}>
                <div>
                  <strong>
                    {j.config.workload.replaceAll('_', ' ')} · {j.config.size.toLocaleString()}
                  </strong>
                  <span className="badge">{j.status}</span>
                </div>
                <p className="muted">
                  {j.config.dtype} · {j.config.scope} · {j.config.repetitions} samples ·{' '}
                  {new Date(j.createdAt).toLocaleString()}
                </p>
                {j.status === 'RUNNING' && <progress aria-label="Benchmark execution progress" />}
                {j.status === 'QUEUED' && (
                  <p className="muted">Waiting for explicit local runner execution.</p>
                )}
                {j.error && <p className="form-error">{j.error}</p>}
                {['QUEUED', 'RUNNING'].includes(j.status) && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      void action('cancel', async () => {
                        await apiRequest(`/api/benchmarks/jobs/${j.id}/cancel`, {
                          method: 'POST',
                          body: '{}',
                        });
                        await refresh();
                      })
                    }
                  >
                    Cancel benchmark
                  </Button>
                )}
                {j.runId && (
                  <Button variant="ghost" onClick={() => setRunId(j.runId!)}>
                    View measured result
                  </Button>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">04 · IMMUTABLE MEASUREMENTS</span>
            <h2>Results & history</h2>
          </div>
          <Button asChild variant="outline">
            <a href="/api/benchmarks/export.csv">
              <Download size={15} />
              Export raw CSV
            </a>
          </Button>
        </div>
        {!history.data?.data.length ? (
          <p className="muted">
            No measured results yet. CPU-only runs are preserved; unavailable GPU targets stay
            blank.
          </p>
        ) : (
          <>
            <div className="field">
              <label htmlFor="benchmark-history">Benchmark history</label>
              <select
                id="benchmark-history"
                value={run?.id ?? ''}
                onChange={(e) => setRunId(e.target.value)}
              >
                {history.data.data.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.measurement.config.workload} · {r.measurement.config.size} ·{' '}
                    {r.valid ? 'VALID' : 'INVALID'} · {new Date(r.createdAt).toLocaleString()}
                  </option>
                ))}
              </select>
            </div>
            {run && <MeasuredResult measurement={run.measurement} />}
            <div className="ml-chart" role="img" aria-label="Measured execution time by input size">
              <h3>Time by input size · same runner/workload/type/scope</h3>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart
                  data={history.data.data
                    .filter(
                      (r) =>
                        r.valid &&
                        r.measurement.config.workload === run?.measurement.config.workload &&
                        r.measurement.config.scope === run?.measurement.config.scope &&
                        r.measurement.config.dtype === run?.measurement.config.dtype &&
                        r.agentId === run?.agentId,
                    )
                    .map((r) => ({
                      size: r.measurement.config.size,
                      cpu: r.measurement.cpu.summary.medianMs,
                      gpu: r.measurement.gpu?.summary.medianMs ?? null,
                    }))
                    .sort((a, b) => a.size - b.size)}
                >
                  <CartesianGrid stroke="var(--border)" />
                  <XAxis dataKey="size" />
                  <YAxis width={55} />
                  <Tooltip />
                  <Line dataKey="cpu" stroke="var(--accent-primary)" isAnimationActive={false} />
                  <Line
                    dataKey="gpu"
                    stroke="var(--accent-secondary)"
                    isAnimationActive={false}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </section>
      <section className="panel">
        <span className="eyebrow">05 · EXPLICIT DATASET FEATURES</span>
        <h2>M3 dataset collection</h2>
        <p className="muted">
          Select valid paired end-to-end runs. Supply unknown capabilities from an external source;
          no throughput or bandwidth is inferred from these target times. CPU-only measurements
          remain in raw CSV history. M3 needs at least 60 samples and six distinct evaluation groups
          for training.
        </p>
        <div className="benchmark-run-selection">
          {history.data?.data.map((r) => (
            <label className="ml-check" key={r.id}>
              <input
                type="checkbox"
                checked={selectedRuns.includes(r.id)}
                onChange={(e) =>
                  setSelectedRuns(
                    e.target.checked
                      ? [...selectedRuns, r.id]
                      : selectedRuns.filter((x) => x !== r.id),
                  )
                }
              />
              {r.measurement.config.workload} · {r.measurement.config.size} ·{' '}
              {r.valid ? 'Valid' : 'Invalid'} · {r.measurement.gpu ? 'CPU + GPU' : 'CPU only'}
            </label>
          ))}
        </div>
        <div className="form-grid">
          {featureFields.map(([key, label]) => (
            <div className="field" key={key}>
              <label htmlFor={`export-${key}`}>{label}</label>
              <input
                id={`export-${key}`}
                type="number"
                min={0}
                step="any"
                value={caps[key] ?? ''}
                placeholder="Unknown — supply source"
                onChange={(e) => setCaps({ ...caps, [key]: e.target.value })}
              />
            </div>
          ))}
          <div className="field">
            <label htmlFor="capability-source">Capability source / calibration reference</label>
            <input
              id="capability-source"
              value={caps.source}
              maxLength={500}
              onChange={(e) => setCaps({ ...caps, source: e.target.value })}
            />
            <small>USER_ENTERED capability metadata; target times remain MEASURED.</small>
          </div>
        </div>
        <div className="ml-actions">
          <Button
            variant="outline"
            disabled={!!busy || !selectedRuns.length}
            onClick={() =>
              void action('export', async () => {
                const r = await apiData('/api/benchmarks/export-dataset', exportResult, {
                  method: 'POST',
                  body: JSON.stringify(exportInput()),
                });
                setMessage(
                  `${r.data.rowCount} eligible samples. ${r.data.excluded.map((e) => e.reason).join('; ')}`,
                );
                if (r.data.csv) download(r.data.csv);
              })
            }
          >
            Export ML-compatible CSV
          </Button>
          <Button
            disabled={!!busy || !selectedRuns.length}
            onClick={() =>
              void action('dataset', async () => {
                const r = await apiData('/api/benchmarks/datasets', datasetCreated, {
                  method: 'POST',
                  body: JSON.stringify(exportInput()),
                });
                setMessage(
                  `Measured dataset saved: ${r.data.rowCount} rows. Select it in ML Predictions; grouped evaluation requirements still apply.`,
                );
                await client.invalidateQueries({ queryKey: ['ml-datasets'] });
              })
            }
          >
            Save measured dataset
          </Button>
        </div>
        <p className="muted">
          <Link href="/ml-predictions">Open ML Predictions →</Link> Synthetic and measured datasets
          remain separate.
        </p>
      </section>
    </div>
  );
}
