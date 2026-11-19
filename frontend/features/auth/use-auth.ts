'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { userResponseSchema, type CurrentUser } from '@corewise/types';
import { apiData, apiRequest, ApiClientError } from '@/lib/api';

export function useAuth(initialUser?: CurrentUser) {
  // The root layout hydrates this key from Express before any consumer renders.
  // Keep revalidation asynchronous; browser storage is not an auth authority.
  return useQuery({
    queryKey: ['current-user'],
    initialData: initialUser,
    queryFn: async () => {
      try {
        return (await apiData('/api/auth/me', userResponseSchema)).data;
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: true,
  });
}
export function useLogout() {
  const client = useQueryClient();
  const router = useRouter();
  return async () => {
    await apiRequest('/api/auth/logout', { method: 'POST' });
    client.clear();
    client.setQueryData(['current-user'], null);
    router.replace('/login');
    router.refresh();
  };
}
