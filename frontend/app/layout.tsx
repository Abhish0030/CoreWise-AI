import type { Metadata } from 'next';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/manrope/800.css';
import './globals.css';
import { Providers } from '@/components/providers';
import { WorkspaceFrame } from '@/components/app-shell';
import { QueryClient, dehydrate } from '@tanstack/react-query';
import { resolveSession } from '@/lib/server-auth';
export const metadata: Metadata = {
  title: 'CoreWise AI · Hardware Intelligence',
  description:
    'Intelligence Behind Every Compute Decision. A hardware and workload analytics workspace.',
};
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  client.setQueryData(['current-user'], await resolveSession());
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers state={dehydrate(client)}>
          <WorkspaceFrame>{children}</WorkspaceFrame>
        </Providers>
      </body>
    </html>
  );
}
