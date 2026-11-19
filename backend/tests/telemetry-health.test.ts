import { expect, it } from 'vitest';
import { freshSelectedAgent, monitorStatus } from '../../frontend/lib/telemetry-health.js';
import { connectionSchema } from '@corewise/types';

it('expires the selected runner and rejects failed requests, unbound runners and stale captures', () => {
  const now = Date.parse('2026-11-19T00:00:00Z');
  const connection = connectionSchema.parse({
    data: {
      selectedAgentId: 'selected',
      profileMatched: true,
      agents: [
        {
          id: 'selected',
          name: 'Test fixture',
          status: 'FRESH',
          receivedAt: new Date(now).toISOString(),
          telemetry: {
            version: 'cw-telemetry-1',
            provenance: 'MEASURED',
            capturedAt: new Date(now).toISOString(),
            cpuUtilizationPercent: 0,
            ramUsedBytes: 1,
            ramTotalBytes: 2,
            cpuTemperatureC: null,
            gpu: null,
            cpuSource: 'psutil',
            temperatureSource: null,
            limitations: [],
          },
        },
      ],
    },
  });
  expect(monitorStatus(undefined, false, now)).toBe('Loading runner state…');
  expect(monitorStatus(connection, true, now)).toBe(
    'Runner API unavailable. Retry the connection.',
  );
  expect(monitorStatus(connection, false, now)).toBe('Telemetry online.');
  expect(monitorStatus(connection, false, now + 15001)).toBe(
    'Telemetry offline — waiting for fresh measurements.',
  );
  expect(monitorStatus({ data: { ...connection.data, agents: [] } }, false, now)).toBe(
    'Connect your computer to start monitoring.',
  );
  expect(
    monitorStatus(
      {
        data: {
          ...connection.data,
          agents: connection.data.agents.map((a) => ({
            ...a,
            status: 'AWAITING_TELEMETRY',
            receivedAt: null,
            telemetry: null,
          })),
        },
      },
      false,
      now,
    ),
  ).toBe('Device connected — monitoring stopped.');
  expect(freshSelectedAgent(connection, false, now)?.id).toBe('selected');
  expect(freshSelectedAgent(connection, false, now + 15001)).toBeUndefined();
  expect(freshSelectedAgent(connection, true, now)).toBeUndefined();
  connection.data.selectedAgentId = 'another';
  expect(freshSelectedAgent(connection, false, now)).toBeUndefined();
  connection.data.selectedAgentId = 'selected';
  connection.data.agents[0]!.telemetry!.capturedAt = new Date(now - 16000).toISOString();
  expect(freshSelectedAgent(connection, false, now)).toBeUndefined();
});
