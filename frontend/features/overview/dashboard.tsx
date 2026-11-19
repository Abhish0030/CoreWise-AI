'use client';
import Link from 'next/link';
import { FunctionalJourney } from '@/features/functional/journey';
import { useTelemetry } from '@/features/functional/use-telemetry';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Bot,
  CircleHelp,
  Cpu,
  Fan,
  FlaskConical,
  HardDrive,
  Layers3,
  PlugZap,
  Radio,
  Sparkles,
  Workflow,
} from 'lucide-react';
import {
  systemStatusSchema,
  hardwareListSchema,
  workloadListSchema,
  comparisonListSchema,
  modelListSchema,
} from '@corewise/types';
import { useAuth } from '@/features/auth/use-auth';
import { apiData } from '@/lib/api';
import { formatTime } from '@/lib/format-time';
import { observedTime } from '@/lib/observed-time';
import { Button } from '@/components/ui/button';
import { ChipIllustration } from '@/components/chip-illustration';
import { MetricCard, ProvenanceBadge } from '@/components/metric-card';
import { WorkspaceEvidence } from './workspace-evidence';
import { agentStatusSchema } from '@corewise/types';
const TelemetryChart = dynamic(() => import('@/components/telemetry-chart'), {
  ssr: false,
  loading: () => <div role="status" className="chart skeleton" aria-label="Loading chart" />,
});

export function Dashboard() {
  const [demo, setDemo] = useState(false);
  const auth = useAuth();
  const hardware = useQuery({
    queryKey: ['hardware-profiles', auth.data?.id],
    queryFn: () => apiData('/api/hardware-profiles', hardwareListSchema),
    enabled: !!auth.data,
    retry: false,
  });
  const selectedId = auth.data?.selectedProfileId ?? auth.data?.defaultProfileId;
  const selectedProfile = hardware.data?.data.find((profile) => profile.id === selectedId);
  const profilePending = !!selectedId && hardware.isPending;
  const workloads = useQuery({
    queryKey: ['workloads', auth.data?.id],
    queryFn: () => apiData('/api/workloads', workloadListSchema),
    enabled: !!auth.data,
    retry: false,
  });
  const comparisons = useQuery({
    queryKey: ['comparisons', auth.data?.id],
    queryFn: () => apiData('/api/comparisons', comparisonListSchema),
    enabled: !!auth.data,
    retry: false,
  });
  const { connection, live, telemetry } = useTelemetry(auth.data?.id);
  const latest = comparisons.data?.data[0];
  const models = useQuery({
    queryKey: ['ml-models', auth.data?.id],
    queryFn: () => apiData('/api/ml/models', modelListSchema),
    enabled: !!auth.data,
    retry: false,
  });
  const activeTargets = new Set(models.data?.data.filter((m) => m.active).map((m) => m.target));
  const provider = useQuery({
    queryKey: ['agent-status', auth.data?.id],
    queryFn: () => apiData('/api/agent/status', agentStatusSchema),
    enabled: !!auth.data,
    retry: false,
  });
  const modelReadiness = models.isError
    ? 'Status unavailable'
    : activeTargets.size === 2
      ? 'CPU + GPU models active'
      : models.data?.data.length
        ? 'Models trained · activation required'
        : 'Model not trained';
  const decision = latest
    ? {
        CPU: 'CPU estimated faster',
        GPU: 'GPU estimated faster',
        SIMILAR: 'Similar estimated performance',
        INSUFFICIENT_DATA: 'Insufficient hardware data',
      }[latest.result.recommendation]
    : null;
  const status = useQuery({
    queryKey: ['system-status'],
    queryFn: async () => {
      const response = await fetch('/api/system/status');
      if (!response.ok) throw new Error('API unavailable');
      return systemStatusSchema.parse(await response.json());
    },
  });
  function exportStatus() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            application: 'CoreWise AI',
            milestone: 'M7',
            api: status.isSuccess ? 'connected' : 'unavailable',
            monitoring: 'DISCONNECTED',
            model: modelReadiness,
            profiles: hardware.data?.data.length ?? 0,
            selectedProfileId: selectedProfile?.id ?? null,
            displayMode: demo ? 'SYNTHETIC_DEMO' : 'EMPTY',
            exportedAt: new Date().toISOString(),
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'corewise-workspace-status.json';
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className={`dashboard ${auth.data ? 'dashboard-personal' : ''}`}>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR WORKSPACE, AT A GLANCE</div>
          <h1>
            System overview<span className="title-dot">.</span>
          </h1>
          <p>Understand your hardware. Make every compute decision count.</p>
        </div>
        <Button variant="outline" onClick={exportStatus}>
          <ArrowDownToLine size={16} />
          Export status
        </Button>
      </div>
      {auth.data && <FunctionalJourney user={auth.data} />}
      <section className="hero panel" aria-labelledby="environment-title">
        <div className="hero-content">
          <div className="hero-kicker">
            <span className="badge">COMPUTE ENVIRONMENT</span>
            <span className="tiny">
              <i className="status-dot" />
              {selectedProfile
                ? `${selectedProfile.name} · ${telemetry ? 'Measured local samples' : 'No recent local samples'}`
                : profilePending
                  ? 'Loading selected hardware…'
                  : 'No profile selected'}
              {selectedProfile && <ProvenanceBadge value={selectedProfile.provenance} />}
            </span>
          </div>
          <h2 id="environment-title">
            Power begins with
            <br />
            <span>understanding.</span>
          </h2>
          <p>Hardware insights, performance intelligence, and workload analysis in one place.</p>
          <div className="hero-actions">
            <Button asChild>
              <Link href="/workload-analyzer">
                <Workflow size={16} />
                Analyze workload
                <ArrowUpRight size={15} />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/hardware-library">
                Set up hardware
                <ArrowRight size={16} />
              </Link>
            </Button>
          </div>
        </div>
        <div className="hero-visual">
          <ChipIllustration />
          <span className="technical-label">COREWISE ARCHITECTURE / 01</span>
        </div>
        <div className="hero-specs">
          {[
            [
              'PROCESSOR',
              selectedProfile?.cpuName ?? (profilePending ? 'Loading CPU…' : 'No CPU selected'),
            ],
            [
              'GRAPHICS',
              selectedProfile?.gpuName ?? (profilePending ? 'Loading GPU…' : 'No GPU selected'),
            ],
            [
              'MEMORY',
              selectedProfile
                ? `${selectedProfile.ramGb} GiB · ${selectedProfile.memoryType || 'Type unspecified'}`
                : profilePending
                  ? 'Loading memory…'
                  : 'Not configured',
            ],
            [
              'OPERATING SYSTEM',
              selectedProfile?.os ?? (profilePending ? 'Loading OS…' : 'Not configured'),
            ],
          ].map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </section>
      <div className="section-heading">
        <h2>
          System usage{' '}
          <span className="live-label">
            <i />
            {telemetry
              ? 'Measured local samples'
              : connection.data?.data.agents.some((a) => a.status === 'STALE')
                ? 'Telemetry stale'
                : 'Agent disconnected'}
          </span>
        </h2>
        <label className="demo-switch">
          <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} />
          <span>Preview demo data</span>
        </label>
      </div>
      <div className={`notice ${demo ? 'demo-notice' : ''}`}>
        <PlugZap size={16} />
        <span>
          {demo
            ? 'Demonstration mode. All sensor values and history below are synthetic illustrations, not local measurements.'
            : telemetry
              ? `MEASURED by ${live?.name}; sampled ${observedTime(telemetry.capturedAt)}. Stops/stales after the bounded runner exits.`
              : 'Live hardware monitoring requires a connected local agent.'}
        </span>
        <Link href="/system-monitor">
          {demo ? 'View details' : 'Learn more'}
          <ArrowRight size={14} />
        </Link>
      </div>
      <section className="metrics-grid" aria-label="System usage">
        <MetricCard
          title="CPU utilization"
          icon={Cpu}
          value={demo ? '32' : (telemetry?.cpuUtilizationPercent?.toFixed(1) ?? '—')}
          unit="%"
          detail={
            demo
              ? 'Illustrative processor activity'
              : telemetry
                ? 'psutil · measured local sample'
                : 'Waiting for telemetry'
          }
          percent={demo ? 32 : (telemetry?.cpuUtilizationPercent ?? undefined)}
          measured={!demo && !!telemetry}
          demo={demo}
          secondary={[
            ['Frequency', demo ? '3.80 GHz' : '—'],
            [
              'Temperature',
              demo
                ? '54 °C'
                : telemetry?.cpuTemperatureC == null
                  ? 'Unsupported'
                  : `${telemetry.cpuTemperatureC.toFixed(1)} °C`,
            ],
          ]}
        />
        <MetricCard
          title="GPU utilization"
          icon={Layers3}
          value={demo ? '18' : (telemetry?.gpu?.utilizationPercent?.toFixed(1) ?? '—')}
          unit="%"
          detail={
            demo
              ? 'Illustrative graphics activity'
              : telemetry?.gpu
                ? `${telemetry.gpu.source} · measured local sample`
                : 'Waiting for telemetry'
          }
          percent={demo ? 18 : (telemetry?.gpu?.utilizationPercent ?? undefined)}
          measured={!demo && !!telemetry?.gpu}
          demo={demo}
          violet
          secondary={[
            ['Frequency', demo ? '1.65 GHz' : '—'],
            [
              'VRAM',
              demo
                ? '2.4 / 8 GB'
                : telemetry?.gpu?.memoryUsedBytes == null
                  ? 'Unknown'
                  : `${(telemetry.gpu.memoryUsedBytes / 2 ** 30).toFixed(2)} GiB`,
            ],
            [
              'Temperature',
              demo
                ? 'Synthetic'
                : telemetry?.gpu?.temperatureC == null
                  ? 'Unsupported'
                  : `${telemetry.gpu.temperatureC} °C`,
            ],
          ]}
        />
        <MetricCard
          title="Memory"
          icon={HardDrive}
          value={demo ? '12.8' : telemetry ? (telemetry.ramUsedBytes / 2 ** 30).toFixed(2) : '—'}
          unit="GiB"
          detail={
            demo
              ? 'of 32 GB · 40% utilized'
              : telemetry
                ? `of ${(telemetry.ramTotalBytes / 2 ** 30).toFixed(2)} GiB · psutil`
                : 'No memory data available'
          }
          percent={
            demo
              ? 40
              : telemetry
                ? (100 * telemetry.ramUsedBytes) / telemetry.ramTotalBytes
                : undefined
          }
          measured={!demo && !!telemetry}
          demo={demo}
          secondary={[
            [
              'Available',
              demo
                ? '19.2 GB'
                : telemetry
                  ? `${((telemetry.ramTotalBytes - telemetry.ramUsedBytes) / 2 ** 30).toFixed(2)} GiB`
                  : '—',
            ],
            ['Storage used', demo ? '256 / 512 GB' : '—'],
          ]}
        />
        <MetricCard
          statusLabel="UNSUPPORTED"
          title="Cooling"
          icon={Fan}
          value={demo ? '2,140' : '—'}
          unit="RPM"
          detail={demo ? 'Illustrative CPU fan speed' : 'No cooling data available'}
          percent={demo ? 43 : undefined}
          demo={demo}
          violet
          secondary={[
            ['GPU fan', demo ? '1,820 RPM' : '—'],
            ['Thermals', demo ? 'Demo · normal' : 'Unknown'],
          ]}
        />
      </section>
      <div className="analytics-grid">
        <section className="panel analytics-panel">
          <div className="card-heading">
            <div>
              <h2>CPU vs GPU</h2>
              <p>The right device for the right workload.</p>
            </div>
            <Link className="icon-link" href="/cpu-vs-gpu" aria-label="Open CPU versus GPU">
              <ArrowUpRight size={19} />
            </Link>
          </div>
          <div className="comparison-empty">
            <div className="device-compare">
              <div>
                <Cpu size={27} />
                <span>CPU</span>
                <strong>{formatTime(latest?.result.cpu?.totalSeconds)}</strong>
              </div>
              <span className="versus">VS</span>
              <div>
                <Layers3 size={27} />
                <span>GPU</span>
                <strong>{formatTime(latest?.result.gpu?.totalSeconds)}</strong>
              </div>
            </div>
            <p>
              {latest
                ? `${latest.workloadSnapshot.name} · ANALYTICAL`
                : comparisons.isError
                  ? 'Comparison history unavailable.'
                  : 'No workload analyzed yet.'}
            </p>
            {latest && (
              <div className="overview-analysis-note">
                {decision} ·{' '}
                {latest.result.speedup === null
                  ? 'Ratio unavailable'
                  : `${latest.result.speedup.toPrecision(4)}× CPU / GPU`}
              </div>
            )}
            <Button asChild variant="outline">
              <Link href="/workload-analyzer">
                Explore workload analysis
                <ArrowRight size={15} />
              </Link>
            </Button>
          </div>
          <div className="panel-footnote">
            <CircleHelp size={13} />
            Analytical estimates include explicit assumptions and transfer costs.
          </div>
        </section>
        <section className="panel analytics-panel">
          <div className="card-heading">
            <div>
              <h2>Utilization history</h2>
              <p>
                {demo
                  ? 'Illustrative CPU and GPU activity · 60 seconds'
                  : 'Continuous sensor history is not collected.'}
              </p>
            </div>
            <Activity size={18} />
          </div>
          {demo ? (
            <>
              <div className="chart-legend">
                <span>
                  <i className="cpu-dot" />
                  CPU
                </span>
                <span>
                  <i className="gpu-dot" />
                  GPU
                </span>
                <ProvenanceBadge value="SYNTHETIC_DEMO" />
              </div>
              <TelemetryChart />
            </>
          ) : (
            <div className="chart-empty">
              <Radio size={28} />
              <h3>No telemetry connected</h3>
              <p>
                Continuous telemetry is unavailable. You can preview
                <br className="desktop-break" /> clearly labeled demonstration data above.
              </p>
            </div>
          )}
          <div className="panel-footnote">
            <i className="status-dot" />
            {demo ? 'Fixed synthetic fixtures · not streaming' : 'No readings collected'}
          </div>
        </section>
      </div>
      <div className="bottom-grid">
        <section className="panel intelligence">
          <div className="card-heading">
            <div className="intelligence-heading">
              <span className="intelligence-icon">
                <Sparkles size={20} />
              </span>
              <div>
                <h2>CoreWise Intelligence</h2>
                <p>Explainable insights for better compute decisions.</p>
              </div>
            </div>
            <span className="badge">EVIDENCE FIRST</span>
          </div>
          <div className="intelligence-body">
            <div>
              <h3>Your next decision starts here.</h3>
              <p>
                Compare analytical estimates or train regressors on explicitly labeled datasets.
                Synthetic model quality is not real-world benchmark accuracy. Review measured runs,
                SHAP attributions and authorized AI assistance with their source evidence.
              </p>
              <Button asChild variant="outline">
                <Link href="/ml-predictions">
                  <Bot size={16} />
                  Explore ML engineering
                  <ArrowRight size={15} />
                </Link>
              </Button>
            </div>
            <div className="readiness-list">
              <div>
                <span>Hardware profiles</span>
                <strong>
                  {hardware.data?.data.length
                    ? `${hardware.data.data.length} configured`
                    : 'Not configured'}
                </strong>
              </div>
              <div>
                <span>Regression model</span>
                <strong>{modelReadiness}</strong>
              </div>
              <div>
                <span>AI provider</span>
                <strong>
                  {!auth.data
                    ? 'Sign in to check'
                    : provider.isPending
                      ? 'Checking…'
                      : provider.data?.data.configured
                        ? provider.data.data.connection
                        : 'Unavailable'}
                </strong>
              </div>
            </div>
          </div>
        </section>
        <section className="panel quick-links">
          <div className="card-heading">
            <h2>Start exploring</h2>
            <ArrowUpRight size={18} />
          </div>
          {[
            {
              icon: Cpu,
              name: 'Hardware library',
              text: 'Build your compute environment',
              href: '/hardware-library',
            },
            {
              icon: FlaskConical,
              name: 'Benchmark lab',
              text: 'Explore measurement workflows',
              href: '/benchmark-lab',
            },
          ].map((item) => (
            <Link href={item.href} key={item.href}>
              <span className="quick-icon">
                <item.icon size={20} />
              </span>
              <span>
                <strong>{item.name}</strong>
                <small>{item.text}</small>
              </span>
              <ArrowRight size={16} />
            </Link>
          ))}
        </section>
      </div>
      <section className="panel recent-activity">
        <div className="card-heading">
          <div>
            <h2>Recent activity</h2>
            <p>Your saved workloads and analytical comparisons.</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/workload-analyzer">
              Quick analyze
              <ArrowRight size={14} />
            </Link>
          </Button>
        </div>
        {auth.data && (workloads.isPending || comparisons.isPending) ? (
          <div className="activity-empty" role="status">
            Loading saved activity…
          </div>
        ) : workloads.isError || comparisons.isError ? (
          <div className="activity-empty">
            <p>Saved activity is unavailable.</p>
            <Button
              variant="outline"
              onClick={() => {
                void workloads.refetch();
                void comparisons.refetch();
              }}
            >
              Retry activity
            </Button>
          </div>
        ) : workloads.data?.data.length || comparisons.data?.data.length ? (
          <div className="dashboard-records">
            {workloads.data?.data.slice(0, 3).map((workload) => (
              <Link key={workload.id} href={`/workload-analyzer?workload=${workload.id}`}>
                <Workflow size={18} />
                <div>
                  <strong>{workload.name}</strong>
                  <small>
                    Saved workload · {workload.operationCount.toLocaleString('en-GB')} operations
                  </small>
                </div>
                <ProvenanceBadge value={workload.provenance} />
              </Link>
            ))}
            {comparisons.data?.data.slice(0, 2).map((comparison) => (
              <Link key={comparison.id} href={`/cpu-vs-gpu?comparison=${comparison.id}`}>
                <Activity size={18} />
                <div>
                  <strong>{comparison.workloadSnapshot.name}</strong>
                  <small>
                    Saved analytical comparison ·{' '}
                    {comparison.result.recommendation.replaceAll('_', ' ')}
                  </small>
                </div>
                <ProvenanceBadge value="ANALYTICAL" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="activity-empty">
            <span className="empty-icon">
              <Activity size={20} />
            </span>
            <div>
              <h3>A fresh start for smarter compute.</h3>
              <p>Activity will appear here as you add profiles and analyze workloads.</p>
            </div>
          </div>
        )}
      </section>
      {auth.data && <WorkspaceEvidence userId={auth.data.id} />}
      <div className="api-status" role="status">
        <span className={status.isSuccess ? 'status-success' : ''}>
          <i />
          {status.isPending
            ? 'Connecting to API…'
            : status.isError
              ? 'API unavailable'
              : 'API connected'}
        </span>
        <span>Bounded local sampling only · No sensor access from browser</span>
        {status.isError && <button onClick={() => void status.refetch()}>Retry connection</button>}
      </div>
    </div>
  );
}
