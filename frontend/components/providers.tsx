'use client';
import {
  QueryClient,
  QueryClientProvider,
  HydrationBoundary,
  type DehydratedState,
} from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { useState } from 'react';
export function Providers({
  children,
  state,
}: {
  children: React.ReactNode;
  state: DehydratedState;
}) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }),
  );
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={client}>
        <HydrationBoundary state={state}>{children}</HydrationBoundary>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
