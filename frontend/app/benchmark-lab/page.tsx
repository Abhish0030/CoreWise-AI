import { requireSession } from '@/lib/server-auth';
import { BenchmarkLab } from '@/features/benchmarks/benchmark-lab';
export default async function BenchmarkPage() {
  const user = await requireSession('/benchmark-lab');
  return <BenchmarkLab user={user} />;
}
