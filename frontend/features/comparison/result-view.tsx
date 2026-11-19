'use client';
import dynamic from 'next/dynamic';
import { Cpu, Layers3, Info, ArrowRight } from 'lucide-react';
import type { Comparison, DeviceTiming } from '@corewise/types';
import { ProvenanceBadge } from '@/components/metric-card';
const Charts = dynamic(() => import('./charts'), {
  ssr: false,
  loading: () => (
    <div role="status" className="skeleton chart-loading" aria-label="Loading comparison charts" />
  ),
});
import { formatTime } from '@/lib/format-time';
const recommendationLabels = {
  CPU: 'CPU estimated faster',
  GPU: 'GPU estimated faster',
  SIMILAR: 'Similar estimated performance',
  INSUFFICIENT_DATA: 'Insufficient hardware data',
};
const capabilityLabels: Record<string, string> = {
  precision: 'Operation precision',
  cpuPeakGflops: 'CPU peak (GFLOP/s)',
  cpuBandwidthGbps: 'CPU bandwidth (GB/s)',
  cpuCores: 'Effective CPU cores',
  gpuPeakGflops: 'GPU peak (GFLOP/s)',
  gpuBandwidthGbps: 'GPU bandwidth (GB/s)',
  transferBandwidthGbps: 'Host–device bandwidth (GB/s)',
  kernelLaunchUs: 'Kernel launch (µs)',
  transferConvention: 'Transfer-size convention',
  gpuName: 'GPU model',
};
export function ComparisonResultView({ comparison }: { comparison: Comparison }) {
  const result = comparison.result;
  const hardware = comparison.hardwareSnapshot;
  const workload = comparison.workloadSnapshot;
  const cards: [string, string, DeviceTiming | null, typeof Cpu][] = [
    ['CPU', hardware.cpuName, result.cpu, Cpu],
    ['GPU path', hardware.gpuName ?? 'GPU not specified', result.gpu, Layers3],
  ];
  return (
    <div className="comparison-result">
      <div className="result-intro">
        <div>
          <span className="eyebrow">SAVED ANALYTICAL SNAPSHOT</span>
          <h2>{workload.name}</h2>
          <p>
            {hardware.name} ·{' '}
            {new Date(comparison.createdAt).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC
          </p>
        </div>
        <ProvenanceBadge value="ANALYTICAL" />
      </div>
      <section
        className={`panel result-recommendation ${result.recommendation === 'INSUFFICIENT_DATA' ? 'incomplete' : ''}`}
      >
        <div>
          <span className="eyebrow">CURRENT RECOMMENDATION</span>
          <h2>{recommendationLabels[result.recommendation]}</h2>
          {result.reasons.map((reason) => (
            <p key={reason}>{reason}</p>
          ))}
        </div>
        <div className="result-ratio">
          <strong>{result.speedup === null ? '—' : `${result.speedup.toPrecision(4)}×`}</strong>
          <span>CPU time / GPU time</span>
          <small>Tolerance ±{result.assumptions.tolerance * 100}%</small>
        </div>
      </section>
      {result.missingFields.length > 0 && (
        <div className="missing-capabilities" role="status">
          <Info size={18} />
          <div>
            <strong>Required information</strong>
            <ul>
              {result.missingFields.map((field) => (
                <li key={field}>
                  {capabilityLabels[field.replace('assumptions.', '').replace('hardware.', '')] ??
                    field}
                </li>
              ))}
            </ul>
            <p>
              Enter the missing assumptions above and compare again. No hardware capability has been
              invented.
            </p>
          </div>
        </div>
      )}
      <div className="device-result-grid">
        {cards.map(([device, name, timing, Icon]) => (
          <section className="panel device-result" key={device}>
            <div className="device-result-heading">
              <span>
                <Icon size={23} />
              </span>
              <div>
                <h2>{device}</h2>
                <p>{name}</p>
              </div>
              <span className="badge">USER_ENTERED</span>
            </div>
            <div className="execution-estimate">
              <strong>{formatTime(timing?.totalSeconds)}</strong>
              <span>ANALYTICAL ESTIMATE · TOTAL</span>
            </div>
            <dl className="timing-list">
              {[
                ['Compute floor', timing?.computeSeconds],
                ['Memory floor (overlaps)', timing?.memoryFloorSeconds],
                ['Additional memory stall', timing?.memoryStallSeconds],
                ['Transfer overhead', timing?.transferSeconds],
                ['Kernel launch', timing?.launchSeconds],
                ['Serial stage', timing?.serialSeconds],
                ['Parallel stage', timing?.parallelSeconds],
                ['Per repetition', timing?.perRepetitionSeconds],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <dt>{label}</dt>
                  <dd>{formatTime(value as number | undefined)}</dd>
                </div>
              ))}
            </dl>
            <div className="result-device-specs">
              {device === 'CPU'
                ? `${hardware.physicalCores ?? 'Unknown'} physical cores · ${hardware.cpuBaseGhz ?? '—'} GHz base · ${hardware.ramGb} GiB RAM`
                : `${hardware.vramGb ?? 'Unknown'} GB VRAM · ${hardware.memoryBandwidthGbps ?? 'Unknown'} GB/s profile bandwidth`}
            </div>
          </section>
        ))}
      </div>
      {result.cpu && result.gpu ? (
        <Charts result={result} />
      ) : (
        <div className="panel chart-unavailable">
          <Info size={22} />
          <p>Comparison charts require valid estimates for both devices.</p>
        </div>
      )}
      <section className="panel workload-characteristics">
        <div className="card-heading">
          <h2>Workload characteristics</h2>
          <ProvenanceBadge value={workload.presetId ? 'SYNTHETIC_DEMO' : 'USER_ENTERED'} />
        </div>
        <div className="characteristic-grid">
          {[
            ['Operations / repetition', workload.operationCount.toLocaleString()],
            [
              'Arithmetic intensity',
              `${Number(workload.arithmeticIntensity.toPrecision(6))} FLOPs/byte`,
            ],
            ['Parallel fraction', String(workload.parallelFraction)],
            ['Resident footprint', `${workload.memoryMiB} MiB`],
            ['Transfer size', `${workload.transferMiB} MiB`],
            ['Repetitions', String(workload.repetitions)],
          ].map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </section>
      <details className="panel result-assumptions" open>
        <summary>
          Model assumptions <ArrowRight size={16} />
        </summary>
        <div>
          <p>
            <strong>{result.modelVersion}</strong> · {result.assumptions.supplied.precision}
          </p>
          <p>{result.assumptions.methodology}</p>
          <p>{result.assumptions.transferPolicy}</p>
          <dl className="assumption-list">
            {Object.entries(result.assumptions.resolved).map(([key, value]) => (
              <div key={key}>
                <dt>{capabilityLabels[key] ?? key}</dt>
                <dd>
                  {value ?? 'Not supplied'} <small>{result.assumptions.sources[key]}</small>
                </dd>
              </div>
            ))}
          </dl>
          <p>
            Memory traffic: {result.assumptions.memoryTrafficBytes.toLocaleString()}{' '}
            bytes/repetition. Transferred bytes:{' '}
            {result.assumptions.transferBytesPerRepetition.toLocaleString()} per repetition.
          </p>
          <p>
            CPU compute-only Amdahl speedup:{' '}
            {result.theoreticalCpuSpeedup?.toPrecision(4) ?? 'Unknown'}×. This is a theoretical
            limit, not a measured runtime speedup.
          </p>
          {result.assumptions.presetNotes.map((note) => (
            <p key={note}>{note}</p>
          ))}
          <h3>Limitations and warnings</h3>
          <ul>
            {[...result.limitations, ...result.warnings].map((limit) => (
              <li key={limit}>{limit}</li>
            ))}
          </ul>
        </div>
      </details>
    </div>
  );
}
