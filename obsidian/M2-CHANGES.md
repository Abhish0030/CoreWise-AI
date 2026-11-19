# M2 implementation inventory

M2 implements saved workload configuration, deterministic analytical estimation, and CPU/GPU comparison. M0/M1 authentication, hardware management, themes, navigation, migrations, and test coverage are preserved. No M3 training, SHAP, or agent service is implemented.

## Added files

| Area                                     | Files                                                                                                      |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Shared contracts and presets             | `packages/types/src/m2.ts`                                                                                 |
| Estimator and analytical persistence API | `backend/src/modules/analytical/model.ts`, `backend/src/modules/analytical/routes.ts`                    |
| Workload API                             | `backend/src/modules/workloads/routes.ts`                                                                 |
| Math and API tests                       | `backend/tests/analytical.test.ts`, `backend/tests/m2.test.ts`                                           |
| Protected pages                          | `frontend/app/workload-analyzer/page.tsx`, `frontend/app/cpu-vs-gpu/page.tsx`                              |
| Configuration UI                         | `frontend/features/workloads/workload-studio.tsx`, `frontend/features/workloads/capability-fields.tsx`     |
| Comparison UI/charts                     | `frontend/features/comparison/comparison-workspace.tsx`, `result-view.tsx`, `charts.tsx` in that directory |
| Presentation-only unit formatting        | `frontend/lib/format-time.ts`                                                                              |
| Browser tests                            | `tests/e2e/m2.spec.ts`                                                                                     |
| Migration                                | `backend/prisma/migrations/20261112080000_m2_workloads_analytical/migration.sql`                                   |
| Documentation                            | `obsidian/M2-ANALYTICAL-MODEL.md`, this inventory                                                              |

## Modified files

- `backend/prisma/schema.prisma`: owned workloads and analytical records, foreign keys, owner/time indexes, composite owned-ID keys.
- `packages/types/src/index.ts`: exports M2 contracts without changing M1 definitions.
- `backend/src/app.ts`: mounts authenticated M2 routes after the existing session/CSRF middleware.
- `backend/src/lib/openapi.ts`: adds shared-schema M2 endpoints and API-document version 0.3.0. Existing endpoint contracts are retained, including the legacy `/api/system/status` M1 capability envelope.
- `frontend/app/[section]/page.tsx`: removes implemented M2 destinations from future-feature generation; updates version metadata.
- `frontend/components/app-shell.tsx`: updates workspace milestone/version labels; preserves navigation interactions.
- `frontend/features/auth/auth-form.tsx`: allows the two protected M2 destinations as safe post-login return routes.
- `frontend/features/overview/dashboard.tsx`: recent owned workloads, latest real analytical comparison, actual calculated times/ratio/recommendation, and quick analysis links. No invented history.
- `frontend/lib/server-auth.ts`: reusable cookie-forwarding, no-store private API fetch for saved workload links.
- `frontend/app/globals.css`: M2 layout, forms, cards, charts, responsive rules, and readable result details using existing tokens.
- `tests/e2e/helpers.ts`: exact-identity cleanup for the M2 fixture workspace.
- `tests/e2e/foundation.spec.ts`: retained navigation test now expects the working analytical page rather than its former planned-M2 placeholder.
- `AGENTS.md`, `obsidian/PRODUCT_SPEC.md`, `obsidian/STATUS.md`, `obsidian/architecture.md`, `README.md`: current scope, model/service boundaries, setup, review routes, and verified results.

No new external dependency was needed. Existing pinned React Hook Form, Zod, Recharts, TanStack Query, and Prisma packages are reused. M1 tests remain unchanged.

## API endpoints

All M2 routes require a valid database session. Writes also require the existing session-bound CSRF header and pass the existing Origin/Fetch Metadata controls. Successful JSON responses retain `{data: ...}`; errors use the established `{error: {code, message, fields?}}` format.

| Method/path                     | Behavior                                                    |
| ------------------------------- | ----------------------------------------------------------- |
| `GET /api/workloads`            | Current user's saved workloads, most recently updated first |
| `POST /api/workloads`           | Validate and create a workload (201)                        |
| `GET /api/workloads/:id`        | Retrieve an owned workload                                  |
| `PATCH /api/workloads/:id`      | Patch top-level fields; validate the merged configuration   |
| `DELETE /api/workloads/:id`     | Delete owned workload (204), retain historical snapshots    |
| `POST /api/analytical/estimate` | Calculate and save an ESTIMATE record (201)                 |
| `POST /api/analytical/compare`  | Calculate and save a COMPARISON record (201)                |
| `GET /api/comparisons`          | Owned COMPARISON history, newest first                      |
| `GET /api/comparisons/:id`      | Retrieve one owned COMPARISON record                        |

Analytical request fields: `workloadId`, optional `hardwareProfileId` override, full `assumptions`, and `tolerance`. Assumptions are explicit per run; null values remain unknown. Without an override, profile resolution uses the saved workload, then selected/default profile. Missing a profile returns 422; foreign resource IDs return 404. Missing performance capabilities produce a saved `INSUFFICIENT_DATA` result with explicit fields rather than invented numbers.

Workload configuration includes all requested descriptive, operation/intensity, parallelism, memory/transfer, repetition, and hardware fields, plus saved capability assumptions/tolerance and optional preset source. Duplication uses a new POST of the editable configuration. A PATCH replaces a nested assumptions object as a whole rather than recursively patching individual capabilities.

## Database migration

`20261112080000_m2_workloads_analytical` adds `Workload` and `ComparisonResult`; no existing table data is reset. One immutable analytical-record table holds ESTIMATE and COMPARISON kinds to avoid duplicating snapshot/result storage. User deletion cascades records; source workload/hardware deletion nulls live references while preserving immutable JSON snapshots, assumptions, model version, provenance, and timestamp. Existing M0/M1 migrations remain unchanged.

## Tests

- 14 mathematical/model tests: Amdahl, roofline, units, transfer policy, CPU/GPU/similar decisions, additive breakdowns, no double-counted CPU parallelism, missing data, capacity, deterministic outputs, presets, invalid inputs, zero/boundary cases.
- 11 PostgreSQL API tests: workload lifecycle, duplication, partial updates, ownership across all endpoints, invalid/spoofed inputs, input provenance, estimates, comparisons/history, immutable snapshot preservation, effective run overrides, authentication, and CSRF.
- 6 M2 browser tests: full workload lifecycle, editable preset, analysis/charts, real dashboard activity, CPU-faster and missing-capability states, profile changes, and four viewport sizes in both themes.
- Existing 22 M0/M1 API tests and 14 M0/M1 browser checks remain part of the verification suite. See `obsidian/STATUS.md` for actual command results.

M2 browser cases share one generated fixture account but clear only that exact fixture user's workload/profile records between cases. This respects the real authentication rate limiter without a test-only bypass. No real user records are deleted and the database is never reset.

## Limits

See [the mathematical model](M2-ANALYTICAL-MODEL.md). Estimates assume idealized uniform operations/traffic, per-core scaling, within-stage compute/memory overlap, no transfer overlap/reuse, and one launch per repetition. Presets remain illustrative; sorting is a FLOP-equivalent surrogate. Unknown capabilities/capacity are explicit. Search/history is currently loaded per user without pagination. No measured benchmarks or predictions from a trained model are generated. Production deployment/TLS, expanded accessibility auditing, and the missing original design reference remain prior configuration limits.
