'use client';
import Link from 'next/link';
import { useState } from 'react';
import { LogOut, UserRound } from 'lucide-react';
import { useAuth, useLogout } from './use-auth';
import { Button } from '@/components/ui/button';
export function AccountControls() {
  const auth = useAuth();
  const logout = useLogout();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!auth.data)
    return (
      <Link href="/login" className="button button-outline account-signin">
        Sign in
      </Link>
    );
  return (
    <div className="account-controls">
      <Link
        href="/profile"
        className="avatar"
        title={auth.data.name || auth.data.email}
        aria-label="Your profile"
      >
        <UserRound size={16} aria-hidden="true" />
      </Link>
      <Button
        aria-label="Sign out"
        title="Sign out"
        variant="ghost"
        size="icon"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            await logout();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to sign out');
            setBusy(false);
          }
        }}
      >
        <LogOut size={17} />
      </Button>
      {error && (
        <span className="account-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
