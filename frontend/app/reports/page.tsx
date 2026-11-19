import { requireSession } from '@/lib/server-auth';
import { ReportsWorkspace } from '@/features/reports/reports-workspace';
export default async function ReportsPage() {
  const user = await requireSession('/reports');
  return <ReportsWorkspace user={user} />;
}
