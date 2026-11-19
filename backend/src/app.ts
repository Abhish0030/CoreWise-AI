import { knowledgeRoutes } from './modules/knowledge/routes.js';
import { optimizationRoutes } from './modules/functional/optimization-routes.js';
import { functionalRoutes } from './modules/functional/routes.js';
import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import { healthSchema, systemStatusSchema } from '@corewise/types';
import { checkDatabase } from './lib/db.js';
import { ApiError } from './lib/errors.js';
import { authRoutes, invalidCsrfTokenError } from './modules/auth/routes.js';
import { hardwareRoutes } from './modules/hardware/routes.js';
import { Prisma } from '@prisma/client';
import { openapiDocument } from './lib/openapi.js';
import { workloadRoutes } from './modules/workloads/routes.js';
import { analyticalRoutes } from './modules/analytical/routes.js';
import { mlRoutes } from './modules/ml/routes.js';
import { publicationRoutes } from './modules/ml/publication.js';
import { explanationRoutes } from './modules/explanations/routes.js';
import { benchmarkRoutes, agentRoutes } from './modules/benchmarks/routes.js';
import { assistantRoutes, assistantInternalRoutes } from './modules/assistant/routes.js';
import { reportRoutes } from './modules/reports/routes.js';
import { workspaceRoutes } from './modules/workspace/routes.js';

export function createApp(databaseCheck: () => Promise<void> = checkDatabase) {
  const app = express();
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY === 'loopback') app.set('trust proxy', 'loopback');
  app.use(helmet());
  app.use(
    pinoHttp({
      level: process.env.LOG_LEVEL ?? 'info',
      redact: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["x-csrf-token"]',
        'req.headers["x-agent-grant"]',
        'res.headers["set-cookie"]',
      ],
    }),
  );
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 300,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: {
        error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again shortly.' },
      },
    }),
  );
  app.use('/api/ml/datasets', express.json({ limit: '2200kb' }));
  app.use(express.json({ limit: '32kb' }));

  app.get('/api/health', (_req, res) => {
    res.json(
      healthSchema.parse({ status: 'ok', service: 'corewise-api', database: 'not_checked' }),
    );
  });
  app.get('/api/ready', async (req, res) => {
    try {
      await databaseCheck();
      res.json(
        healthSchema.parse({ status: 'ok', service: 'corewise-api', database: 'connected' }),
      );
    } catch (err) {
      req.log.warn({ err }, 'Database readiness check failed');
      res.status(503).json(
        healthSchema.parse({
          status: 'unavailable',
          service: 'corewise-api',
          database: 'unavailable',
        }),
      );
    }
  });
  app.get('/api/system/status', (_req, res) => {
    res.json(
      systemStatusSchema.parse({
        milestone: 'M1',
        monitoring: 'DISCONNECTED',
        model: 'NOT_TRAINED',
        profiles: 0,
      }),
    );
  });
  app.get('/api/openapi.json', (_req, res) => {
    res.json(openapiDocument());
  });
  app.use('/internal/agent', assistantInternalRoutes());
  app.use('/api', authRoutes());
  app.use('/api/agent', assistantRoutes());
  app.use('/api/reports', reportRoutes());
  app.use('/api/workspace', workspaceRoutes());
  app.use('/api/hardware', functionalRoutes());
  app.use('/api/optimization', optimizationRoutes());
  app.use('/api/hardware-profiles', hardwareRoutes());
  app.use('/api/workloads', workloadRoutes());
  app.use('/api', analyticalRoutes());
  app.use('/api/ml', mlRoutes());
  app.use('/api/ml/publications', publicationRoutes());
  app.use('/api/explanations', explanationRoutes());
  app.use('/api/benchmarks', benchmarkRoutes());
  app.use('/api/agent', agentRoutes());
  app.use('/api/knowledge', knowledgeRoutes());
  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });
  const errorHandler: express.ErrorRequestHandler = (err: unknown, req, res, _next) => {
    if (err === invalidCsrfTokenError)
      return void res.status(403).json({
        error: {
          code: 'CSRF_INVALID',
          message: 'Your security token expired. Please try again.',
        },
      });
    if (err instanceof ApiError)
      return void res.status(err.status).json({
        error: {
          code: err.code,
          message: err.message,
          ...(err.fields ? { fields: err.fields } : {}),
        },
      });
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025')
      return void res
        .status(404)
        .json({ error: { code: 'NOT_FOUND', message: 'Record not found.' } });
    if (err instanceof SyntaxError)
      return void res
        .status(400)
        .json({ error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } });
    if (typeof err === 'object' && err !== null && 'type' in err && err.type === 'entity.too.large')
      return void res
        .status(413)
        .json({ error: { code: 'BODY_TOO_LARGE', message: 'Request is too large.' } });
    req.log.error({ err }, 'Request failed');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
  };
  app.use(errorHandler);
  return app;
}
