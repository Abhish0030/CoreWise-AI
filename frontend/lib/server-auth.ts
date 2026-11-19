import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { userResponseSchema } from '@corewise/types';
import { cache } from 'react';

export async function privateApi(path: string) {
  const incoming = await headers();
  return fetch(`${process.env.API_ORIGIN ?? 'http://127.0.0.1:4000'}${path}`, {
    headers: { cookie: incoming.get('cookie') ?? '' },
    cache: 'no-store',
  });
}

// Request-scoped only: the layout and protected page share Express's public user
// projection, never a process-wide session cache or browser-only auth snapshot.
export const resolveSession = cache(async () => {
  if (!(await headers()).get('cookie')) return null;
  const response = await privateApi('/api/auth/me');
  if (response.status === 401) return null;
  if (!response.ok) throw new Error('Authentication service is unavailable. Please try again.');
  return userResponseSchema.parse(await response.json()).data;
});

export async function requireSession(destination: string) {
  const user = await resolveSession();
  if (!user) redirect(`/login?next=${encodeURIComponent(destination)}`);
  return user;
}
