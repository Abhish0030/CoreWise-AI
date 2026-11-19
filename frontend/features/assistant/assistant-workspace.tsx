'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Send, Square, Trash2, MessageSquare, Bot, ChevronRight } from 'lucide-react';
import {
  agentConversationListSchema,
  agentConversationResponseSchema,
  agentMessagesSchema,
  agentStatusSchema,
  hardwareListSchema,
  workloadListSchema,
  modelListSchema,
  benchmarkRunListSchema,
  type CurrentUser,
  type AgentEvent,
  type AgentMessage,
} from '@corewise/types';
import { apiData, apiRequest, ApiClientError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { streamAssistant } from './stream';
import { EvidenceSummary } from './evidence-summary';
import { AssistantMarkdown } from './markdown';
const suggestions = [
  'Analyze my hardware.',
  'Should I use CPU or GPU for this workload?',
  'Explain my latest benchmark.',
  'Why is my GPU slower?',
  'Compare predicted and actual execution times.',
  'Explain my SHAP results.',
  'Find my performance bottleneck.',
  'Suggest optimizations.',
  "Explain my model's accuracy.",
  'Generate a summary of my latest results.',
];
export function AssistantWorkspace({ user }: { user: CurrentUser }) {
  const client = useQueryClient();
  const [selected, setSelected] = useState(''),
    [draft, setDraft] = useState(''),
    [search, setSearch] = useState(''),
    [hardwareId, setHardwareId] = useState(user.selectedProfileId ?? user.defaultProfileId ?? ''),
    [workloadId, setWorkloadId] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [partial, setPartial] = useState(''),
    [activities, setActivities] = useState<Extract<AgentEvent, { type: 'tool' }>[]>([]),
    [deleteId, setDeleteId] = useState<string | null>(null),
    [retryText, setRetryText] = useState('');
  const controller = useRef<AbortController | null>(null),
    transcript = useRef<HTMLDivElement>(null),
    dialog = useRef<HTMLDialogElement>(null);
  const key = ['agent-conversations', user.id];
  const conversations = useQuery({
    queryKey: key,
    queryFn: () => apiData('/api/agent/conversations', agentConversationListSchema),
  });
  const status = useQuery({
    queryKey: ['agent-status', user.id],
    queryFn: () => apiData('/api/agent/status', agentStatusSchema),
  });
  const hardware = useQuery({
    queryKey: ['hardware-profiles', user.id],
    queryFn: () => apiData('/api/hardware-profiles', hardwareListSchema),
  });
  const workloads = useQuery({
    queryKey: ['workloads', user.id],
    queryFn: () => apiData('/api/workloads', workloadListSchema),
  });
  const models = useQuery({
    queryKey: ['ml-models', user.id],
    queryFn: () => apiData('/api/ml/models', modelListSchema),
  });
  const runs = useQuery({
    queryKey: ['agent-benchmarks', user.id],
    queryFn: () => apiData('/api/benchmarks/runs', benchmarkRunListSchema),
  });
  const active = selected || conversations.data?.data[0]?.id;
  const messages = useQuery({
    queryKey: ['agent-messages', user.id, active],
    queryFn: () =>
      apiData(
        `/api/agent/conversations/${encodeURIComponent(active!)}/messages`,
        agentMessagesSchema,
      ),
    enabled: !!active,
    refetchInterval: (q) =>
      q.state.data?.data.some((m) => m.status === 'STREAMING') ? 2000 : false,
  });
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight;
  }, [partial, activities.length]);
  async function create() {
    setError('');
    try {
      const r = await apiData('/api/agent/conversations', agentConversationResponseSchema, {
        method: 'POST',
        body: JSON.stringify({ title: 'New conversation' }),
      });
      setSelected(r.data.id);
      setPartial('');
      setActivities([]);
      await client.invalidateQueries({ queryKey: key });
      return r.data.id;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create conversation.');
    }
  }
  async function send(content = draft) {
    if (!content.trim() || busy || !conversations.isSuccess || (!!active && !messages.isSuccess))
      return;
    setBusy(true);
    setError('');
    setPartial('');
    setActivities([]);
    setRetryText(content);
    const id = active || (await create());
    if (!id) {
      setBusy(false);
      return;
    }
    const abort = new AbortController();
    controller.current = abort;
    setDraft('');
    try {
      await streamAssistant(
        id,
        {
          content: content.trim(),
          context: {
            ...(hardwareId ? { hardwareProfileId: hardwareId } : {}),
            ...(workloadId ? { workloadId } : {}),
          },
        },
        abort.signal,
        (event) => {
          if (event.type === 'start')
            void client.invalidateQueries({ queryKey: ['agent-messages', user.id, id] });
          if (event.type === 'chunk') setPartial((p) => p + event.text);
          if (event.type === 'tool') setActivities((p) => [...p, event]);
        },
      );
      setRetryText('');
    } catch (e) {
      setError(
        abort.signal.aborted
          ? 'Response stopped. Partial content is retained.'
          : e instanceof Error
            ? e.message
            : 'Assistant failed.',
      );
    } finally {
      controller.current = null;
      setBusy(false);
      await Promise.all([
        client.invalidateQueries({ queryKey: ['agent-messages', user.id, id] }),
        client.invalidateQueries({ queryKey: key }),
        client.invalidateQueries({ queryKey: ['agent-status', user.id] }),
      ]);
    }
  }
  async function remove() {
    if (!deleteId) return;
    setError('');
    controller.current?.abort();
    try {
      await apiRequest(`/api/agent/conversations/${encodeURIComponent(deleteId)}`, {
        method: 'DELETE',
      });
      if (active === deleteId) setSelected('');
      setDeleteId(null);
      dialog.current?.close();
      setPartial('');
      setActivities([]);
      await client.invalidateQueries({ queryKey: key });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete conversation.');
    }
  }
  const configured = status.data?.data.configured ?? false;
  const authenticationRequired =
    status.error instanceof ApiClientError && status.error.status === 401;
  const conversationReady = conversations.isSuccess && (!active || messages.isSuccess);
  const saved = messages.data?.data ?? [];
  return (
    <div className="dashboard assistant-workspace">
      <div className="page-heading">
        <div>
          <div className="eyebrow">GROUNDED IN YOUR WORKSPACE</div>
          <h1>
            AI Assistant<span className="title-dot">.</span>
          </h1>
          <p>Ask about your hardware, workloads and performance evidence.</p>
        </div>
        <span className="badge">M6 · LANGGRAPH</span>
      </div>
      <div className={`notice ${!configured ? 'assistant-unavailable' : ''}`} role="status">
        <strong>
          {authenticationRequired
            ? 'Authentication required — sign in again.'
            : (status.data?.data.message ??
              (status.isPending
                ? 'Checking provider connection…'
                : 'AI Assistant unavailable — configure an LLM provider.'))}
        </strong>
        {configured && (
          <span>
            {' '}
            · {status.data?.data.model} · {status.data?.data.connection.replaceAll('_', ' ')}
          </span>
        )}
        <p>
          Tools retrieve your authorized records. Estimates, predictions, measurements and SHAP keep
          their own sources. No benchmark executes from chat.
        </p>
        {!hardware.isPending && !hardware.data?.data.length && (
          <p>
            No hardware profile. <Link href="/hardware-library">Add or import hardware →</Link>
          </p>
        )}
        {!runs.isPending && !runs.data?.data.length && (
          <p>
            No benchmark evidence.{' '}
            <Link href="/benchmark-lab">Pair a runner and authorize a bounded measurement →</Link>
          </p>
        )}
      </div>
      <div className="assistant-layout">
        <aside className="panel assistant-conversations" aria-label="Conversations">
          <Button onClick={() => void create()} disabled={busy}>
            <Plus size={16} /> New conversation
          </Button>
          <div className="field">
            <label htmlFor="conversation-search">Search conversations</label>
            <input
              id="conversation-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search saved chats…"
              aria-describedby="conversation-search-help"
            />
          </div>
          <small id="conversation-search-help" className="muted">
            Find saved chats. To ask a question, use Message CoreWise.
          </small>
          {conversations.isPending ? (
            <div
              role="status"
              className="skeleton explanation-loading"
              aria-label="Loading conversations"
            />
          ) : !conversations.data?.data.length ? (
            <p className="muted">No conversations yet.</p>
          ) : (
            conversations.data.data
              .filter((c) => c.title.toLowerCase().includes(search.toLowerCase()))
              .map((c) => (
                <div
                  className={`assistant-conversation ${active === c.id ? 'is-active' : ''}`}
                  key={c.id}
                >
                  <button
                    className="assistant-conversation-select"
                    disabled={busy}
                    onClick={() => {
                      setSelected(c.id);
                      setPartial('');
                      setActivities([]);
                      setError('');
                    }}
                  >
                    <MessageSquare size={15} />
                    <span>
                      {c.title}
                      <small>{new Date(c.updatedAt).toLocaleDateString()}</small>
                    </span>
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Delete ${c.title}`}
                    onClick={() => {
                      setDeleteId(c.id);
                      dialog.current?.showModal();
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))
          )}
        </aside>
        <section className="panel assistant-chat" aria-label="Chat">
          <div className="assistant-chat-heading">
            <Bot size={20} />
            <div>
              <h2>CoreWise Intelligence</h2>
              <p className="muted">Your evidence, with context.</p>
            </div>
            <span className="badge">
              {busy
                ? 'WORKING'
                : status.isPending
                  ? 'CONNECTING'
                  : authenticationRequired
                    ? 'AUTHENTICATION REQUIRED'
                    : configured
                      ? status.data?.data.connection === 'ERROR'
                        ? 'PROVIDER ERROR'
                        : 'READY'
                      : 'UNAVAILABLE'}
            </span>
          </div>
          {(error || messages.isError || conversations.isError) && (
            <div className="form-error" role="alert">
              {error || 'Could not load conversation history.'}
              {retryText && !busy && (
                <Button
                  variant="outline"
                  onClick={() => void send(retryText)}
                  disabled={!configured}
                >
                  Retry message
                </Button>
              )}
            </div>
          )}
          <form
            className="assistant-composer"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <label htmlFor="assistant-message">Message CoreWise</label>
            <textarea
              id="assistant-message"
              maxLength={4000}
              rows={3}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Type your question here…"
              disabled={busy || !configured || !conversationReady}
            />
            <div>
              <small className="muted">
                Enter to send · Shift+Enter for a new line. Don’t share credentials.
              </small>
              {busy ? (
                <Button type="button" variant="outline" onClick={() => controller.current?.abort()}>
                  <Square size={14} /> Stop response
                </Button>
              ) : (
                <Button type="submit" disabled={!configured || !draft.trim() || !conversationReady}>
                  <Send size={15} /> Send message
                </Button>
              )}
            </div>
          </form>
          <div
            ref={transcript}
            className="assistant-messages"
            role="log"
            aria-label="Conversation messages"
            tabIndex={0}
            aria-live="polite"
            aria-busy={busy}
          >
            {messages.isPending && active ? (
              <div
                role="status"
                className="skeleton explanation-loading"
                aria-label="Loading messages"
              />
            ) : !saved.length && !busy ? (
              <div className="assistant-welcome">
                <Bot size={32} />
                <h3>Start with a question.</h3>
                <p className="muted">
                  Type a message above or choose a question below to send it. The assistant
                  retrieves your authorized records when needed.
                </p>
                <div className="assistant-suggestions">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      disabled={!configured || !conversationReady || busy}
                      onClick={() => void send(s)}
                    >
                      {s}
                      <ChevronRight size={15} />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              saved
                .filter((m) => !busy || m.role === 'USER' || m.status !== 'STREAMING')
                .map((m) => <MessageCard key={m.id} message={m} />)
            )}
            {busy && (
              <article className="assistant-message assistant-message-assistant">
                <span className="eyebrow">COREWISE · STREAMING</span>
                {activities.map((a, i) => (
                  <div className="assistant-tool-activity" key={i}>
                    {a.name.replaceAll('_', ' ')} · {a.status.toLowerCase()}
                  </div>
                ))}
                <AssistantMarkdown
                  text={partial || 'Retrieving context and preparing a response…'}
                />
              </article>
            )}
          </div>
        </section>
        <aside className="panel assistant-context" aria-label="Selected context">
          <span className="eyebrow">WORKSPACE CONTEXT</span>
          <h2>Ground the conversation</h2>
          <div className="field">
            <label htmlFor="assistant-hardware">Hardware profile</label>
            <select
              id="assistant-hardware"
              value={hardwareId}
              onChange={(e) => setHardwareId(e.target.value)}
              disabled={busy}
            >
              <option value="">Selected/default profile</option>
              {hardware.data?.data.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="assistant-workload">Workload</label>
            <select
              id="assistant-workload"
              value={workloadId}
              onChange={(e) => setWorkloadId(e.target.value)}
              disabled={busy}
            >
              <option value="">Let the assistant retrieve</option>
              {workloads.data?.data.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <h3>Active models</h3>
          {models.data?.data.filter((m) => m.active).length ? (
            models.data.data
              .filter((m) => m.active)
              .map((m) => (
                <p key={m.id}>
                  {m.target} · {m.algorithm}
                  <small className="muted">
                    {m.provenance} · {m.version.slice(0, 8)}
                  </small>
                </p>
              ))
          ) : (
            <p className="muted">No active models.</p>
          )}
          <h3>Benchmark evidence</h3>
          <p>{runs.data?.data.length ?? 0} saved measured runs</p>
          <Link href="/benchmark-lab">Review measurements →</Link>
          <h3>Prediction & SHAP sources</h3>
          <p className="muted">
            Retrieved references appear on each response. SHAP contributions use ln(ms), not
            millisecond differences.
          </p>
          <Link href="/explainability">Open Explainability →</Link>
          {(hardware.isError || workloads.isError || models.isError || runs.isError) && (
            <p role="alert" className="form-error">
              Some context is unavailable. Retry by reloading.
            </p>
          )}
        </aside>
      </div>
      <dialog ref={dialog} onCancel={() => setDeleteId(null)} className="profile-dialog">
        <h2>Delete conversation?</h2>
        <p>This removes its messages and tool history.</p>
        <div className="dialog-actions">
          <Button
            variant="outline"
            onClick={() => {
              setDeleteId(null);
              dialog.current?.close();
            }}
          >
            Cancel
          </Button>
          <Button onClick={() => void remove()}>Delete conversation</Button>
        </div>
      </dialog>
    </div>
  );
}
function MessageCard({ message: m }: { message: AgentMessage }) {
  return (
    <article
      className={`assistant-message assistant-message-${m.role.toLowerCase()}`}
      data-testid={`agent-message-${m.role.toLowerCase()}`}
    >
      <div className="section-heading">
        <span className="eyebrow">{m.role === 'USER' ? 'YOU' : 'COREWISE'}</span>
        <small className="muted">{m.status}</small>
      </div>
      {m.role === 'ASSISTANT' ? (
        <AssistantMarkdown
          text={m.content || 'No response content.'}
          links={m.references.map((r) => r.href)}
        />
      ) : (
        <p className="assistant-message-text">{m.content || 'No response content.'}</p>
      )}
      {m.error && <p className="form-error">{m.error}</p>}
      {m.tools.map((t) => (
        <div key={t.id}>
          <EvidenceSummary data={t.result?.data} />
          <details className="assistant-tool-card">
            <summary>
              {t.name.replaceAll('_', ' ')} · {t.result?.provenance ?? t.status}
            </summary>
            {t.result?.notice && <p className="muted">{t.result.notice}</p>}
            <p className="muted">
              {Object.entries(t.result?.units ?? {})
                .map(([key, v]) => `${key}: ${v}`)
                .join(' · ')}
            </p>
            <pre className="ml-code">{JSON.stringify(t.result?.data, null, 2)}</pre>
          </details>
        </div>
      ))}
      {!!m.references.length && (
        <div className="assistant-references" aria-label="Source references">
          {m.references.map((r) => (
            <Link key={`${r.type}:${r.id}`} href={r.href}>
              {r.label} · {r.provenance}
            </Link>
          ))}
        </div>
      )}
    </article>
  );
}
