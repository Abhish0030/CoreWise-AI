# M6 — bounded agent architecture

The assistant is a real LangGraph execution in the existing private Python service, using LangChain's ChatOpenAI adapter. M0–M5 remain separate capabilities. There is no benchmark-execution, model-training, arbitrary code, SQL, shell, filesystem, generic HTTP or write tool. M7 reports and deployment work are not included.

## Graph and limits

`Router → Tool Execution → Router (if needed) → Response Generation`

The router binds thirteen explicit function schemas. A turn permits at most two tool rounds, six total calls and eight graph iterations. Tools run sequentially, with individual 20-second deadlines; provider calls use 25-second deadlines and zero automatic retries. The Python graph deadline is 75 seconds; Express aborts at 80 seconds and database grants expire at 90 seconds. Expired STREAMING messages become FAILED on subsequent owned history/submission reads. Only one live turn per user is admitted under a PostgreSQL user-row lock.

Router completions are capped at 256 tokens per call; final response generation is capped at 1024. The latest ten completed user/assistant messages, each at most 4000 characters, enter the prompt. The current user message is included in that limit. A cl100k_base tokenizer check rejects more than 12,000 serialized context tokens per provider invocation; model-specific token accounting may differ. Tool payloads are capped at 24,000 serialized characters per call and 32,000 combined, and answer text at 16,000 characters. Oversized data fails explicitly rather than corrupting/truncating numerical JSON. The UI/history API reads the latest 100 messages per conversation; older stored messages are retained until deletion and are not automatically replayed.

Usage metadata, where returned, sums provider input/output/total token counts across router and response calls and is stored with the assistant message. Exact cost accounting, billing estimates and missing-provider usage inference are not implemented.

## Provider configuration

Private environment variables:

| Variable                      | Purpose                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------ |
| LLM_PROVIDER                  | `openai-compatible` enables the tool-capable chat-completions adapter                |
| LLM_API_KEY                   | Private provider key; never NEXT_PUBLIC or browser storage                           |
| LLM_MODEL                     | Explicit model identifier supporting function/tool calls                             |
| LLM_BASE_URL                  | Optional operator-controlled compatible `/v1` endpoint; omitted uses adapter default |
| AGENT_API_ORIGIN              | Private callback origin for Express, default http://127.0.0.1:4000                   |
| ML_ORIGIN / ML_INTERNAL_TOKEN | Existing private Python service connection and trusted bearer credential             |

Use HTTPS for remote provider endpoints and a private authenticated network/TLS for service traffic. Never configure an endpoint from a browser message. With incomplete provider configuration the exact UI state is **AI Assistant unavailable — configure an LLM provider.** No response is synthesized as a replacement. Status distinguishes UNCONFIGURED, NOT_CHECKED, CONNECTED and ERROR. CONNECTED means a provider call completed in this private service process; configuration alone does not imply connectivity. Model changes normally require a service restart. Provider failures emit generic safe errors without exposing upstream exception bodies, URLs, keys or request payloads. A test-only protocol server is used in automated tests; no external paid/live provider request is claimed.

## Authorization flow

Browser → Next `/api` rewrite → Express database session/owner scope/CSRF → bearer-authenticated private FastAPI agent.

Express generates an opaque random turn grant and stores only its SHA-256 along with the existing session ID, CSRF-header hash, owner conversation, context, tool count and expiry on the assistant message. The grant and CSRF value travel as runtime transport credentials to Python and its callback headers; neither enters the model prompt, tool arguments, conversation content or browser SSE. No session cookie is forwarded to Python or the model.

Python calls only the fixed Express `/internal/agent/tools` endpoint using the internal bearer credential plus turn grant and original session-bound CSRF header. Express independently checks the grant, expiry, original database session, user ownership, runner exclusion and atomic six-call budget. It chooses the owner from the persisted conversation, never an LLM/browser-supplied user ID. Resource queries include that owner. Tool names and arguments pass strict Zod validation. An internal credential alone cannot authorize a personal tool call. Revoked/expired sessions and ended turns cannot use grants. Terminal transitions clear grant/CSRF/session transport fields.

This internal callback is mounted before browser session middleware because it uses explicit delegated session authentication; it is not an unauthenticated CSRF bypass. It accepts only the allowlist and cannot route arbitrary personal API requests. All conversation creation/deletion/message/stream writes still use the ordinary session-bound CSRF middleware. Runner-only M4 sessions retain their original endpoints and cannot access these personal routes.

## Tool registry

| Tool                                          | Source and behavior                                                            |
| --------------------------------------------- | ------------------------------------------------------------------------------ |
| list_hardware_profiles / get_hardware_profile | Owned public hardware schema, USER_ENTERED specs, selected/default lookup      |
| list_workloads / get_workload                 | Owned saved configurations, explicit assumptions and units                     |
| get_analytical_comparison                     | Latest/specified saved M2 COMPARISON record, ANALYTICAL                        |
| run_analytical_estimate                       | Reuses the M2 estimator and owned input resolver without saving a comparison   |
| list_active_models                            | Owned READY active CPU/GPU registry metadata, including training provenance    |
| get_ml_prediction                             | Latest/specified owned immutable M3 prediction and model references            |
| run_ml_prediction                             | Reuses actual M3 feature resolution/inference without saving a prediction      |
| list_benchmark_runs / get_benchmark_run       | Actual M4 records with correctness, raw samples, timing scopes and environment |
| get_prediction_explanation                    | Completed local M5 result by prediction ID, or latest owned result             |
| get_global_feature_importance                 | Completed global M5 result by model ID, or latest owned result                 |

Calculation previews use saved explicit workload assumptions and selected/owned hardware. The agent cannot invent throughput, infer FLOPS from GHz, alter assumptions through arguments, or substitute analytical output for missing ML. A changed hardware selection does not calibrate saved capability assumptions. Users should review/edit those assumptions in Workload Analyzer before interpreting previews. SHAP tools read existing completed outputs; they do not silently queue new jobs. Missing records/models/explanations produce structured UNAVAILABLE data, not replacement values.

Every result has availability, provenance, explicit units, structured data, notice and server-generated record references. Calculated previews cite their source workload/hardware/model records and never invent a saved result ID. Links open the corresponding implemented application page; not every page supports a record-specific deep link. Express persists tool arguments, result, status and duration under the assistant message. Streaming cards/references are verified against these persisted results before being forwarded, so the LLM cannot manufacture structured citations.

## Persistence and retention

Seventh additive migration `20261115100000_m6_agent_conversations` adds AgentConversation, AgentMessage and AgentToolCall, owner/history indexes, message sequence ordering, grant uniqueness and cascading relationships. No reset or destructive data migration is used. Deleting a conversation removes all its messages and tool evidence; account deletion cascades through the owner relationship. Conversation creation is capped at 100 per owner. Eight new turns per minute per user are enforced in PostgreSQL under the same row lock as turn admission, across API instances. Recent-context bounds do not delete old messages automatically. Deployment-specific retention policy and conversation export are future decisions.

## SSE protocol

Authenticated POST `/api/agent/conversations/:id/stream` (also POST `.../messages`) uses fetch streaming with the existing HttpOnly cookie and CSRF header. GET endpoints never start graph work. Structured events are:

- `start`: persisted assistant message ID.
- `tool`: allowlisted name, STARTED/COMPLETED/FAILED and optional verified structured result.
- `chunk`: response text.
- `metadata`: provider/model and available aggregate usage.
- `complete`: message persisted COMPLETED, with ID.
- `error`: safe error code/message; no completion claim.

Responses use no-store/no-transform and disable proxy buffering. Express applies backpressure and size validation. Disconnect/Stop aborts the upstream request; Python async cancellation propagates through the graph/provider callback. Partial emitted text persists with CANCELLED/FAILED status; network success is not assumed when the stream ends without `complete`. If the API process dies, the persisted expiry makes the interrupted turn visible as failed on a subsequent read. Deleting a conversation removes its grants/evidence; the UI also stops its active request.

Provider-generated text is buffered before chunk emission so credentials split across provider chunks cannot bypass redaction. Tool activity streams while work runs, but final text does not appear token-by-token during provider generation. This is an explicit latency tradeoff. Remote providers may continue billed work briefly after cancellation; hard remote cancellation is provider-dependent.

## Provenance and injection defenses

The fixed system policy treats all user/history/context/retrieved names, descriptions and metadata as untrusted data. Retrieved content is delivered as tool messages, never promoted to system instructions. Prompt content cannot change the allowlist, user scope, callback URL, budgets or permission checks. Tests include malicious descriptions, user override requests, forbidden tools, forged owners and unknown arguments. No LangChain deserialization of model-generated configurations or arbitrary code is used.

Passwords/session cookies/internal keys are not retrieved into prompts. Known configured secrets and common credential assignments/Bearer/key patterns are redacted before persistence and provider use, and before output. Redaction walks string values before JSON serialization to preserve valid structured payloads. This is best-effort filtering, not a comprehensive secret/DLP classifier: users should not paste sensitive credentials. Transport headers are redacted from HTTP logs. Provider error bodies are not persisted or streamed.

The policy distinguishes MEASURED, USER_ENTERED, SYNTHETIC_DEMO, PREDICTED, ANALYTICAL and SHAP_MODEL_ATTRIBUTION. Benchmarks require matching scopes/configurations before comparisons. Synthetic-trained models do not establish real accuracy. SHAP remains grouped transformed-feature attribution in **ln(ms)** with separate device baselines, not additive millisecond differences, ratio attribution or physical causality. Advice must cite retrieved evidence and acknowledge missing information. Prompt defenses cannot guarantee that arbitrary model prose never hallucinates; structured evidence/cards remain the auditable source.

## Verification boundary

Agent Python tests exercise the actual graph with deterministic mock chat models. API tests run the actual Python service, real LangChain provider adapter, PostgreSQL sessions, callback authorization and SSE against a test-only OpenAI-protocol server. Browser tests use the same isolated provider fixture with actual application data. M6 browser setup creates an exact test-owned Argon2 account and real PostgreSQL session using express-session’s existing cookie-signing library, avoiding an extra registration attempt after the preserved suites exhaust the unchanged auth limit. Ordinary application session/CSRF checks remain active; no production test bypass or relaxed rate limit exists. Test servers are never reused from a live development session. This validates the integration protocol, not external provider credentials, model quality or production infrastructure. See STATUS for executed commands/results. M7 remains unimplemented.
# Groq integration update

The follow-up provider integration extends the existing architecture to 19 tools and actual sanitized final-response chunks. See [GROQ-INTEGRATION.md](GROQ-INTEGRATION.md) for current configuration, limits, security boundaries and live-verification requirements. Earlier counts above describe the original M6 implementation; reports now use completed M7 routes.

