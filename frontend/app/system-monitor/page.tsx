import { requireSession } from '@/lib/server-auth';
import { TelemetryWorkspace } from '@/features/functional/telemetry-workspace';
export default async function SystemMonitorPage() {
  const user = await requireSession('/system-monitor');
  return <TelemetryWorkspace user={user} />;
}
