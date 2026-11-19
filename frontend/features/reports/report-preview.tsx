'use client';
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { type ReportSnapshot } from '@corewise/types';
export function ReportPreview({ snapshot: s }: { snapshot: ReportSnapshot }) {
  return (
    <article className="report-preview" aria-label="Report preview">
      <header className="report-cover">
        <span className="eyebrow">COREWISE AI · EVIDENCE REPORT</span>
        <h2>{s.title}</h2>
        <p>
          {s.type.replaceAll('_', ' ')} · {new Date(s.generatedAt).toLocaleString()}
        </p>
        <p className="muted">
          {s.schemaVersion} · {s.references.length} immutable source references
        </p>
        <div className="report-source-index">
          {s.references.map((r) => (
            <span key={`${r.kind}:${r.id}`}>
              {r.kind} · {r.id} · {r.provenance}
            </span>
          ))}
        </div>
      </header>
      <section className="report-limitations">
        <h3>How to read this evidence</h3>
        {s.limitations.map((n) => (
          <p key={n}>{n}</p>
        ))}
      </section>
      {s.sections.map((section, index) => (
        <section key={`${section.kind}:${section.id}:${index}`} className="panel report-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">{section.kind.toUpperCase()} · SOURCE EVIDENCE</span>
              <h3>{section.title}</h3>
            </div>
            <span className="badge">{section.provenance}</span>
          </div>
          <p className="muted report-source-id">Source record: {section.id}</p>
          {section.chart && section.chart.bars.length > 0 && (
            <div
              className="report-chart"
              role="img"
              aria-label={`${section.chart.title} in ${section.chart.unit}`}
            >
              <h4>{section.chart.title}</h4>
              <p className="muted">
                {section.chart.unit}
                {section.chart.signed
                  ? ' · Signed model contributions; separate CPU/GPU baselines.'
                  : ''}
              </p>
              <ResponsiveContainer
                width="100%"
                height={Math.max(220, section.chart.bars.length * 31)}
              >
                <BarChart data={section.chart.bars} layout="vertical" margin={{ right: 25 }}>
                  <CartesianGrid stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="label" width={135} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => [Number(v).toPrecision(5), section.chart!.unit]} />
                  <Bar dataKey="value" isAnimationActive={false}>
                    {section.chart.bars.map((r, i) => (
                      <Cell
                        key={i}
                        fill={r.value < 0 ? 'var(--success)' : 'var(--accent-primary)'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <details
            className="report-fields"
            open={section.kind === 'hardware' || section.kind === 'workload'}
          >
            <summary>Configuration, units & source metadata</summary>
            <div className="ml-table-wrap">
              <table className="ml-table">
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>Saved value</th>
                    <th>Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {section.fields.map((f, i) => (
                    <tr key={i}>
                      <td>{f.label}</td>
                      <td>{f.value === null ? 'Unknown' : String(f.value)}</td>
                      <td>{f.unit || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <div className="report-notes">
            <h4>Assumptions & limitations</h4>
            {section.notes.map((n, i) => (
              <p key={i}>{n}</p>
            ))}
          </div>
        </section>
      ))}
    </article>
  );
}
