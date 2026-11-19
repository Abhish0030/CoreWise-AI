'use client';
import type { BenchmarkMeasurement } from '@corewise/types';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
export function MeasuredResult({ measurement: m }: { measurement: BenchmarkMeasurement }) {
  const gpu = m.gpu;
  const rows = m.cpu.samplesMs.map((cpu, i) => ({
    sample: i + 1,
    cpu,
    gpu: gpu?.samplesMs[i] ?? null,
  }));
  return (
    <div className="benchmark-result" data-testid="benchmark-result">
      <span className="badge">
        MEASURED · {m.valid ? 'CORRECTNESS VALID' : 'INVALID — EXCLUDED FROM TRAINING'}
      </span>
      <div className="ml-metrics">
        <div>
          <span>CPU median</span>
          <strong>
            {m.cpu.summary.medianMs.toPrecision(4)} <small>ms</small>
          </strong>
          <small>σ {m.cpu.summary.stddevMs.toPrecision(3)} ms</small>
        </div>
        <div>
          <span>GPU median</span>
          <strong>
            {gpu ? gpu.summary.medianMs.toPrecision(4) : 'Unavailable'}{' '}
            <small>{gpu ? 'ms' : ''}</small>
          </strong>
          <small>
            {gpu ? `σ ${gpu.summary.stddevMs.toPrecision(3)} ms` : m.gpuUnavailableReason}
          </small>
        </div>
        <div>
          <span>CPU / GPU · matching scope</span>
          <strong>
            {m.speedup?.toPrecision(4) ?? '—'}
            {m.speedup ? '×' : ''}
          </strong>
          <small>{m.config.scope}</small>
        </div>
      </div>
      <div className="ml-chart-grid">
        <div className="ml-chart" role="img" aria-label="Measured CPU versus GPU execution times">
          <h3>Median execution time · ms</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={[
                { device: 'CPU', ms: m.cpu.summary.medianMs },
                ...(gpu ? [{ device: 'GPU', ms: gpu.summary.medianMs }] : []),
              ]}
            >
              <XAxis dataKey="device" />
              <YAxis width={55} />
              <Tooltip />
              <Bar dataKey="ms" fill="var(--accent-primary)" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="ml-chart" role="img" aria-label="Raw measured timing sample distribution">
          <h3>Individual timing samples · ms</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={rows}>
              <CartesianGrid stroke="var(--border)" />
              <XAxis dataKey="sample" />
              <YAxis width={55} />
              <Tooltip />
              <Line dataKey="cpu" stroke="var(--accent-primary)" isAnimationActive={false} />
              <Line dataKey="gpu" stroke="var(--accent-secondary)" isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <p className="muted">{m.methodology}</p>
      {gpu && (
        <p className="notice">
          GPU transfers (mean): H→D{' '}
          {(gpu.h2dMs.reduce((a, b) => a + b) / gpu.h2dMs.length).toPrecision(4)} ms; D→H{' '}
          {(gpu.d2hMs.reduce((a, b) => a + b) / gpu.d2hMs.length).toPrecision(4)} ms. Compute-only
          timing excludes these costs.
        </p>
      )}
      <details>
        <summary>Raw samples, correctness & reproducibility metadata</summary>
        <pre className="ml-code">{JSON.stringify(m, null, 2)}</pre>
      </details>
    </div>
  );
}
