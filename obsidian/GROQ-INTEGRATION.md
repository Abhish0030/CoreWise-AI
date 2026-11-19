# Groq assistant integration

## Audit and implementation

The existing assistant already used LangGraph, ChatOpenAI, authenticated Express callbacks, PostgreSQL conversations and POST SSE. It had 13 evidence tools. Its provider accepted only `openai-compatible`, and no provider credentials were configured locally. Responses were buffered before being divided into SSE chunks. Telemetry, optimization previews, reports and dataset metadata were disconnected from the assistant; messages rendered as plain text.

The implementation preserves that architecture: one existing LangChain client now supports Groq's official OpenAI-compatible endpoint. Six tools connect existing services without granting execution or database access. Final provider chunks flow through bounded secret redaction to SSE; routing requests remain nonstreaming for reliable tool dispatch. Short replies can remain buffered within the redaction tail. Markdown uses escaped React rendering, suppresses images/raw HTML and permits only returned evidence navigation links.

## Local configuration

Obtain an API key from the [Groq console](https://console.groq.com/keys). Store it only in the root local `.env`, never chat, Git or a `NEXT_PUBLIC_` variable:

```dotenv
LLM_PROVIDER=groq
GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-120b
GROQ_BASE_URL=https://api.groq.com/openai/v1
LLM_MAX_OUTPUT_TOKENS=2048
```

Restart the private ML service after editing. Startup validates provider names, endpoint and output bounds; a missing key leaves an explicit unconfigured state. Groq keys are restricted to its official endpoint. The legacy `openai-compatible` provider retains `LLM_API_KEY`, `LLM_MODEL` and optional `LLM_BASE_URL` (remote HTTPS or local HTTP). Never point a real credential at a test fixture.

The preferred model is configurable and requires account verification. Official [model documentation](https://console.groq.com/docs/model/openai/gpt-oss-120b) lists tool support; it does not establish access for this account. The adapter uses Chat Completions, `max_completion_tokens`, temperature 0.1, disabled parallel tool calls and no automatic retry. For GPT-OSS it requests low reasoning effort with `include_reasoning=false`; [Groq documents](https://console.groq.com/docs/reasoning) that GPT-OSS does not support `reasoning_format`. Hidden reasoning is not displayed. Do not select an alternative model without checking actual availability and tool support.

## Boundaries and tools

Browser → Next `/api` rewrite → Express session/CSRF → private FastAPI → LangGraph → Groq. Tools return through a fixed Express callback with an expiring, session/CSRF-bound turn grant. Express owns user scoping and budgets. The model receives bounded evidence, not database access, provider credentials or raw dataset rows. Retrieved records are untrusted data. The versioned prompt is `backend/ml/agent/system-prompt.md`.

The 19 tools cover hardware, workloads, analytical previews, active regression models, saved/previewed ML inference, measured benchmarks, saved local/global SHAP, selected-profile telemetry, optimization previews, report metadata and dataset metadata. New tools: `get_hardware_connection`, `preview_optimization`, `list_reports`, `get_report`, `list_datasets`, `get_dataset`. Optimization invokes the existing shared engine with persistence disabled. No tool schedules benchmarks, fits models, changes settings or executes code. Reports expose existing owner-authorized routes. Stale telemetry is withheld. SHAP remains ln(ms), not additive milliseconds or causal proof.

Limits: six tool calls, two selection rounds, eight graph iterations, ten recent context messages, approximate 12k context tokens, bounded evidence/answer characters, 20-second tool deadline, 25-second provider request timeout, 75-second turn deadline. Output is configurable from 256 to 8192 tokens. Token usage is retained when reported, with an explicit reported flag; monetary cost is not inferred. Cancellation and failures retain partial content, invalidate grants and permit explicit retry.

Groq is the inference service; GPT-OSS is its hosted language model; LangGraph orchestrates bounded tool calls. CoreWise's private fitted CPU/GPU regressors produce numerical predictions. The outbound local runner produces explicitly authorized measurements. The LLM replaces neither regression nor measurement.

## Review and troubleshooting

Sign in, select an owned hardware profile and saved workload, then open `/ai-assistant`. Ask: “Analyze my selected hardware and recommend whether I should run my saved workload on CPU or GPU. Use the optimization preview and cite its evidence.” Inspect source cards, timings, benchmark compatibility, provenance and limitations. Reload to verify persistence. Review `/ml-predictions`, `/benchmark-lab`, `/explainability` and `/reports` for the underlying records. An empty account must produce missing-data guidance, not another owner's evidence. Requesting a new benchmark must direct the user to the normal confirmed runner workflow.

Unconfigured: check server `.env` and restart ML. Provider auth error: check key and model permissions locally. Model unavailable: check account model access. Rate limit: wait and retry explicitly. Timeout/network: check outbound connectivity; do not expose upstream error bodies. Incompatible request: verify model tool support and provider parameters. No hardware/benchmark: create/select hardware or explicitly run a permitted benchmark. Disconnected or stale runner is not live telemetry.

Automated checks: root `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm test:e2e`; Python from `backend/ml`: `.venv/Scripts/python.exe -m pytest tests -q` and `.venv/Scripts/python.exe -m ruff check .`. Provider tests use HTTP mocks with the real adapter; browser fixtures are tests only. They do not prove Groq connectivity.

Live verification requires a real model response, authorized tool callback, evidence in final content, durable conversation reload and actual SSE chunks. These checks passed on 2026-11-18 using Groq `openai/gpt-oss-120b`: 41 SSE chunks, persisted authorized hardware evidence, empty owned dataset guidance and a browser reload without hydration errors. A rate-limited attempt required waiting before retry. Temporary verification accounts were removed; existing personal data was preserved. See STATUS for exact scope and usage. Repeat verification after credential/model/provider changes. Point predictions have no statistical interval unless the underlying model provides one. Existing single-system training evidence does not establish general accuracy.
