'use client';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
// Fixed illustration fixtures, never hardware readings or benchmark records.
const demoHistory = [22, 28, 25, 39, 34, 31, 45, 38, 42, 35, 29, 37, 32].map((cpu, i) => ({
  seconds: i * 5,
  cpu,
  gpu: [12, 16, 14, 23, 19, 28, 22, 26, 20, 18, 24, 21, 18][i],
}));
export default function TelemetryChart() {
  return (
    <div
      className="chart"
      role="img"
      aria-label="Synthetic demonstration: CPU utilization ranges from 22 to 45 percent and GPU utilization from 12 to 28 percent over 60 seconds. These are not measured readings."
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart data={demoHistory} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
          <defs>
            <linearGradient id="cpu-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" />
          <XAxis
            dataKey="seconds"
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
            tickFormatter={(v) => `${v}s`}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--surface-elevated)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: 8,
            }}
            labelFormatter={(v) => `Demo · ${v} seconds`}
            formatter={(value, name) => [`${value}%`, name]}
          />
          <Area
            name="CPU"
            type="monotone"
            dataKey="cpu"
            stroke="var(--accent-primary)"
            fill="url(#cpu-area)"
            strokeWidth={2}
            isAnimationActive={false}
          />
          <Area
            name="GPU"
            type="monotone"
            dataKey="gpu"
            stroke="var(--accent-secondary)"
            fill="transparent"
            strokeWidth={2}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
