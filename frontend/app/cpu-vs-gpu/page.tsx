import { requireSession } from '@/lib/server-auth';
import { ComparisonWorkspace } from '@/features/comparison/comparison-workspace';
export default async function ComparisonPage({
  searchParams,
}: {
  searchParams: Promise<{ comparison?: string | string[] }>;
}) {
  const user = await requireSession('/cpu-vs-gpu');
  const params = await searchParams;
  const id =
    typeof params.comparison === 'string' && params.comparison.length <= 100
      ? params.comparison
      : undefined;
  return <ComparisonWorkspace user={user} initialId={id} />;
}
