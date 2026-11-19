import { requireSession } from '@/lib/server-auth';
import { HardwareLibrary } from '@/features/hardware/hardware-library';
export default async function HardwareLibraryPage() {
  const user = await requireSession('/hardware-library');
  return <HardwareLibrary user={user} />;
}
