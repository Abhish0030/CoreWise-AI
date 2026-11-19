'use client';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { connectionSchema } from '@corewise/types';
import { apiData } from '@/lib/api';
import { freshSelectedAgent } from '@/lib/telemetry-health';

export function useTelemetry(userId: string | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const connection = useQuery({
    queryKey: ['hardware-connection', userId],
    queryFn: () => apiData('/api/hardware/connection', connectionSchema),
    enabled: !!userId,
    refetchInterval: 5000,
    retry: false,
  });
  const live = userId ? freshSelectedAgent(connection.data, connection.isError, now) : undefined;
  return { connection, live, telemetry: live?.telemetry ?? null, now };
}
