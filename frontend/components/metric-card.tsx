import type { LucideIcon } from 'lucide-react';
import type { Provenance } from '@corewise/types';

export function ProvenanceBadge({ value }: { value: Provenance }) {
  return <span className="badge provenance">{value}</span>;
}

export function MetricCard({
  title,
  icon: Icon,
  value,
  unit,
  detail,
  percent,
  demo,
  secondary,
  violet = false,
  measured = false,
  statusLabel,
}: {
  title: string;
  icon: LucideIcon;
  value: string;
  unit: string;
  detail: string;
  percent?: number;
  demo: boolean;
  secondary: [string, string][];
  violet?: boolean;
  measured?: boolean;
  statusLabel?: string;
}) {
  return (
    <article className="panel metric-card">
      <div className="panel-label">
        <span>
          <Icon size={17} />
          {title}
        </span>
        <span className={demo ? 'tiny status-demo' : 'tiny'}>
          {demo ? 'DEMO' : measured ? 'MEASURED' : (statusLabel ?? 'OFFLINE')}
        </span>
      </div>
      <div className="metric-value">
        {value}
        <span>{unit}</span>
      </div>
      <div className="metric-detail">{detail}</div>
      <div
        className={`meter ${violet ? 'violet' : ''}`}
        role={percent === undefined ? undefined : 'meter'}
        aria-label={percent === undefined ? undefined : `${title} utilization`}
        aria-valuemin={percent === undefined ? undefined : 0}
        aria-valuemax={percent === undefined ? undefined : 100}
        aria-valuenow={percent}
      >
        <span style={{ width: `${percent ?? 0}%` }} />
      </div>
      <dl className="metric-secondary">
        {secondary.map(([label, metric]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{metric}</dd>
          </div>
        ))}
      </dl>
      {demo && <ProvenanceBadge value="SYNTHETIC_DEMO" />}
      {measured && !demo && <ProvenanceBadge value="MEASURED" />}
    </article>
  );
}
