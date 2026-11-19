import {
  z,
  connectionSchema,
  hardwareImportSchema,
  optimizationInputSchema,
  optimizationResponseSchema,
  telemetrySampleSchema,
  registerSchema,
  loginSchema,
  profileUpdateSchema,
  userResponseSchema,
  csrfResponseSchema,
  hardwareInputSchema,
  hardwareResponseSchema,
  hardwareListSchema,
  apiErrorSchema,
  healthSchema,
  systemStatusSchema,
  workloadInputSchema,
  workloadPatchSchema,
  workloadResponseSchema,
  workloadListSchema,
  analyticalRequestSchema,
  comparisonResponseSchema,
  comparisonListSchema,
  benchmarkJobInputSchema,
  benchmarkJobResponseSchema,
  benchmarkJobListSchema,
  benchmarkRunResponseSchema,
  benchmarkRunListSchema,
  benchmarkExportSchema,
  pairCodeSchema,
  agentListSchema,
  datasetInputSchema,
  datasetListSchema,
  datasetResponseSchema,
  trainingInputSchema,
  jobListSchema,
  jobResponseSchema,
  modelListSchema,
  modelResponseSchema,
  predictionInputSchema,
  predictionListSchema,
  predictionResponseSchema,
  explanationInputSchema,
  explanationResponseSchema,
  explanationListSchema,
  globalExplanationResponseSchema,
  agentConversationInputSchema,
  agentConversationListSchema,
  agentConversationResponseSchema,
  agentMessageInputSchema,
  agentMessagesSchema,
  agentStatusSchema,
  agentEventSchema,
  reportInputSchema,
  reportResponseSchema,
  reportListSchema,
  reportPreviewSchema,
  reportSourcesSchema,
  workspaceSummarySchema,
} from '@corewise/types';

function content(schema: z.ZodType) {
  return {
    'application/json': { schema: z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) },
  };
}
function operation(
  summary: string,
  options: {
    input?: z.ZodType;
    output?: z.ZodType;
    status?: number;
    private?: boolean;
    write?: boolean;
  } = {},
) {
  return {
    summary,
    security: options.private
      ? [{ sessionCookie: [], ...(options.write ? { csrfToken: [] } : {}) }]
      : options.write
        ? [{ csrfToken: [] }]
        : [],
    ...(options.input ? { requestBody: { required: true, content: content(options.input) } } : {}),
    responses: {
      [options.status ?? 200]: {
        description: 'Success',
        ...(options.output ? { content: content(options.output) } : {}),
      },
      ...Object.fromEntries(
        [400, 401, 403, 404, 409, 429, 500].map((status) => [
          status,
          { description: 'Error', content: content(apiErrorSchema) },
        ]),
      ),
    },
  };
}
const idParameter = { name: 'id', in: 'path', required: true, schema: { type: 'string' } };
export function openapiDocument() {
  return {
    openapi: '3.1.0',
    info: {
      title: 'CoreWise AI Workspace API',
      version: '0.8.0',
      description:
        'M1 personal routes require a signed session cookie. Obtain a session-bound CSRF token from /api/auth/csrf before all writes, including registration and login. Public M0 health/capability responses keep their original envelope.',
    },
    components: {
      securitySchemes: {
        sessionCookie: {
          type: 'apiKey',
          in: 'cookie',
          name: process.env.NODE_ENV === 'production' ? '__Host-corewise.sid' : 'corewise.sid',
        },
        csrfToken: { type: 'apiKey', in: 'header', name: 'x-csrf-token' },
      },
    },
    paths: {
      '/api/hardware/connection': {
        get: operation(
          'Owner-scoped fresh/stale/expired local telemetry; stale readings withheld',
          { private: true, output: connectionSchema },
        ),
      },
      '/api/hardware/import-hardware': {
        post: operation(
          'Import detected properties only from an active owned runner and select the profile',
          {
            private: true,
            write: true,
            input: hardwareImportSchema,
            output: hardwareResponseSchema,
            status: 201,
          },
        ),
      },
      '/api/optimization/preview': {
        post: operation(
          'Evidence-ranked analytical/ML/measured recommendation and sampled crossover; no hardware execution',
          {
            private: true,
            write: true,
            input: optimizationInputSchema,
            output: optimizationResponseSchema,
          },
        ),
      },
      '/api/optimization/run': {
        post: operation(
          'Save available analytical comparison and exact-version ML prediction, with optimization evidence',
          {
            private: true,
            write: true,
            input: optimizationInputSchema,
            output: optimizationResponseSchema,
          },
        ),
      },
      '/api/agent/telemetry': {
        post: operation(
          'Runner-only database session and CSRF required; bounded current sensor sample, no personal access',
          { private: true, write: true, input: telemetrySampleSchema },
        ),
      },

      '/api/workspace/summary': {
        get: operation('Authenticated counts and recent owned evidence only', {
          private: true,
          output: workspaceSummarySchema,
        }),
      },
      '/api/reports/sources': {
        get: operation('Latest 100 owned source options per report group', {
          private: true,
          output: reportSourcesSchema,
        }),
      },
      '/api/reports/preview': {
        post: operation(
          'Resolve owned sources and preview a sanitized snapshot; does not persist',
          { private: true, write: true, input: reportInputSchema, output: reportPreviewSchema },
        ),
      },
      '/api/reports': {
        get: operation('Latest 100 owned generated reports', {
          private: true,
          output: reportListSchema,
        }),
        post: operation(
          'Generate immutable snapshot and store PDF/CSV bytes with integrity hashes',
          {
            private: true,
            write: true,
            input: reportInputSchema,
            output: reportResponseSchema,
            status: 201,
          },
        ),
      },
      '/api/reports/{id}': {
        parameters: [idParameter],
        get: operation('Owned report snapshot and export metadata', {
          private: true,
          output: reportResponseSchema,
        }),
        delete: operation('Delete owned report/exports; retain source records', {
          private: true,
          write: true,
          status: 204,
        }),
      },
      '/api/reports/{id}/download': {
        parameters: [
          idParameter,
          {
            name: 'format',
            in: 'query',
            required: false,
            schema: { type: 'string', enum: ['pdf', 'csv'], default: 'pdf' },
          },
        ],
        get: {
          ...operation('Download stored integrity-checked PDF or spreadsheet-safe CSV', {
            private: true,
          }),
          responses: {
            200: {
              description: 'Private attachment with stable export bytes',
              content: {
                'application/pdf': { schema: { type: 'string', format: 'binary' } },
                'text/csv': { schema: { type: 'string' } },
              },
            },
            404: { description: 'Report is absent or not owned' },
            409: { description: 'Stored export integrity failed' },
          },
        },
      },
      '/api/agent/status': {
        get: operation('Private assistant provider configuration and last connection status', {
          private: true,
          output: agentStatusSchema,
        }),
      },
      '/api/agent/conversations': {
        get: operation('Latest 100 owned conversations', {
          private: true,
          output: agentConversationListSchema,
        }),
        post: operation('Create an owned conversation', {
          private: true,
          write: true,
          input: agentConversationInputSchema,
          output: agentConversationResponseSchema,
          status: 201,
        }),
      },
      '/api/agent/conversations/{id}': {
        parameters: [idParameter],
        get: operation('Owned conversation metadata', {
          private: true,
          output: agentConversationResponseSchema,
        }),
        delete: operation('Delete conversation and cascade messages/tool calls', {
          private: true,
          write: true,
          status: 204,
        }),
      },
      '/api/agent/conversations/{id}/messages': {
        parameters: [idParameter],
        get: operation('Latest 100 owned messages with tool evidence', {
          private: true,
          output: agentMessagesSchema,
        }),
        post: {
          ...operation('Send message using the same bounded SSE protocol as /stream', {
            private: true,
            write: true,
            input: agentMessageInputSchema,
          }),
          responses: {
            200: {
              description: 'SSE frames: start, tool, chunk, metadata, complete, error',
              content: { 'text/event-stream': { schema: z.toJSONSchema(agentEventSchema) } },
            },
          },
        },
      },
      '/api/agent/conversations/{id}/stream': {
        parameters: [idParameter],
        post: {
          ...operation(
            'Session + CSRF protected POST SSE. Disconnect cancels upstream; partial/error status persists.',
            { private: true, write: true, input: agentMessageInputSchema },
          ),
          responses: {
            200: {
              description: 'Structured SSE event frames',
              content: { 'text/event-stream': { schema: z.toJSONSchema(agentEventSchema) } },
            },
          },
        },
      },
      '/api/explanations': {
        get: operation('Latest 100 owned explanation jobs and saved results', {
          private: true,
          output: explanationListSchema,
        }),
        post: operation(
          'Queue bounded SHAP calculation for exact saved models; reuse compatible cached results',
          {
            private: true,
            write: true,
            input: explanationInputSchema,
            output: explanationResponseSchema,
            status: 202,
          },
        ),
      },
      '/api/explanations/{id}': {
        parameters: [idParameter],
        get: operation('Owned SHAP job status, errors, background references and contributions', {
          private: true,
          output: explanationResponseSchema,
        }),
      },
      '/api/explanations/prediction/{predictionId}': {
        parameters: [{ ...idParameter, name: 'predictionId' }],
        get: operation('Owned saved prediction explanation history', {
          private: true,
          output: explanationListSchema,
        }),
      },
      '/api/explanations/global/{modelId}': {
        parameters: [{ ...idParameter, name: 'modelId' }],
        get: operation('Latest owned global explanation; GET never starts computation', {
          private: true,
          output: globalExplanationResponseSchema,
        }),
      },
      '/api/benchmarks/catalog': {
        get: operation('Allowlisted benchmark catalog and versioned semantics', { private: true }),
      },
      '/api/benchmarks/pairing': {
        post: operation('Create a one-time ten-minute pairing code', {
          private: true,
          write: true,
          output: pairCodeSchema,
          status: 201,
        }),
      },
      '/api/benchmarks/agents': {
        get: operation('Owned paired devices and detected metadata', {
          private: true,
          output: agentListSchema,
        }),
      },
      '/api/benchmarks/agents/{id}/revoke': {
        parameters: [idParameter],
        post: operation('Revoke a runner and cancel its pending jobs', {
          private: true,
          write: true,
          status: 204,
        }),
      },
      '/api/benchmarks/jobs': {
        get: operation('Owned benchmark job status/history', {
          private: true,
          output: benchmarkJobListSchema,
        }),
        post: operation('Explicitly queue a bounded allowlisted benchmark', {
          private: true,
          write: true,
          input: benchmarkJobInputSchema,
          output: benchmarkJobResponseSchema,
          status: 201,
        }),
      },
      '/api/benchmarks/jobs/{id}': {
        parameters: [idParameter],
        get: operation('Owned benchmark job status', {
          private: true,
          output: benchmarkJobResponseSchema,
        }),
      },
      '/api/benchmarks/jobs/{id}/cancel': {
        parameters: [idParameter],
        post: operation('Request cancellation; queued work cancels immediately', {
          private: true,
          write: true,
          status: 204,
        }),
      },
      '/api/benchmarks/runs': {
        get: operation('Immutable owned measured benchmark history', {
          private: true,
          output: benchmarkRunListSchema,
        }),
      },
      '/api/benchmarks/runs/{id}': {
        parameters: [idParameter],
        get: operation('Owned raw timing samples, validation and environment', {
          private: true,
          output: benchmarkRunResponseSchema,
        }),
      },
      '/api/benchmarks/export.csv': {
        get: operation('Export raw measurements, including missing GPU targets', { private: true }),
      },
      '/api/benchmarks/export-dataset': {
        post: operation('Build versioned measured M3 CSV; report missing targets/features', {
          private: true,
          write: true,
          input: benchmarkExportSchema,
        }),
      },
      '/api/benchmarks/datasets': {
        post: operation('Validate and save measured samples to the M3 dataset pipeline', {
          private: true,
          write: true,
          input: benchmarkExportSchema,
          status: 201,
        }),
      },
      '/api/ml/dataset-schema': {
        get: operation('Versioned CSV columns, units and validation policy', { private: true }),
      },
      '/api/ml/datasets': {
        get: operation('List owned immutable dataset versions', {
          private: true,
          output: datasetListSchema,
        }),
        post: operation('Validate CSV or generate labeled synthetic data', {
          private: true,
          write: true,
          input: datasetInputSchema,
          output: datasetResponseSchema,
          status: 201,
        }),
      },
      '/api/ml/datasets/{id}': {
        parameters: [idParameter],
        get: operation('Owned dataset validation and preview', {
          private: true,
          output: datasetResponseSchema,
        }),
      },
      '/api/ml/training-jobs': {
        get: operation('List owned durable training jobs', {
          private: true,
          output: jobListSchema,
        }),
        post: operation('Queue CPU/GPU fitting without blocking the request', {
          private: true,
          write: true,
          input: trainingInputSchema,
          output: jobResponseSchema,
          status: 202,
        }),
      },
      '/api/ml/training-jobs/{id}': {
        parameters: [idParameter],
        get: operation('Owned training job status and logs', {
          private: true,
          output: jobResponseSchema,
        }),
      },
      '/api/ml/models': {
        get: operation('Owned model registry and version history', {
          private: true,
          output: modelListSchema,
        }),
      },
      '/api/ml/models/{id}': {
        parameters: [idParameter],
        get: operation('Owned fitted model details and evaluation', {
          private: true,
          output: modelResponseSchema,
        }),
      },
      '/api/ml/models/{id}/activate': {
        parameters: [idParameter],
        post: operation('Explicitly activate or deactivate one owned target version', {
          private: true,
          write: true,
          input: z.object({ active: z.boolean() }).strict(),
          output: modelResponseSchema,
        }),
      },
      '/api/ml/predict': {
        post: operation(
          'Predict with compatible active fitted pipelines and save immutable history',
          {
            private: true,
            write: true,
            input: predictionInputSchema,
            output: predictionResponseSchema,
            status: 201,
          },
        ),
      },
      '/api/ml/predictions': {
        get: operation('Owned prediction history', { private: true, output: predictionListSchema }),
      },
      '/api/ml/predictions/{id}': {
        parameters: [idParameter],
        get: operation('Owned immutable prediction snapshot', {
          private: true,
          output: predictionResponseSchema,
        }),
      },
      '/api/workloads': {
        get: operation('List owned workloads', { output: workloadListSchema, private: true }),
        post: operation('Save a workload; presets remain illustrative', {
          input: workloadInputSchema,
          output: workloadResponseSchema,
          status: 201,
          private: true,
          write: true,
        }),
      },
      '/api/workloads/{id}': {
        parameters: [idParameter],
        get: operation('Retrieve an owned workload', {
          output: workloadResponseSchema,
          private: true,
        }),
        patch: operation('Patch top-level workload fields; merged configuration is validated', {
          input: workloadPatchSchema,
          output: workloadResponseSchema,
          private: true,
          write: true,
        }),
        delete: operation('Delete workload while preserving analysis snapshots', {
          status: 204,
          private: true,
          write: true,
        }),
      },
      '/api/analytical/estimate': {
        post: operation(
          'Calculate and save an analytical estimate; never a measured or ML result',
          {
            input: analyticalRequestSchema,
            output: comparisonResponseSchema,
            status: 201,
            private: true,
            write: true,
          },
        ),
      },
      '/api/analytical/compare': {
        post: operation('Calculate and save a CPU/GPU analytical comparison', {
          input: analyticalRequestSchema,
          output: comparisonResponseSchema,
          status: 201,
          private: true,
          write: true,
        }),
      },
      '/api/comparisons': {
        get: operation('List owned immutable comparison snapshots', {
          output: comparisonListSchema,
          private: true,
        }),
      },
      '/api/comparisons/{id}': {
        parameters: [idParameter],
        get: operation('Retrieve one owned comparison snapshot', {
          output: comparisonResponseSchema,
          private: true,
        }),
      },
      '/api/health': { get: operation('Process liveness', { output: healthSchema }) },
      '/api/ready': {
        get: {
          ...operation('PostgreSQL readiness', { output: healthSchema }),
          responses: {
            200: { description: 'Connected', content: content(healthSchema) },
            503: { description: 'Unavailable', content: content(healthSchema) },
          },
        },
      },
      '/api/system/status': {
        get: operation('Public capabilities; no personal profile inventory or sensor data', {
          output: systemStatusSchema,
        }),
      },
      '/api/auth/csrf': {
        get: operation('Create or retrieve a session-bound CSRF token', {
          output: csrfResponseSchema,
        }),
      },
      '/api/auth/register': {
        post: operation('Register and establish a new session', {
          input: registerSchema,
          output: userResponseSchema,
          status: 201,
          write: true,
        }),
      },
      '/api/auth/login': {
        post: operation('Sign in and rotate the session identifier', {
          input: loginSchema,
          output: userResponseSchema,
          write: true,
        }),
      },
      '/api/auth/logout': {
        post: operation('Destroy the session and clear its cookie', {
          status: 204,
          private: true,
          write: true,
        }),
      },
      '/api/auth/me': {
        get: operation('Current signed-in user', { output: userResponseSchema, private: true }),
      },
      '/api/account': {
        patch: operation('Update your display name', {
          input: profileUpdateSchema,
          output: userResponseSchema,
          private: true,
          write: true,
        }),
      },
      '/api/hardware-profiles': {
        get: operation('List only the current user’s profiles', {
          output: hardwareListSchema,
          private: true,
        }),
        post: operation('Create a USER_ENTERED hardware profile', {
          input: hardwareInputSchema,
          output: hardwareResponseSchema,
          status: 201,
          private: true,
          write: true,
        }),
      },
      '/api/hardware-profiles/{id}': {
        parameters: [idParameter],
        get: operation('Retrieve an owned profile', {
          output: hardwareResponseSchema,
          private: true,
        }),
        put: operation('Replace an owned profile’s specifications', {
          input: hardwareInputSchema,
          output: hardwareResponseSchema,
          private: true,
          write: true,
        }),
        delete: operation('Delete an owned profile and clear default/selected references', {
          status: 204,
          private: true,
          write: true,
        }),
      },
      '/api/hardware-profiles/{id}/default': {
        parameters: [idParameter],
        post: operation('Set the current user’s one default profile', {
          status: 204,
          private: true,
          write: true,
        }),
      },
      '/api/hardware-profiles/{id}/select': {
        parameters: [idParameter],
        post: operation('Select an owned profile for future analysis', {
          status: 204,
          private: true,
          write: true,
        }),
      },
    },
  };
}
