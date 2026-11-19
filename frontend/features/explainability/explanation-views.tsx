'use client';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { GlobalExplanation, LocalExplanation } from '@corewise/types';
const labels: Record<string, string> = {
  workload_size: 'Workload size',
  operation_count: 'Operation count',
  arithmetic_intensity: 'Arithmetic intensity',
  parallel_fraction: 'Offloadable fraction',
  memory_mib: 'Memory footprint',
  transfer_mib: 'Transfer size',
  cpu_cores: 'CPU cores',
  cpu_frequency_ghz: 'CPU frequency',
  cpu_gflops: 'CPU compute throughput',
  cpu_bandwidth_gbps: 'CPU memory bandwidth',
  gpu_gflops: 'GPU compute throughput',
  gpu_bandwidth_gbps: 'GPU memory bandwidth',
  gpu_memory_gb: 'GPU memory capacity',
  transfer_bandwidth_gbps: 'Host–device bandwidth',
  launch_overhead_us: 'GPU launch overhead',
  workload_type: 'Workload category',
  workload_unit: 'Workload-size unit',
  precision: 'Precision',
};
export const featureLabel = (key: string) => labels[key] ?? key;

export function DeviceExplanation({ data: d }: { data: LocalExplanation }) {
  const waterfall = [
    {
      name: 'Baseline',
      range: [0, d.baselineOutput],
      value: d.baselineOutput,
      color: 'var(--accent-secondary)',
    },
    ...d.contributions.map((c, index) => {
      const start =
        d.baselineOutput + d.contributions.slice(0, index).reduce((sum, row) => sum + row.value, 0);
      return {
        name: featureLabel(c.feature),
        range: [start, start + c.value],
        value: c.value,
        color: c.value >= 0 ? 'var(--danger)' : 'var(--success)',
      };
    }),
    {
      name: 'Reconstructed output',
      range: [0, d.reconstructedOutput],
      value: d.reconstructedOutput,
      color: 'var(--accent-secondary)',
    },
  ];
  return (
    <section
      className="panel explanation-device"
      data-testid={`explanation-${d.model.target.toLowerCase()}`}
    >
      <div className="section-heading">
        <div>
          <span className="eyebrow">
            {d.model.target} · {d.model.explainerType}
          </span>
          <h2>{d.model.target} prediction attribution</h2>
        </div>
        <span className="badge">{d.model.datasetProvenance}</span>
      </div>
      <p className="notice">
        Contributions are ln(ms), not milliseconds. The reference time is exp(expected log-time),
        not mean execution time. This is a model explanation, not measured performance or causality.
      </p>
      <div className="ml-metrics">
        <div>
          <span>Baseline reference time</span>
          <strong>
            {d.baselineReferenceMs.toPrecision(4)} <small>ms</small>
          </strong>
          <small>baseline {d.baselineOutput.toPrecision(6)} ln(ms)</small>
        </div>
        <div>
          <span>Saved prediction</span>
          <strong>
            {(d.savedPredictionTimeMs ?? d.predictedTimeMs).toPrecision(4)} <small>ms</small>
          </strong>
          <small>{d.repetitions} repetition(s)</small>
        </div>
        <div>
          <span>Additive consistency</span>
          <strong>Passed</strong>
          <small>residual {d.additivity.residual.toExponential(2)} ln(ms)</small>
        </div>
      </div>
      <div
        className="explanation-chart"
        role="img"
        aria-label={`${d.model.target} SHAP waterfall in log milliseconds`}
      >
        <h3>Baseline → signed contributions → reconstructed log-time</h3>
        <ResponsiveContainer width="100%" height={Math.max(380, waterfall.length * 32)}>
          <BarChart data={waterfall} layout="vertical" margin={{ left: 0, right: 24, bottom: 12 }}>
            <CartesianGrid stroke="var(--border)" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => Number(v).toPrecision(3)}
            />
            <YAxis type="category" dataKey="name" width={135} tick={{ fontSize: 10 }} />
            <Tooltip
              formatter={(_value, _name, item) => [
                Number(item.payload.value).toPrecision(6),
                'ln(ms)',
              ]}
            />
            <Bar dataKey="range" isAnimationActive={false}>
              {waterfall.map((r, i) => (
                <Cell key={i} fill={r.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="muted">
          Red increases modeled log-time; green decreases it. Sum of grouped contributions +
          baseline = {d.reconstructedOutput.toPrecision(9)} ln(ms). Fitted output ={' '}
          {d.finalOutput.toPrecision(9)} ln(ms); allowed numerical residual ≤{' '}
          {d.additivity.tolerance.toExponential(2)}.
        </p>
      </div>
      <div className="explanation-summary">
        <h3>Calculated explanation summary</h3>
        {d.summary.length ? (
          d.summary.map((s, i) => <p key={i}>{s}</p>)
        ) : (
          <p>No nonzero feature contributions for this input and background.</p>
        )}
      </div>
      <div className="ml-table-wrap">
        <table className="ml-table">
          <thead>
            <tr>
              <th>Feature group</th>
              <th>Signed SHAP · ln(ms)</th>
              <th>Direction</th>
            </tr>
          </thead>
          <tbody>
            {d.contributions.map((c) => (
              <tr key={c.feature}>
                <td>{featureLabel(c.feature)}</td>
                <td>{c.value.toPrecision(6)}</td>
                <td>{c.direction}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">
        Model {d.model.modelVersion} · dataset {d.model.datasetVersion} ·{' '}
        {d.model.datasetProvenance} · {d.background.sampleSize} training background rows. CPU and
        GPU use separate baselines; these are not speedup attributions.
      </p>
      <details>
        <summary>Exact model, background reference & transformed mapping</summary>
        <pre className="ml-code">
          {JSON.stringify(
            {
              model: d.model,
              background: d.background,
              predictionArtifactBinding: d.predictionArtifactBinding,
              transformedContributions: d.transformedContributions,
            },
            null,
            2,
          )}
        </pre>
      </details>
      <details>
        <summary>Explanation limitations</summary>
        {d.limitations.map((x) => (
          <p key={x} className="muted">
            {x}
          </p>
        ))}
      </details>
    </section>
  );
}

export function GlobalImportance({ data: d }: { data: GlobalExplanation }) {
  const rows = d.importance.map((f) => ({ ...f, label: featureLabel(f.feature) }));
  return (
    <section
      className="panel explanation-global"
      data-testid={`global-${d.model.target.toLowerCase()}`}
    >
      <div className="section-heading">
        <div>
          <span className="eyebrow">HELD-OUT SAMPLE · {d.model.target}</span>
          <h2>{d.model.target} global feature importance</h2>
        </div>
        <span className="badge">{d.model.datasetProvenance}</span>
      </div>
      <p className="muted">
        Mean absolute grouped transformed-feature SHAP, in ln(ms). {d.evaluation.sampleSize}{' '}
        held-out rows{d.evaluation.workloadFamily ? ` · family ${d.evaluation.workloadFamily}` : ''}
        . Background: {d.background.sampleSize} separate training rows. Importance describes this
        model/sample, not causality.
      </p>
      <div
        className="explanation-chart"
        role="img"
        aria-label={`${d.model.target} global mean absolute SHAP feature importance`}
      >
        <ResponsiveContainer width="100%" height={Math.max(320, rows.length * 31)}>
          <BarChart data={rows} layout="vertical" margin={{ right: 20 }}>
            <CartesianGrid stroke="var(--border)" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis dataKey="label" type="category" width={135} tick={{ fontSize: 10 }} />
            <Tooltip
              formatter={(value) => [Number(value).toPrecision(6), 'Mean |SHAP| · ln(ms)']}
            />
            <Bar dataKey="meanAbsShap" fill="var(--accent-primary)" isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="ml-table-wrap">
        <table className="ml-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Feature</th>
              <th>Mean |SHAP| · ln(ms)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.feature}>
                <td>{r.rank}</td>
                <td>{r.label}</td>
                <td>{r.meanAbsShap.toPrecision(6)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">
        {d.model.algorithm} · model {d.model.modelVersion} · dataset {d.model.datasetVersion} ·
        additive residual max {d.additivity.maxAbsResidual.toExponential(2)} ln(ms).
      </p>
      <details>
        <summary>Sample, provenance & transformed feature mapping</summary>
        <pre className="ml-code">
          {JSON.stringify(
            {
              model: d.model,
              background: d.background,
              evaluation: d.evaluation,
              mapping: d.transformedMapping,
            },
            null,
            2,
          )}
        </pre>
        {d.limitations.map((x) => (
          <p className="muted" key={x}>
            {x}
          </p>
        ))}
      </details>
    </section>
  );
}

export function ImportanceComparison({
  cpu,
  gpu,
}: {
  cpu: GlobalExplanation;
  gpu: GlobalExplanation;
}) {
  const rows = [
    ...new Set([...cpu.importance.map((x) => x.feature), ...gpu.importance.map((x) => x.feature)]),
  ].map((feature) => ({
    feature: featureLabel(feature),
    CPU: cpu.importance.find((x) => x.feature === feature)?.meanAbsShap ?? null,
    GPU: gpu.importance.find((x) => x.feature === feature)?.meanAbsShap ?? null,
  }));
  return (
    <section className="panel">
      <h2>CPU / GPU importance comparison</h2>
      <p className="muted">
        Separate model importances in ln(ms), not an attribution of speedup. Missing model features
        stay absent. CPU: {cpu.model.algorithm} / {cpu.model.datasetProvenance}. GPU:{' '}
        {gpu.model.algorithm} / {gpu.model.datasetProvenance}.
      </p>
      <div
        className="explanation-chart"
        role="img"
        aria-label="Separate CPU and GPU model SHAP importance comparison"
      >
        <ResponsiveContainer width="100%" height={Math.max(400, rows.length * 36)}>
          <BarChart data={rows} layout="vertical" margin={{ right: 20 }}>
            <CartesianGrid stroke="var(--border)" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="feature" width={135} tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="CPU" fill="var(--accent-primary)" isAnimationActive={false} />
            <Bar dataKey="GPU" fill="var(--accent-secondary)" isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
