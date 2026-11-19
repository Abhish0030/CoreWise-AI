import { requireSession } from '@/lib/server-auth';
import { MLWorkspace } from '@/features/ml/ml-workspace';
export default async function MLPredictionsPage() {
  const user = await requireSession('/ml-predictions');
  return <MLWorkspace user={user} />;
}
