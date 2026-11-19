'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { profileUpdateSchema, userResponseSchema, type CurrentUser } from '@corewise/types';
import { useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, UserRound } from 'lucide-react';
import { apiData } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
export function UserProfile({ user }: { user: CurrentUser }) {
  const client = useQueryClient();
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<{ name: string }>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: { name: user.name },
  });
  return (
    <div className="dashboard">
      <div className="page-heading">
        <div>
          <div className="eyebrow">PERSONAL WORKSPACE</div>
          <h1>
            Your profile<span className="title-dot">.</span>
          </h1>
          <p>Your identity and session information.</p>
        </div>
        <UserRound size={28} />
      </div>
      <div className="profile-layout">
        <section className="panel account-panel">
          <h2>Account details</h2>
          <p>Your email identifies your account. Update your display name below.</p>
          <form
            onSubmit={handleSubmit(async (value) => {
              setSaved(false);
              try {
                const result = await apiData('/api/account', userResponseSchema, {
                  method: 'PATCH',
                  body: JSON.stringify(value),
                });
                client.setQueryData(['current-user'], result.data);
                setSaved(true);
              } catch (err) {
                setError('root', { message: err instanceof Error ? err.message : 'Update failed' });
              }
            })}
            noValidate
          >
            <div className="field">
              <label htmlFor="account-name">Full name</label>
              <input
                id="account-name"
                {...register('name')}
                autoComplete="name"
                aria-invalid={!!errors.name}
              />
              {errors.name && <small className="field-error">{errors.name.message}</small>}
            </div>
            <div className="field">
              <label htmlFor="account-email">Email address</label>
              <input id="account-email" type="email" value={user.email} readOnly />
              <small>Email changes are not supported in M1.</small>
            </div>
            {errors.root && (
              <div className="form-error" role="alert">
                {errors.root.message}
              </div>
            )}
            <div className="form-actions">
              <Button disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Save changes'}</Button>
              {saved && (
                <span role="status" className="saved-status">
                  Profile updated.
                </span>
              )}
            </div>
          </form>
        </section>
        <aside className="panel account-panel">
          <ShieldCheck size={28} />
          <h2>Private by design</h2>
          <p>
            Your session is stored in PostgreSQL and expires eight hours after sign-in. Signing out
            invalidates it immediately.
          </p>
          <dl className="account-facts">
            <div>
              <dt>Member since</dt>
              <dd>{new Date(user.createdAt).toLocaleDateString('en-GB', { timeZone: 'UTC' })}</dd>
            </div>
            <div>
              <dt>Hardware provenance</dt>
              <dd>Shown on each hardware profile</dd>
            </div>
          </dl>
          <p className="tiny">
            Manual specifications are USER_ENTERED. Native imports retain MEASURED detection
            snapshots; unsupported specifications remain unknown.
          </p>
        </aside>
      </div>
    </div>
  );
}
