import { agentEventSchema, csrfResponseSchema, type AgentEvent } from '@corewise/types';
export async function streamAssistant(
  conversationId: string,
  body: unknown,
  signal: AbortSignal,
  onEvent: (event: AgentEvent) => void,
) {
  const token = await fetch('/api/auth/csrf', {
    credentials: 'same-origin',
    cache: 'no-store',
    signal,
  });
  if (!token.ok) throw Error('Could not initialize a secure session.');
  const csrf = csrfResponseSchema.parse(await token.json()).data.token;
  const response = await fetch(
    `/api/agent/conversations/${encodeURIComponent(conversationId)}/stream`,
    {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify(body),
      signal,
    },
  );
  if (!response.ok) {
    const e = await response.json().catch(() => null);
    throw Error(e?.error?.message ?? 'Assistant unavailable.');
  }
  if (!response.body) throw Error('Streaming is unavailable.');
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let buffer = '',
    complete = false;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      if (buffer.length > 100000) throw Error('Stream limit exceeded.');
      let index;
      while ((index = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        const line = frame.split('\n').find((l) => l.startsWith('data: '));
        if (line) {
          const event = agentEventSchema.parse(JSON.parse(line.slice(6)));
          onEvent(event);
          if (event.type === 'complete') complete = true;
          if (event.type === 'error') throw Error(event.message);
        }
      }
    }
    if (!complete) throw Error('The response ended early. Partial content is retained in history.');
  } finally {
    await reader.cancel().catch(() => {});
  }
}
