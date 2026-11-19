import { requireSession } from '@/lib/server-auth';
import { SettingsWorkspace } from '@/features/settings/settings-workspace';
export default async function SettingsPage() {
  const user = await requireSession('/settings');
  return <SettingsWorkspace user={user} />;
}
