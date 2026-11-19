import { requireSession } from '@/lib/server-auth';
import { ExplainabilityWorkspace } from '@/features/explainability/explainability-workspace';
export default async function ExplainabilityPage() {
  const user = await requireSession('/explainability');
  return <ExplainabilityWorkspace user={user} />;
}
