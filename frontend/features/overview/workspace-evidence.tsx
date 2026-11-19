'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { workspaceSummarySchema, agentStatusSchema } from '@corewise/types';
import { apiData } from '@/lib/api';
export function WorkspaceEvidence({ userId }: { userId: string }) {
  const q = useQuery({
    queryKey: ['workspace-summary', userId],
    queryFn: () => apiData('/api/workspace/summary', workspaceSummarySchema),
  });
  const provider = useQuery({
    queryKey: ['agent-status', userId],
    queryFn: () => apiData('/api/agent/status', agentStatusSchema),
    retry: false,
  });
  if (q.isPending)
    return (
      <div
        role="status"
        className="skeleton comparison-loading"
        aria-label="Loading workspace evidence"
      />
    );
  if (q.isError)
    return (
      <section className="panel">
        <p role="alert">Workspace evidence is unavailable.</p>
        <button onClick={() => void q.refetch()}>Retry evidence</button>
      </section>
    );
  const d = q.data.data;
  return (
    <section className="workspace-evidence" aria-label="Saved project evidence">
      <div className="section-heading">
        <h2>Your performance evidence</h2>
        <Link href="/reports">Build a report →</Link>
      </div>
      <div className="evidence-grid">
        <article className="panel">
          <span className="eyebrow">ML · PREDICTED</span>
          <h3>Latest prediction</h3>
          {d.prediction ? (
            <>
              <p>
                CPU <strong>{d.prediction.cpuTimeMs.toPrecision(4)} ms</strong> · GPU{' '}
                <strong>{d.prediction.gpuTimeMs.toPrecision(4)} ms</strong>
              </p>
              <p className="muted">Training: {d.prediction.trainingProvenance.join(' / ')}</p>
            </>
          ) : (
            <p className="muted">No saved ML predictions.</p>
          )}
          <p className="muted">
            {d.models.length} active device models · {d.counts.predictions} saved predictions
          </p>
          <Link href="/ml-predictions">Review models & predictions →</Link>
        </article>
        <article className="panel">
          <span className="eyebrow">BENCHMARK · MEASURED</span>
          <h3>Recent benchmark runs</h3>
          {d.benchmarks.length ? (
            d.benchmarks.map((b) => (
              <div key={b.id}>
                <p>
                  {b.workload} · {b.scope}
                </p>
                <p className="muted">
                  CPU {b.cpuMedianMs.toPrecision(4)} ms ·{' '}
                  {b.gpuMedianMs === null
                    ? 'GPU unavailable'
                    : `GPU ${b.gpuMedianMs.toPrecision(4)} ms`}{' '}
                  · {b.valid ? 'correctness passed' : 'correctness failed'}
                </p>
              </div>
            ))
          ) : (
            <p className="muted">No measured benchmark runs.</p>
          )}
          <Link href="/benchmark-lab">Open Benchmark Lab →</Link>
        </article>
        <article className="panel">
          <span className="eyebrow">SHAP · MODEL ATTRIBUTION</span>
          <h3>Explainability</h3>
          <p>{d.counts.explanations} completed explanations</p>
          <p className="muted">
            {d.explanation
              ? `${d.explanation.kind} · ${d.explanation.id}`
              : 'No saved SHAP explanations.'}
          </p>
          <p className="muted">Contributions use ln(ms), not causal millisecond effects.</p>
          <Link href="/explainability">Review explanations →</Link>
        </article>
        <article className="panel">
          <span className="eyebrow">ASSISTANT & REPORTS</span>
          <h3>Workspace readiness</h3>
          <p>
            {provider.isPending
              ? 'Checking AI provider…'
              : provider.data?.data.configured
                ? `AI provider: ${provider.data.data.connection}`
                : 'AI provider unavailable'}
          </p>
          <p className="muted">
            {d.counts.reports} saved reports · {d.report?.title ?? 'No generated reports.'}
          </p>
          <Link href="/ai-assistant">Ask about your evidence →</Link>
          <Link href="/reports">Open report history →</Link>
        </article>
      </div>
    </section>
  );
}
