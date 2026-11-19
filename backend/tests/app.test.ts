import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

describe('foundation API', () => {
  it('reports liveness without claiming database connectivity', async () => {
    const response = await request(createApp()).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.database).toBe('not_checked');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
  it('checks the database for readiness', async () => {
    const response = await request(createApp(async () => {})).get('/api/ready');
    expect(response.status).toBe(200);
    expect(response.body.database).toBe('connected');
  });
  it('fails readiness without leaking database errors', async () => {
    const response = await request(
      createApp(async () => {
        throw new Error('private connection string');
      }),
    ).get('/api/ready');
    expect(response.status).toBe(503);
    expect(response.body.database).toBe('unavailable');
    expect(response.text).not.toContain('private connection string');
  });
  it('does not manufacture hardware metrics', async () => {
    const response = await request(createApp()).get('/api/system/status');
    expect(response.body).toEqual({
      milestone: 'M1',
      monitoring: 'DISCONNECTED',
      model: 'NOT_TRAINED',
      profiles: 0,
    });
  });
  it('returns JSON for unknown routes', async () => {
    expect((await request(createApp()).get('/api/missing')).status).toBe(404);
  });
});
