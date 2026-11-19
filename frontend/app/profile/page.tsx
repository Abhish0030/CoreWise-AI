import { requireSession } from '@/lib/server-auth';
import { UserProfile } from '@/features/auth/profile-page';
export default async function ProfilePage() {
  const user = await requireSession('/profile');
  return <UserProfile user={user} />;
}
