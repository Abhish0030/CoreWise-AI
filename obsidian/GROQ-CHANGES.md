# Groq change inventory

This follow-up changes the existing assistant and shared evidence boundaries; it adds no milestone or database migration. Existing repository relocation changes are outside this inventory.

| Files                                                                                                                                | Purpose                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `backend/ml/agent/provider.py` (new)                                                                                                 | Validated Groq/legacy settings, existing-client initialization, supported request parameters, safe provider failure mapping |
| `backend/ml/agent/system-prompt.md` (new)                                                                                            | Versioned evidence, provenance, scope, injection and uncertainty policy                                                     |
| `backend/ml/agent/runtime.py`                                                                                                        | Provider selection, 19 tool schemas, actual final-response streaming, split-secret redaction and reported usage             |
| `backend/ml/corewise_ml/app.py`                                                                                                      | Startup provider validation without an external request                                                                     |
| `backend/src/modules/assistant/tools.ts`, `safety.ts`                                                                                | Six additional owner-scoped tools, correct source units/provenance, bounded metadata and Groq secret patterns               |
| `backend/src/modules/functional/routes.ts`, `optimization-routes.ts`, `optimization.ts`                                              | Shared read-only telemetry/optimization implementations and near-zero comparison guards                                     |
| `frontend/features/assistant/markdown.tsx` (new), `assistant-workspace.tsx`, `evidence-summary.tsx`, `frontend/app/globals.css`      | Safe Markdown/code blocks, starters/readiness and optimization evidence UI                                                  |
| `frontend/package.json`, `pnpm-lock.yaml`                                                                                            | Exact Markdown dependencies and resolved lockfile                                                                           |
| `.env.example`, `deploy/production.env.example`, `scripts/check-production.mjs`                                                      | Server-only Groq examples and production configuration checks                                                               |
| `backend/ml/tests/test_groq.py` (new), `test_agent.py`                                                                               | Mocked official-protocol client, graph, streaming, redaction and provider failure tests                                     |
| `backend/tests/m6.test.ts`, `functional.test.ts`, `production.test.ts`                                                               | New tools, metadata ownership, telemetry freshness and provider configuration regressions                                   |
| `tests/fixtures/llm-provider.ts`, `tests/e2e/m6.spec.ts`                                                                             | Test-only Markdown provider response, safe rendering, durable reload and hydration checks                                   |
| `README.md`, `obsidian/GROQ-INTEGRATION.md` (new), `PROJECT-OVERVIEW.md`, `PRODUCT_SPEC.md`, `M6-AGENT-ARCHITECTURE.md`, `STATUS.md` | Startup, configuration, audit, architecture, demonstration, limitations and actual verification                             |

The ignored local `.env` received only nonsecret provider defaults and a blank key entry if absent; existing credentials were preserved. No credentials, model artifacts, generated output or database volume should be committed.

The final runner formatting check also normalized whitespace in `backend/local-agent/tests/test_functional.py`; test behavior is unchanged.

Review `/ai-assistant` after signing in. Underlying sources remain available at `/hardware-library`, `/workload-analyzer`, `/system-monitor`, `/ml-predictions`, `/benchmark-lab`, `/explainability` and `/reports`. Live Groq completion requires the separate verification described in [GROQ-INTEGRATION.md](GROQ-INTEGRATION.md).
