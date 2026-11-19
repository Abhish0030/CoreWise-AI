'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  agentListSchema,
  connectionSchema,
  hardwareListSchema,
  hardwareResponseSchema,
  workloadListSchema,
  benchmarkRunListSchema,
  benchmarkJobResponseSchema,
  pairCodeSchema,
  optimizationResponseSchema,
  type CurrentUser,
  type OptimizationData,
  benchmarkLimits,
} from '@corewise/types';
import { apiData, apiRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/use-auth';
import { observedTime } from '@/lib/observed-time';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
export function FunctionalJourney({ user }: { user: CurrentUser }) {
  const auth = useAuth(user),
    client = useQueryClient();
  const [pairCode, setPairCode] = useState('');
  const pairingBaseline = useRef<string[] | null>(null);
  const hardware = useQuery({
    queryKey: ['hardware-profiles', user.id],
    queryFn: () => apiData('/api/hardware-profiles', hardwareListSchema),
  });
  const agents = useQuery({
    queryKey: ['benchmark-agents', user.id],
    queryFn: () => apiData('/api/benchmarks/agents', agentListSchema),
    refetchInterval: pairCode ? 3000 : false,
  });
  const connection = useQuery({
    queryKey: ['hardware-connection', user.id],
    queryFn: () => apiData('/api/hardware/connection', connectionSchema),
    refetchInterval: 5000,
    retry: false,
  });
  const workloads = useQuery({
    queryKey: ['workloads', user.id],
    queryFn: () => apiData('/api/workloads', workloadListSchema),
  });
  const runs = useQuery({
    queryKey: ['benchmark-runs', user.id],
    queryFn: () => apiData('/api/benchmarks/runs', benchmarkRunListSchema),
  });
  const [workloadId, setWorkloadId] = useState(''),
    [agentId, setAgentId] = useState(''),
    [benchmarkId, setBenchmarkId] = useState(''),
    [result, setResult] = useState<OptimizationData | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  useEffect(() => {
    if (!pairCode) return;
    const timeout = window.setTimeout(() => setPairCode(''), 600000);
    return () => window.clearTimeout(timeout);
  }, [pairCode]);
  useEffect(() => {
    if (!pairCode || !pairingBaseline.current || !agents.data) return;
    const paired = agents.data.data.find((a) => !pairingBaseline.current!.includes(a.id));
    if (!paired) return;
    setPairCode('');
    setAgentId(paired.id);
    setNotice(
      'Device paired. The current native agent creates and selects its detected profile. Monitoring starts only with your explicit local command.',
    );
    void client.invalidateQueries({ queryKey: ['current-user'] });
    void client.invalidateQueries({ queryKey: ['hardware-profiles', user.id] });
    void client.invalidateQueries({ queryKey: ['hardware-connection', user.id] });
  }, [agents.data, pairCode, client, user.id]);
  const profile = hardware.data?.data.find(
    (p) => p.id === (auth.data?.selectedProfileId ?? auth.data?.defaultProfileId),
  );
  const profilePending =
    !!(auth.data?.selectedProfileId ?? auth.data?.defaultProfileId) && hardware.isPending;
  const selectedAgent =
    agentId ||
    connection.data?.data.selectedAgentId ||
    agents.data?.data.find(
      (a) =>
        !a.revokedAt &&
        connection.data?.data.agents.some((c) => c.id === a.id && c.status !== 'EXPIRED'),
    )?.id ||
    '';
  const workload = workloads.data?.data.find(
    (w) => w.id === (workloadId || workloads.data?.data[0]?.id),
  );
  async function action(fn: () => Promise<void>) {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed.');
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['current-user'] }),
      client.invalidateQueries({ queryKey: ['hardware-profiles', user.id] }),
      client.invalidateQueries({ queryKey: ['benchmark-agents', user.id] }),
      client.invalidateQueries({ queryKey: ['hardware-connection', user.id] }),
    ]);
  }
  const match = connection.data?.data.agents.find(
    (a) => a.id === connection.data?.data.selectedAgentId,
  );
  const time = (n: number | null | undefined) =>
    n == null ? 'Unavailable' : `${n.toPrecision(5)} ms`;
  return (
    <section className="panel functional-journey" aria-label="Workload prediction journey">
      <div className="section-heading">
        <div>
          <span className="eyebrow">DETECT → PREDICT → VERIFY</span>
          <h2>Your compute decision</h2>
        </div>
        <span className="badge">EVIDENCE FIRST</span>
      </div>
      <div className="journey-steps">
        <section>
          <h3>1. Connect hardware</h3>
          <p>
            {profile
              ? `Selected: ${profile.name} · ${profile.provenance}`
              : profilePending
                ? 'Loading selected hardware…'
                : 'No selected hardware. Import your paired runner or create a reviewed manual profile.'}
          </p>
          <label className="field">
            Local runner
            <select
              value={selectedAgent}
              onChange={(e) => {
                const id = e.target.value;
                setAgentId(id);
                setResult(null);
                const imported = hardware.data?.data.find(
                  (p) => (p.detectionSnapshot as { agentId?: string } | null)?.agentId === id,
                );
                if (imported)
                  void action(async () => {
                    await apiRequest(`/api/hardware-profiles/${imported.id}/select`, {
                      method: 'POST',
                    });
                    await refresh();
                  });
              }}
            >
              <option value="">No paired runner</option>
              {agents.data?.data
                .filter(
                  (a) =>
                    !a.revokedAt &&
                    connection.data?.data.agents.some(
                      (c) => c.id === a.id && c.status !== 'EXPIRED',
                    ),
                )
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </label>
          <div className="report-actions">
            <Button
              disabled={busy || !selectedAgent}
              onClick={() =>
                void action(async () => {
                  await apiData('/api/hardware/import-hardware', hardwareResponseSchema, {
                    method: 'POST',
                    body: JSON.stringify({
                      agentId: selectedAgent,
                      name: 'Detected local workstation',
                      setDefault: true,
                    }),
                  });
                  setResult(null);
                  await refresh();
                  setNotice(
                    'Detected hardware imported and selected. Unknown capabilities remain blank.',
                  );
                })
              }
            >
              Import detected hardware
            </Button>
            <Link href="/hardware-library">Create or select a profile →</Link>
          </div>
          <details open={!agents.data?.data.some((a) => !a.revokedAt)}>
            <summary>Pair a runner and sample telemetry</summary>
            <h4>Connect this computer</h4>
            <p>
              Real hardware access requires the Windows local agent on the computer you approve.
              Generate your account&apos;s one-time code, then enter it in the native prompt.
              Pairing creates and selects your own detected hardware profile. It does not start
              monitoring or benchmarks. Each paired computer keeps its own device ID.
            </p>
            <pre>
              py -3.13 -m venv backend/local-agent/.venv{'\n'}
              backend/local-agent/.venv/Scripts/python.exe -m pip install -r
              backend/local-agent/requirements.txt
            </pre>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  pairingBaseline.current = agents.data?.data.map((a) => a.id) ?? [];
                  const r = await apiData('/api/benchmarks/pairing', pairCodeSchema, {
                    method: 'POST',
                    body: '{}',
                  });
                  setPairCode(r.data.code);
                })
              }
            >
              {agents.data?.data.some((a) => !a.revokedAt)
                ? 'Generate runner pairing code'
                : 'Connect this computer'}
            </Button>
            {pairCode && (
              <p className="pairing-code">
                One-time code: <code>{pairCode}</code>
              </p>
            )}
            <pre>
              pnpm agent pair --url http://127.0.0.1:4000{'\n'}pnpm agent monitor --samples 30
              --interval 2{'\n'}pnpm telemetry:continuous
            </pre>
            <p>
              Codes expire in ten minutes and work once. Continuous monitoring runs until Ctrl+C;
              the bounded command stops automatically. Use --agent-id with the monitor command to
              choose another saved pairing. Unsupported readings stay unknown. Remote backends
              require their actual HTTPS origin, replacing the loopback URL above.
            </p>
            <Button variant="outline" onClick={() => void refresh()}>
              Refresh runner connection
            </Button>
          </details>
          <p className="muted">
            {connection.isError
              ? 'Connection status unavailable.'
              : match
                ? `Telemetry: ${match.status} · ${match.receivedAt ? observedTime(match.receivedAt) : 'no sample received'}`
                : agents.data?.data.some((a) => !a.revokedAt)
                  ? 'Device connected, monitoring stopped or no profile selected.'
                  : 'Device not connected. Connect this computer to begin.'}
          </p>
        </section>
        <section>
          <h3>2. Select workload</h3>
          <label className="field">
            Active workload
            <select
              value={workload?.id ?? ''}
              onChange={(e) => {
                setWorkloadId(e.target.value);
                setResult(null);
              }}
            >
              <option value="">No saved workload</option>
              {workloads.data?.data.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
          <p>
            {workload
              ? `${workload.category} · ${workload.inputSize} ${workload.inputUnit} · ${workload.assumptions.precision}`
              : 'Save a workload with explicit units and capability sources. GHz is not a throughput estimate.'}
          </p>
          <Link href="/workload-analyzer">Configure workload and assumptions →</Link>
          <div className="report-actions">
            <Button
              disabled={busy || !profile || !workload}
              onClick={() =>
                void action(async () => {
                  const r = await apiData('/api/optimization/run', optimizationResponseSchema, {
                    method: 'POST',
                    body: JSON.stringify({
                      workloadId: workload!.id,
                      hardwareProfileId: profile!.id,
                      ...(benchmarkId ? { benchmarkId } : {}),
                    }),
                  });
                  setResult(r.data);
                  setNotice(
                    'Decision saved with its available evidence. Missing ML inputs are shown below.',
                  );
                  await client.invalidateQueries({ queryKey: ['workspace-summary', user.id] });
                })
              }
            >
              {busy ? 'Analyzing…' : 'Predict and recommend'}
            </Button>
          </div>
          <p className="muted">
            Uses exact owned ML versions when compatible; otherwise shows the analytical result and
            exact missing requirements.
          </p>
        </section>
        <section>
          <h3>3. Measure and compare</h3>
          <p>
            Benchmarking needs a separate explicit local execution. The browser only queues the
            bounded job.
          </p>
          <Button
            variant="outline"
            disabled={
              busy ||
              !selectedAgent ||
              !workload ||
              !(workload.category in benchmarkLimits) ||
              workload.inputSize >
                (benchmarkLimits[workload.category as keyof typeof benchmarkLimits] ?? 0) ||
              workload.inputSize < 16 ||
              !Number.isInteger(workload.inputSize)
            }
            onClick={() =>
              void action(async () => {
                await apiData('/api/benchmarks/jobs', benchmarkJobResponseSchema, {
                  method: 'POST',
                  body: JSON.stringify({
                    agentId: selectedAgent,
                    config: {
                      workload: workload!.category,
                      size: workload!.inputSize,
                      dtype: workload!.assumptions.precision === 'FP64' ? 'float64' : 'float32',
                      threads: 1,
                      repetitions: 5,
                      warmups: 2,
                      scope: 'END_TO_END',
                      gpu: true,
                      seed: 42,
                      timeoutSeconds: 30,
                    },
                  }),
                });
                setNotice(
                  'Queued only. Run pnpm agent run --execute locally, then refresh measurements.',
                );
              })
            }
          >
            Queue bounded benchmark
          </Button>
          <pre>pnpm agent run --execute</pre>
          <p className="muted">
            One CPU thread; 5 repetitions; 30-second deadline. Stable-sort FLOP-equivalent workloads
            use float32 in this quick action; other data types/scopes are available in Benchmark
            Lab.
          </p>
          <label className="field">
            Measured run
            <select value={benchmarkId} onChange={(e) => setBenchmarkId(e.target.value)}>
              <option value="">Automatically match compatible evidence</option>
              {runs.data?.data.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.measurement.config.workload} · {r.measurement.config.size} ·{' '}
                  {r.measurement.config.dtype} · {r.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>
          <Button variant="outline" onClick={() => void runs.refetch()}>
            Refresh measurements
          </Button>
          <Link href="/benchmark-lab">Raw samples, scopes and collection →</Link>
        </section>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {result && (
        <div className="journey-result" data-testid="optimization-result">
          <div className="section-heading">
            <h3>
              {result.recommendation.recommendation === 'INSUFFICIENT_DATA'
                ? 'More evidence required'
                : `${result.recommendation.recommendation} recommendation`}
            </h3>
            <span className="badge">{result.recommendation.basis}</span>
          </div>
          <div className="journey-times">
            <p>
              CPU <strong>{time(result.recommendation.cpuMs)}</strong>
            </p>
            <p>
              GPU <strong>{time(result.recommendation.gpuMs)}</strong>
            </p>
            <p>
              CPU/GPU time ratio{' '}
              <strong>{result.recommendation.speedup?.toPrecision(4) ?? 'Unavailable'}×</strong>
            </p>
          </div>
          <p>
            {result.recommendation.validated
              ? 'Supported by an exact compatible measurement for this configuration.'
              : 'Estimated benefit only; not proven by a compatible measurement.'}
          </p>
          <p>ML: {result.readiness.ml.ready ? 'Compatible prediction available' : 'Not ready'}</p>
          {result.readiness.ml.reasons.map((n) => (
            <p key={n} className="notice">
              {n}
            </p>
          ))}
          {result.readiness.analytical.missing.length > 0 && (
            <p>
              Analytical requirements: {result.readiness.analytical.missing.join(', ')}.{' '}
              <Link href="/cpu-vs-gpu">Review inputs →</Link>
            </p>
          )}
          {result.mlPrediction && (
            <p>
              Predicted CPU {time(result.mlPrediction.cpuTimeMs)} · GPU{' '}
              {time(result.mlPrediction.gpuTimeMs)} · versions{' '}
              {result.mlPrediction.models.CPU.version} / {result.mlPrediction.models.GPU.version}.
              Training: {result.mlPrediction.models.CPU.datasetProvenance} /{' '}
              {result.mlPrediction.models.GPU.datasetProvenance}.
            </p>
          )}
          {result.comparison && (
            <p>
              Measured CPU {time(result.comparison.cpuMeasuredMs)} · GPU{' '}
              {time(result.comparison.gpuMeasuredMs)}. Signed prediction errors: CPU{' '}
              {result.comparison.cpuErrorPercent?.toFixed(2) ?? 'unavailable'}%, GPU{' '}
              {result.comparison.gpuErrorPercent?.toFixed(2) ?? 'unavailable'}%. One point is not
              held-out model evaluation.
            </p>
          )}
          {result.compatibility.map((n) => (
            <p key={n} className="notice">
              {n}
            </p>
          ))}
          <h4>Transfer and launch overhead</h4>
          <p>
            {result.analytical.gpu
              ? `${time(result.analytical.gpu.transferSeconds * 1000)} transfer + ${time(result.analytical.gpu.launchSeconds * 1000)} launch across the configured invocation(s). Reuse/batching would require separate measurements.`
              : 'Supply transfer/launch capabilities for this calculation.'}
          </p>
          <h4>Workload-size crossover — ANALYTICAL</h4>
          <p>
            {result.crossover.brackets.length
              ? result.crossover.brackets
                  .map(
                    (b) => `Crossing bracket ${b.lowerSize}–${b.upperSize} ${workload?.inputUnit}`,
                  )
                  .join('; ')
              : 'No supported crossover bracket found in the sampled sizes.'}
          </p>
          <div
            className="journey-chart"
            role="img"
            aria-label="Analytical CPU and GPU times across workload sizes"
          >
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={result.crossover.points}>
                <CartesianGrid stroke="var(--border)" />
                <XAxis dataKey="size" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                <YAxis unit=" ms" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                />
                <Line
                  type="linear"
                  dataKey="cpuMs"
                  name="CPU (ms)"
                  stroke="var(--accent-primary)"
                  connectNulls={false}
                />
                <Line
                  type="linear"
                  dataKey="gpuMs"
                  name="GPU (ms)"
                  stroke="var(--accent-secondary)"
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="muted">
            {result.crossover.methodology} · {result.modelVersion}
          </p>
          <details>
            <summary>Thread comparison, assumptions and limitations</summary>
            <p>
              Observed CPU thread configurations:{' '}
              {result.threadComparisons.length
                ? result.threadComparisons
                    .map(
                      (t) => `${t.threads} thread(s): ${time(t.cpuMs)} (seed${t.seed}, ${t.dtype})`,
                    )
                    .join('; ')
                : 'No controlled compatible measurements. No thread or batch-size recommendation is fabricated.'}
            </p>
            {[...result.warnings, ...result.limitations].map((n, i) => (
              <p key={i}>{n}</p>
            ))}
          </details>
          <div className="report-actions">
            <Link href="/explainability">Explain saved prediction →</Link>
            <Link href="/reports">Build evidence report →</Link>
            <Link href="/ml-predictions">Model evaluation and readiness →</Link>
          </div>
          <p className="muted">
            Prediction: {result.references.predictionId ?? 'No saved ML prediction'} · Comparison:{' '}
            {result.references.comparisonId ?? 'Preview only'}
          </p>
        </div>
      )}
    </section>
  );
}
