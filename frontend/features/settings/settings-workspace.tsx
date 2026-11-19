'use client';
import Link from 'next/link';
import { useState, useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  hardwareListSchema,
  agentListSchema,
  workspaceSummarySchema,
  agentStatusSchema,
  profileUpdateSchema,
  userResponseSchema,
  type CurrentUser,
} from '@corewise/types';
import { apiData, apiRequest } from '@/lib/api';
import { useAuth } from '@/features/auth/use-auth';
import { Button } from '@/components/ui/button';
const subscribe = () => () => {};
export function SettingsWorkspace({ user }: { user: CurrentUser }) {
  const client = useQueryClient(),
    auth = useAuth(user),
    { theme, setTheme } = useTheme(),
    mounted = useSyncExternalStore(
      subscribe,
      () => true,
      () => false,
    );
  const [name, setName] = useState(user.name),
    [profile, setProfile] = useState(''),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const hardware = useQuery({
    queryKey: ['hardware-profiles', user.id],
    queryFn: () => apiData('/api/hardware-profiles', hardwareListSchema),
  });
  const summary = useQuery({
    queryKey: ['workspace-summary', user.id],
    queryFn: () => apiData('/api/workspace/summary', workspaceSummarySchema),
  });
  const agents = useQuery({
    queryKey: ['benchmark-agents', user.id],
    queryFn: () => apiData('/api/benchmarks/agents', agentListSchema),
  });
  const provider = useQuery({
    queryKey: ['agent-status', user.id],
    queryFn: () => apiData('/api/agent/status', agentStatusSchema),
    retry: false,
  });
  async function action(kind: 'account' | 'default') {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      if (kind === 'account') {
        const parsed = profileUpdateSchema.safeParse({ name });
        if (!parsed.success) throw Error(parsed.error.issues[0]?.message);
        const r = await apiData('/api/account', userResponseSchema, {
          method: 'PATCH',
          body: JSON.stringify(parsed.data),
        });
        client.setQueryData(['current-user'], r.data);
        setNotice('Account settings saved.');
      } else {
        const id = profile || auth.data?.defaultProfileId;
        if (!id) throw Error('Select an owned hardware profile.');
        await apiRequest(`/api/hardware-profiles/${encodeURIComponent(id)}/default`, {
          method: 'POST',
        });
        await client.invalidateQueries({ queryKey: ['current-user'] });
        setNotice('Default hardware profile saved.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save settings.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="dashboard settings-workspace">
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR WORKSPACE, YOUR PREFERENCES</div>
          <h1>
            Settings<span className="title-dot">.</span>
          </h1>
          <p>Manage existing account and workspace capabilities.</p>
        </div>
        <span className="badge">COREWISE AI · {summary.data?.data.version ?? '0.8.0'}</span>
      </div>
      <div className="settings-grid">
        <section className="panel">
          <h2>Appearance</h2>
          <p className="muted">
            Obsidian, Frost or your system preference. Reduced-motion preferences are respected.
          </p>
          <div className="field">
            <label htmlFor="settings-theme">Theme preference</label>
            <select
              id="settings-theme"
              value={mounted ? theme : 'dark'}
              onChange={(e) => setTheme(e.target.value)}
            >
              <option value="dark">Obsidian</option>
              <option value="light">Frost</option>
              <option value="system">System</option>
            </select>
          </div>
        </section>
        <section className="panel">
          <h2>Account settings</h2>
          <p className="muted">{user.email} · PostgreSQL-backed authenticated session</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void action('account');
            }}
          >
            <div className="field">
              <label htmlFor="settings-name">Display name</label>
              <input
                id="settings-name"
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <Button disabled={busy} type="submit">
              Save account settings
            </Button>
          </form>
          <Link href="/profile">Review profile & session →</Link>
        </section>
        <section className="panel">
          <h2>Default hardware profile</h2>
          <div className="field">
            <label htmlFor="settings-profile">Default hardware</label>
            <select
              id="settings-profile"
              value={profile || auth.data?.defaultProfileId || ''}
              onChange={(e) => setProfile(e.target.value)}
            >
              <option value="" disabled>
                No default profile selected
              </option>
              {hardware.data?.data.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>
          <Button
            disabled={busy || !hardware.data?.data.length}
            onClick={() => void action('default')}
          >
            Save default hardware
          </Button>
          <Link href="/hardware-library">Manage profiles →</Link>
        </section>
        <section className="panel">
          <h2>ML model readiness</h2>
          {summary.isPending ? (
            <div className="skeleton explanation-loading" />
          ) : summary.data?.data.models.length ? (
            summary.data.data.models.map((m) => (
              <p key={m.id}>
                {m.target} · {m.algorithm}
                <small>
                  {m.provenance} · {m.version}
                </small>
              </p>
            ))
          ) : (
            <p className="muted">
              No active models. Train and explicitly activate owned CPU/GPU models.
            </p>
          )}
          <Link href="/ml-predictions">Review model registry →</Link>
        </section>
        <section className="panel">
          <h2>Local benchmark runner</h2>
          {agents.isPending ? (
            <div className="skeleton explanation-loading" />
          ) : agents.data?.data.length ? (
            agents.data.data.map((a) => (
              <p key={a.id}>
                {a.name}
                <small>
                  {a.revokedAt
                    ? 'Revoked'
                    : new Date(a.expiresAt) <= new Date()
                      ? 'Credential expired'
                      : 'Paired'}{' '}
                  · last seen {a.lastSeenAt ? new Date(a.lastSeenAt).toLocaleString() : 'never'}
                </small>
              </p>
            ))
          ) : (
            <p className="muted">No paired benchmark runner.</p>
          )}
          <p className="muted">
            Pairing does not prove a runner is currently online. Execution is explicit; continuous
            telemetry is unavailable.
          </p>
          <Link href="/benchmark-lab">Pair or manage runners →</Link>
        </section>
        <section className="panel">
          <h2>AI provider availability</h2>
          <p>
            {provider.isPending
              ? 'Checking provider…'
              : (provider.data?.data.message ?? 'Provider status unavailable.')}
          </p>
          {provider.data?.data.configured && (
            <p className="muted">
              {provider.data.data.provider} · {provider.data.data.model} ·{' '}
              {provider.data.data.connection}
            </p>
          )}
          <p className="muted">
            Credentials are configured only in the private service environment.
          </p>
          <Link href="/ai-assistant">Open AI Assistant →</Link>
        </section>
      </div>
      {(error || hardware.isError || summary.isError || agents.isError) && (
        <p className="form-error" role="alert">
          {error || 'Some settings data could not be loaded. Reload to retry.'}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <p className="muted">
        Application v{summary.data?.data.version ?? '0.8.0'} · Report export cw-export-1 · No
        browser sensor access
      </p>
    </div>
  );
}
