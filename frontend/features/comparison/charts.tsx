'use client';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AnalyticalResult } from '@corewise/types';

export default function ComparisonCharts({ result }: { result: AnalyticalResult }) {
  const rows = [
    {
      name: 'CPU',
      total: (result.cpu?.totalSeconds ?? 0) * 1000,
      compute: (result.cpu?.computeSeconds ?? 0) * 1000,
      memory: (result.cpu?.memoryStallSeconds ?? 0) * 1000,
      transfer: 0,
      launch: 0,
    },
    {
      name: 'GPU path',
      total: (result.gpu?.totalSeconds ?? 0) * 1000,
      compute: (result.gpu?.computeSeconds ?? 0) * 1000,
      memory: (result.gpu?.memoryStallSeconds ?? 0) * 1000,
      transfer: (result.gpu?.transferSeconds ?? 0) * 1000,
      launch: (result.gpu?.launchSeconds ?? 0) * 1000,
    },
  ];
  const tooltip = {
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    borderRadius: 8,
  };
  const tick = { fill: 'var(--text-secondary)', fontSize: 11 };
  return (
    <div className="comparison-charts">
      <section className="panel">
        <div className="card-heading">
          <div>
            <h2>Execution time</h2>
            <p>Estimated total · all repetitions · milliseconds</p>
          </div>
        </div>
        <div
          className="result-chart"
          role="img"
          aria-label={`Analytical execution times: CPU ${rows[0]!.total} ms; GPU path ${rows[1]!.total} ms.`}
        >
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={rows} margin={{ top: 16, right: 18, left: 4, bottom: 4 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" />
              <XAxis dataKey="name" tick={tick} axisLine={false} tickLine={false} />
              <YAxis tick={tick} width={58} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={tooltip}
                formatter={(value) => [`${Number(value).toPrecision(4)} ms`, 'Estimated total']}
              />
              <Bar
                dataKey="total"
                name="Estimated time"
                fill="var(--accent-primary)"
                radius={[4, 4, 0, 0]}
                maxBarSize={70}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="panel">
        <div className="card-heading">
          <div>
            <h2>Time components</h2>
            <p>Additive compute, memory stall, transfer, and launch</p>
          </div>
        </div>
        <div
          className="result-chart"
          role="img"
          aria-label="Analytical timing breakdown. Memory stall is additional time beyond compute, not the full overlapping memory floor."
        >
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={rows} margin={{ top: 16, right: 18, left: 4, bottom: 4 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" />
              <XAxis dataKey="name" tick={tick} axisLine={false} tickLine={false} />
              <YAxis tick={tick} width={58} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={tooltip}
                formatter={(value, name) => [`${Number(value).toPrecision(4)} ms`, name]}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar
                dataKey="compute"
                name="Compute floor"
                stackId="a"
                fill="var(--accent-primary)"
                maxBarSize={70}
                isAnimationActive={false}
              />
              <Bar
                dataKey="memory"
                name="Memory stall"
                stackId="a"
                fill="var(--accent-secondary)"
                isAnimationActive={false}
              />
              <Bar
                dataKey="transfer"
                name="Transfer"
                stackId="a"
                fill="var(--warning)"
                isAnimationActive={false}
              />
              <Bar
                dataKey="launch"
                name="Launch"
                stackId="a"
                fill="var(--success)"
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="panel speedup-chart-panel">
        <div className="card-heading">
          <div>
            <h2>Estimated CPU / GPU time ratio</h2>
            <p>Above 1 favors GPU; below 1 favors CPU. Similarity uses the configured tolerance.</p>
          </div>
        </div>
        {result.speedup === null ? (
          <p className="ratio-empty">Ratio undefined: both durations are zero.</p>
        ) : (
          <div
            className="speedup-chart"
            role="img"
            aria-label={`Analytical speedup ratio ${result.speedup.toPrecision(4)}. The parity reference is 1.`}
          >
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart
                data={[{ name: 'CPU / GPU', ratio: result.speedup }]}
                layout="vertical"
                margin={{ top: 12, right: 28, left: 8, bottom: 8 }}
              >
                <XAxis
                  type="number"
                  tickFormatter={(value) =>
                    Number(value).toLocaleString('en-GB', { maximumSignificantDigits: 3 })
                  }
                  domain={[0, Math.max(1.2, result.speedup * 1.15)]}
                  tick={tick}
                />
                <YAxis dataKey="name" type="category" width={80} tick={tick} />
                <ReferenceLine x={1} stroke="var(--text-secondary)" strokeDasharray="4 4" />
                <Tooltip
                  contentStyle={tooltip}
                  formatter={(value) => [`${Number(value).toPrecision(4)}×`, 'Time ratio']}
                />
                <Bar
                  dataKey="ratio"
                  fill="var(--accent-secondary)"
                  barSize={20}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  );
}
