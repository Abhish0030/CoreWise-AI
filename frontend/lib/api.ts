import { apiErrorSchema, csrfResponseSchema } from '@corewise/types';
import type { z } from '@corewise/types';

export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public fields?: Record<string, string[]>,
  ) {
    super(message);
  }
}
export async function apiRequest(path: string, init: RequestInit = {}): Promise<unknown> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  if (init.method && !['GET', 'HEAD'].includes(init.method)) {
    const csrf = await fetch('/api/auth/csrf', { credentials: 'same-origin', cache: 'no-store' });
    if (!csrf.ok)
      throw new ApiClientError(
        'Could not initialize a secure session. Please try again.',
        csrf.status,
      );
    const payload = csrfResponseSchema.parse(await csrf.json());
    headers.set('x-csrf-token', payload.data.token);
  }
  const response = await fetch(path, {
    ...init,
    headers,
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(await response.json().catch(() => null));
    throw new ApiClientError(
      parsed.success ? parsed.data.error.message : 'The service is unavailable. Please try again.',
      response.status,
      parsed.success ? parsed.data.error.fields : undefined,
    );
  }
  return response.status === 204 ? undefined : response.json();
}
export async function apiData<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  return schema.parse(await apiRequest(path, init));
}
