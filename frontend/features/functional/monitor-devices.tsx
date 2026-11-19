'use client';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  connectionSchema,
  hardwareListSchema,
  hardwareResponseSchema,
  pairCodeSchema,
} from '@corewise/types';
import { apiData, apiRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';

type Connection = ReturnType<typeof connectionSchema.parse>['data'];
export function MonitorDevices({ connection, userId }: { connection: Connection; userId: string }) {
  const cache = useQueryClient();
  const [ticket, setTicket] = useState<{
    code: string;
    expiresAt: string;
    before: string[];
  } | null>(null);
  const [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const active = connection.agents.filter((a) => a.status !== 'EXPIRED');
  async function refresh() {
    await cache.invalidateQueries({ queryKey: ['current-user'] });
    await cache.invalidateQueries({ queryKey: ['hardware-profiles', userId] });
    await cache.invalidateQueries({ queryKey: ['hardware-connection', userId] });
  }
  const paired = !!ticket && connection.agents.some((a) => !ticket.before.includes(a.id));
  useEffect(() => {
    if (!ticket) return;
    if (paired) {
      void cache.invalidateQueries({ queryKey: ['current-user'] });
      void cache.invalidateQueries({ queryKey: ['hardware-profiles', userId] });
      return;
    }
    const timer = window.setTimeout(
      () => {
        setTicket(null);
        setNotice('Pairing code expired. Generate a new code.');
      },
      Math.max(0, Date.parse(ticket.expiresAt) - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [ticket, paired, cache, userId]);
  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Device request failed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel functional-journey" aria-label="Connect and select devices">
      <h2>{active.length ? 'Your computers' : 'Connect your computer to start monitoring.'}</h2>
      {active.length > 0 && (
        <label className="field">
          Selected device
          <select
            disabled={busy}
            value={connection.selectedAgentId ?? ''}
            onChange={(e) => {
              const id = e.target.value;
              if (!id) return;
              void perform(async () => {
                const profiles = await apiData('/api/hardware-profiles', hardwareListSchema);
                const profile = profiles.data.find((p) => p.detectionSnapshot?.agentId === id);
                if (profile)
                  await apiRequest(`/api/hardware-profiles/${profile.id}/select`, {
                    method: 'POST',
                  });
                else
                  await apiData('/api/hardware/import-hardware', hardwareResponseSchema, {
                    method: 'POST',
                    body: JSON.stringify({
                      agentId: id,
                      name: active.find((a) => a.id === id)!.name,
                      setDefault: false,
                    }),
                  });
                await refresh();
                setNotice('Device selected across your workspace.');
              });
            }}
          >
            <option value="">Select your device…</option>
            {active.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <Button
        disabled={busy || (!!ticket && !paired)}
        onClick={() =>
          void perform(async () => {
            const result = await apiData('/api/benchmarks/pairing', pairCodeSchema, {
              method: 'POST',
              body: '{}',
            });
            setTicket({ ...result.data, before: connection.agents.map((a) => a.id) });
          })
        }
      >
        Connect this computer
      </Button>
      {ticket && !paired && (
        <div role="status">
          <p>
            One-time code (expires in ten minutes): <code>{ticket.code}</code>
          </p>
          <p>Paste this code only into the native pairing prompt on the computer you authorize.</p>
          <pre>pnpm agent pair --url http://127.0.0.1:4000</pre>
          <p>
            Waiting for your device. This page refreshes automatically. The updated agent detects
            hardware and creates/selects your own profile.
          </p>
          <Button variant="outline" onClick={() => setTicket(null)}>
            Hide code
          </Button>
        </div>
      )}
      <details>
        <summary>Install the Windows agent and pair securely</summary>
        <p>
          Run from your CoreWise repository on the computer you want to monitor. Existing
          installations can skip setup. The browser cannot launch the agent.
        </p>
        <pre>
          py -3.13 -m venv backend/local-agent/.venv{'\n'}
          backend/local-agent/.venv/Scripts/python.exe -m pip install -r
          backend/local-agent/requirements.txt{'\n'}pnpm agent pair --url http://127.0.0.1:4000
        </pre>
        <p>
          For a remote backend, replace the loopback origin with its actual HTTPS origin. Pairing
          does not start monitoring or benchmarks.
        </p>
      </details>
      {connection.selectedAgentId && (
        <>
          <h3>Start monitoring on the selected computer</h3>
          <pre>{`pnpm agent monitor --continuous --interval 2 --agent-id ${connection.selectedAgentId}`}</pre>
          <p>
            Stop with Ctrl+C. This command must run on the computer whose native vault holds this
            pairing.
          </p>
        </>
      )}
      {paired && (
        <p role="status">
          Device paired successfully. Your detected profile is ready; start monitoring on that
          computer.
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
