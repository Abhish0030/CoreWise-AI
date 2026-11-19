import type { connectionSchema } from '@corewise/types';

type Connection = ReturnType<typeof connectionSchema.parse>;
type Agent = Connection['data']['agents'][number];

export function isAgentFresh(agent: Agent, failed: boolean, now: number) {
  if (failed || agent.status !== 'FRESH' || !agent.telemetry) return false;
  const received = Date.parse(agent.receivedAt ?? '');
  const captured = Date.parse(agent.telemetry.capturedAt);
  return (
    Number.isFinite(received) &&
    Number.isFinite(captured) &&
    now - received >= -10000 &&
    now - received <= 15000 &&
    now - captured >= -10000 &&
    now - captured <= 15000
  );
}

// A cached FRESH response must not keep a stopped or disconnected runner online.
export function freshSelectedAgent(
  connection: Connection | undefined,
  failed: boolean,
  now: number,
) {
  if (failed || !connection?.data.profileMatched) return undefined;
  return connection.data.agents.find(
    (agent) => agent.id === connection.data.selectedAgentId && isAgentFresh(agent, failed, now),
  );
}

export function monitorStatus(connection: Connection | undefined, failed: boolean, now: number) {
  if (failed) return 'Runner API unavailable. Retry the connection.';
  if (!connection) return 'Loading runner state…';
  if (freshSelectedAgent(connection, false, now)) return 'Telemetry online.';
  const selected = connection.data.agents.find((a) => a.id === connection.data.selectedAgentId);
  if (selected?.status === 'EXPIRED') return 'Device pairing expired. Connect this computer again.';
  if (selected?.receivedAt) return 'Telemetry offline — waiting for fresh measurements.';
  if (connection.data.agents.length) return 'Device connected — monitoring stopped.';
  return 'Connect your computer to start monitoring.';
}
