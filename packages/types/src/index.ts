import { z } from 'zod';
export { z } from 'zod';
export * from './m1.js';
export * from './m2.js';

export const provenanceSchema = z.enum([
  'MEASURED',
  'USER_ENTERED',
  'SYNTHETIC_DEMO',
  'PREDICTED',
  'ANALYTICAL',
]);
export type Provenance = z.infer<typeof provenanceSchema>;

export const systemStatusSchema = z.object({
  milestone: z.literal('M1'),
  monitoring: z.literal('DISCONNECTED'),
  model: z.literal('NOT_TRAINED'),
  profiles: z.literal(0),
});
export type SystemStatus = z.infer<typeof systemStatusSchema>;

export const healthSchema = z.object({
  status: z.enum(['ok', 'unavailable']),
  service: z.literal('corewise-api'),
  database: z.enum(['connected', 'unavailable', 'not_checked']),
});
export * from './m3.js';
export * from './m4.js';
export * from './m5.js';
export * from './m6.js';
export * from './m7.js';
export * from './functional.js';
