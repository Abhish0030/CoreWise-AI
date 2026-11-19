# CoreWise AI product specification

This file was absent when the M1 task began. It records the requirements from the user's engineering prompt and M1 request; it does not expand the authorized scope.

## Product

The subsequent Neon/pgvector task authorizes safe backups and isolated restores, guarded nonproduction Neon integration, additive vector knowledge storage, pinned CPU embeddings and bounded owner-scoped LangGraph retrieval. Local Docker and all existing personal data/authentication remain. Production data cutover and deployment require separate explicit approval after development verification; no new milestone is introduced.

The subsequent Groq integration task authorizes completing the existing assistant provider adapter, evidence tools, Markdown/streaming UI and associated verification. This extends the existing M6/M7 product without adding another milestone. Credentials remain server-only; live provider verification requires a real configured key and successful tool/evidence/persistence workflow.

The subsequent functional-restoration task authorizes auditing and repairing the existing M0–M7 journey, bounded native telemetry, detected-profile import, reduction/image benchmark kernels, measured collection/training review and evidence-ranked optimization. This is maintenance of the completed product, not a new milestone. Native execution requires explicit authorization; the current user granted bounded collection and measured fitting. Personal data remains owner-scoped and no model is silently activated in an existing account.

CoreWise AI — **Intelligence Behind Every Compute Decision.** A hardware intelligence and workload analysis workspace. Its eventual capabilities include analytical estimates, regression models, benchmarks, SHAP, and a focused LangGraph assistant.

## Existing foundation — M0

Preserve Next.js App Router, strict TypeScript, Express, PostgreSQL/Prisma, pnpm workspaces, shared Zod contracts, reusable UI, responsive navigation, the overview dashboard, locally bundled fonts, Obsidian/Frost/system themes, and meaningful automated tests. All browser API access goes through Express.

## Completed scope — M1

- Registration, login, logout, current user, authenticated session persistence, protected personal routes, user profile page, and validated forms.
- Argon2id password hashing; library-managed signed HttpOnly session cookies; PostgreSQL-backed sessions; SameSite protection; CSRF on every state-changing endpoint including login/registration; auth rate limits; absolute expiry and logout invalidation; no credentials in browser storage and no custom cryptography.
- User-owned hardware profile create/read/update/delete, explicit deletion confirmation, default profile, independent selection for future analysis, search, and configuration filtering.
- Hardware fields: general identity/manufacturer/model/OS/description; CPU manufacturer/model/physical cores/logical processors/base and maximum frequency; GPU manufacturer/model/VRAM/bandwidth/optional compute capability; RAM capacity/type/optional frequency.
- Ownership enforcement on every profile endpoint. User-submitted specifications carry `USER_ENTERED` and are never presented as verified sensor measurements.
- Preserve existing data with migrations, foreign keys, indexes, and constraints. Do not reset the database.
- Match the established design system in both themes, with responsive cards, technical layouts, dialogs, skeletons, validation, empty states, and errors.
- Verify API/auth/ownership/data workflows, production builds, and relevant browser behavior. Update `obsidian/STATUS.md` with actual outcomes.

The overview and feature descriptions remain public demonstrations. Hardware Library and Your Profile are protected server-rendered personal pages; all personal APIs independently enforce authentication. Unimplemented future-feature pages expose no user data. M2 personal pages are protected as described below.

## Data provenance

Allowed values: `MEASURED`, `USER_ENTERED`, `SYNTHETIC_DEMO`, `PREDICTED`, `ANALYTICAL`. No browser hardware auto-detection. Do not invent telemetry, benchmarks, predictions, model quality, SHAP values, or AI recommendations. The opt-in M0 sensor illustrations remain explicitly `SYNTHETIC_DEMO`.

## Milestones not authorized by M1

- M2: workload forms, persistence, documented analytical estimator, CPU/GPU comparison.
- M3: one Python FastAPI ML/agent service, real CSV ingestion, labeled synthetic training datasets, group-aware regression evaluation, artifact registry, model-backed predictions.
- M4: authorized local benchmark/monitoring agent, measured records, history, CSV export.
- M5: SHAP from real trained artifacts.
- M6: authenticated LangGraph tools, provider configuration, streamed chat, persisted conversations.
- M7: reports, production polish, broader accessibility audit, deployment documentation.

## Completed scope — M2

The user's subsequent M2 task authorizes saved workload creation/editing/duplication/deletion, five editable illustrative presets, explicit hardware/capability selection, deterministic backend Amdahl/roofline estimation, CPU/GPU comparison with transfer and launch overhead, a configurable similarity tolerance, ownership-protected APIs, immutable saved results, dashboard integration, and both-theme responsive forms/charts. Preserve M0/M1 functionality and contracts. Every analytical result includes model version, units, assumptions, timing components, limitations, and `ANALYTICAL` provenance.

The workload and comparison pages are now protected personal pages alongside Hardware Library and Your Profile. Workloads derived from presets remain illustrative and labeled accordingly. Unavailable performance capabilities must be requested explicitly; frequency alone is not a throughput model.

See `obsidian/M2-ANALYTICAL-MODEL.md` for the exact formulas and `obsidian/M2-CHANGES.md` for the implementation boundary. The subsequent M3 task authorizes ML engineering as described below; benchmarking, SHAP and agentic AI remain deferred. The original Armoury Crate screenshot is still missing; its absence is documented in `obsidian/reference/README.md`.

## Completed scope — M3

Private FastAPI ML service and dedicated durable PostgreSQL worker; versioned validated CSV ingestion and reproducible labeled synthetic data; separate CPU/GPU preprocessing and real Linear Regression/Random Forest/XGBoost fitting; grouped train/validation/test evaluation; validation-driven model selection; trusted Joblib artifacts, registry/version history, explicit activation/deactivation; model-backed PREDICTED inference with training provenance and immutable owned history. All browser calls use authenticated Express with existing session/CSRF protections. UI covers datasets, jobs, model readiness/evaluation and prediction, plus independent analytical/ML comparison modes. No real-world accuracy claim follows from synthetic results. See M3-ML-ENGINEERING.md and M3-CHANGES.md. The subsequent M4 task authorizes bounded real local benchmarks as described below; M5–M7 remain deferred.

## Completed scope — M4

Python outbound-only local runner under backend/local-agent, detected hardware metadata, explicit allowlisted NumPy CPU and optional CuPy/CUDA vector-add/matmul/stable-sort measurement, warmups/raw repetitions/aggregation/correctness, compute/transfer/end-to-end scopes, memory/size/deadline/concurrency bounds, cancellation, secure one-time pairing/native vault/scoped database sessions and revocation. Protected Benchmark Lab, owned immutable runs/history/status, raw CSV and M3-compatible measured dataset collection with explicit missing-target/feature rejection. Preserve all M0–M3 behavior. No continuous monitoring, SHAP, assistant or M7 reports. See M4-BENCHMARK-METHODOLOGY.md and M4-CHANGES.md. Stop after M4.

## Completed scope — M5

The subsequent M5 task authorizes real SHAP explanations of fitted Linear Regression, Random Forest and XGBoost artifacts. Preserve M0–M4. Use verified artifact versions and saved prediction snapshots, deterministic training-only backgrounds, held-out global importance, explicit transformed-feature mapping, log-time output units and checked additivity. Persist bounded cached jobs with ownership, existing sessions/CSRF and private service authentication. Add protected explainability views, separate CPU/GPU local waterfalls and global importance comparisons. See M5-SHAP-EXPLAINABILITY.md and M5-CHANGES.md. Stop after M5; M6 agentic AI and M7 remain unauthorized.

## Completed scope — M6

The subsequent M6 task authorizes a small bounded Python LangGraph assistant with an environment-configured real provider adapter, allowlisted authorized tools through Express, owned PostgreSQL conversations/messages/tool evidence, POST SSE, context selection, source references and provenance-aware responses. Preserve M0–M5, ordinary session/CSRF protections and M4 runner isolation. Tools use existing analytical/ML computation or read existing records; no hardware execution, training, arbitrary code/SQL/filesystem/network tools or invented results. Missing provider configuration must be explicit. Automated tests use mocked providers; external-provider verification is claimed only after an actual request succeeds. See M6-AGENT-ARCHITECTURE.md and M6-CHANGES.md.

## Current authorized scope — M7

The subsequent M7 task authorizes owned immutable reports for saved M1–M5 evidence, PDF/CSV exports and print preview, dashboard integration, settings, theme/responsive/accessibility review, security fixes and production-oriented configuration/documentation. Preserve all M0–M6 behavior and provenance. Reports resolve sources through authenticated Express, store sanitized snapshots and exact export bytes in PostgreSQL, and never manufacture missing evidence or initiate computation. Local/global SHAP retains ln(ms) units and non-causal limitations. Configuration examples and deterministic provider mocks are not live deployment/provider verification. See M7-CHANGES.md, DEPLOYMENT.md, DEMO-GUIDE.md, SECURITY-REVIEW.md and STATUS.md for implementation and actual checks. Stop after M7; additional milestones require a new task.
