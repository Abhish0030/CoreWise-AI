import { requireSession } from '@/lib/server-auth';
import { AssistantWorkspace } from '@/features/assistant/assistant-workspace';
export default async function AssistantPage() {
  const user = await requireSession('/ai-assistant');
  return <AssistantWorkspace user={user} />;
}
