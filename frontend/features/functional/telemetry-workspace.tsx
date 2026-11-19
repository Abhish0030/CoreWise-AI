'use client';
import { type CurrentUser } from '@corewise/types';
import { useTelemetry } from './use-telemetry';
import { isAgentFresh, monitorStatus } from '@/lib/telemetry-health';
import { MonitorDevices } from './monitor-devices';
export function TelemetryWorkspace({ user }: { user: CurrentUser }) {
  const { connection: q, now } = useTelemetry(user.id);
  return (
    <div className="dashboard">
      <div className="page-heading">
        <div>
          <div className="eyebrow">AUTHORIZED LOCAL OBSERVATIONS</div>
          <h1>
            System Monitor<span className="title-dot">.</span>
          </h1>
          <p>Samples come from your authorized local runner, never browser sensors.</p>
        </div>
      </div>
      {q.data && !q.isError && <MonitorDevices connection={q.data.data} userId={user.id} />}
      <p role="status">{monitorStatus(q.data, q.isError, now)}</p>
      {q.isError && <button onClick={() => void q.refetch()}>Retry runner connection</button>}
      <p>
        Fresh samples expire after 15 seconds. Measurements describe the paired computer, which may
        differ from this browser&apos;s computer. Unsupported sensors remain unavailable.
      </p>
      <div className="evidence-grid">
        {q.data?.data.agents
          .filter((a) => a.id === q.data?.data.selectedAgentId)
          .map((agent) => {
            const fresh = isAgentFresh(agent, q.isError, now);
            const a = { ...agent, telemetry: fresh ? agent.telemetry : null };
            return (
              <section key={a.id} className="panel functional-journey">
                <div className="section-heading">
                  <h2>{a.name}</h2>
                  <span className="badge">
                    {a.status === 'FRESH' && !fresh ? 'STALE' : a.status}
                  </span>
                </div>
                <p>
                  Last receipt: {a.receivedAt ? new Date(a.receivedAt).toLocaleString() : 'Never'}
                </p>
                <p>
                  Device ID: {a.id}
                  {a.id === q.data?.data.selectedAgentId ? ' · Selected device' : ''}
                </p>
                {a.telemetry ? (
                  <>
                    <span className="badge">MEASURED</span>
                    <p>Sampled {new Date(a.telemetry.capturedAt).toLocaleString()}</p>
                    <p>CPU {a.telemetry.cpuUtilizationPercent ?? 'Unknown'}% · source psutil</p>
                    <p>
                      RAM {(a.telemetry.ramUsedBytes / 2 ** 30).toFixed(2)} /{' '}
                      {(a.telemetry.ramTotalBytes / 2 ** 30).toFixed(2)} GiB
                    </p>
                    <p>
                      CPU temperature{' '}
                      {a.telemetry.cpuTemperatureC == null
                        ? 'Unsupported'
                        : `${a.telemetry.cpuTemperatureC} °C`}
                    </p>
                    <p>
                      GPU{' '}
                      {a.telemetry.gpu
                        ? `${a.telemetry.gpu.model} · ${a.telemetry.gpu.utilizationPercent ?? 'Unknown'}% · ${a.telemetry.gpu.temperatureC ?? 'Unknown'} °C · ${a.telemetry.gpu.source}`
                        : 'GPU metrics unavailable on this device'}
                    </p>
                    {a.telemetry.gpu && (
                      <p>
                        GPU memory{' '}
                        {a.telemetry.gpu.memoryUsedBytes == null
                          ? 'Unavailable'
                          : `${(a.telemetry.gpu.memoryUsedBytes / 2 ** 20).toFixed(0)} MiB`}{' '}
                        /{' '}
                        {a.telemetry.gpu.memoryTotalBytes == null
                          ? 'Unavailable'
                          : `${(a.telemetry.gpu.memoryTotalBytes / 2 ** 20).toFixed(0)} MiB`}
                        ; power{' '}
                        {a.telemetry.gpu.powerWatts == null
                          ? 'Unavailable'
                          : `${a.telemetry.gpu.powerWatts} W`}
                      </p>
                    )}
                    {a.telemetry.limitations.map((n) => (
                      <p key={n}>{n}</p>
                    ))}
                  </>
                ) : (
                  <p>
                    No fresh sample. Device connected, monitoring stopped or unavailable. Start the
                    monitor locally; pairing alone does not collect measurements.
                  </p>
                )}
              </section>
            );
          })}
      </div>
    </div>
  );
}
