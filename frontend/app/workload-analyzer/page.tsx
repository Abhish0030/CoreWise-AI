import { requireSession, privateApi } from '@/lib/server-auth';
import { workloadResponseSchema } from '@corewise/types';
import { notFound } from 'next/navigation';
import { WorkloadStudio } from '@/features/workloads/workload-studio';
export default async function WorkloadPage({
  searchParams,
}: {
  searchParams: Promise<{ workload?: string | string[] }>;
}) {
  const user = await requireSession('/workload-analyzer');
  const { workload } = await searchParams;
  let initialWorkload;
  if (typeof workload === 'string' && workload.length <= 100) {
    const response = await privateApi(`/api/workloads/${encodeURIComponent(workload)}`);
    if (response.status === 404) notFound();
    if (!response.ok) throw new Error('Could not load this workload.');
    initialWorkload = workloadResponseSchema.parse(await response.json()).data;
  }
  return <WorkloadStudio user={user} initialWorkload={initialWorkload} />;
}
