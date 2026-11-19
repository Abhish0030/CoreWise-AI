# M4 change inventory

M4 adds real local CPU/GPU benchmarking and measured dataset collection. M0–M3 remain available. No SHAP, agentic assistant, continuous monitoring or M7 reports were implemented.

## Files added

- `backend/local-agent/requirements.txt`, `requirements.lock.txt`, `requirements-gpu.txt`, `requirements-gpu.lock.txt`, `pyproject.toml`: pinned CPU-only environment and optional CUDA/CuPy environment, Pytest/Ruff configuration.
- `backend/local-agent/corewise_runner/__init__.py`, `__main__.py`, `schema.py`, `detection.py`, `benchmarks.py`, `supervisor.py`, `lock.py`, `client.py`: allowlisted CLI, detected metadata, NumPy/CuPy timing/correctness, process deadline/cancellation, OS execution lock, outbound pairing/session/submission and native OS credential vault storage.
- `backend/local-agent/tests/test_runner.py`: real CPU and GPU correctness, raw samples, aggregation, invalid/nonfinite results, missing GPU, limits/memory checks, cancellation/deadline, transport rules, concurrency and native vault roundtrip tests.
- `packages/types/src/m4.ts`: shared catalog, strict job/measurement contracts, sample/summary/metadata schemas, exports and pairing envelopes.
- `backend/src/modules/benchmarks/routes.ts`, `validation.ts`, `export.ts`: owned benchmark API, scoped runner sessions, one-time pairing/revocation, immutable result admission, independent aggregation and measured CSV/M3 integration.
- `backend/tests/m4.test.ts`: ten PostgreSQL/API cases using an actual CPU runner output; authentication/CSRF/ownership, pairing/replay, runner-only access, concurrency, immutable persistence, invalid samples/correctness, cancellation/failure, raw export and missing-target/feature rejection.
- `frontend/app/benchmark-lab/page.tsx`, `frontend/features/benchmarks/benchmark-lab.tsx`, `measured-result.tsx`: protected Lab with pairing/hardware metadata, bounded configuration, explicit queue/cancel, progress/status, raw history/statistics, Recharts comparisons/distribution/size history, CSV and M3 dataset export.
- `tests/e2e/m4.spec.ts`: seven browser cases including real pairing/session/job/result flow, CPU-only data/export, cancellation, actual paired measurements saved through the M3 validator and four both-theme responsive widths.
- `scripts/run-agent.mjs`: fixed Python module launcher; forwards only argparse-validated CLI arguments without shell execution.
- `backend/prisma/migrations/20261114140000_m4_local_benchmarks/migration.sql`: additive agent/pair/job/run tables and owner/index/uniqueness relationships.
- `obsidian/M4-BENCHMARK-METHODOLOGY.md`, this file.

Ignored review outputs under `backend/local-agent/results/` contain actual local CPU/GPU samples and metadata. They are generated data, not committed fixtures or benchmark claims about other hardware.

## Files modified

- `backend/prisma/schema.prisma`: AgentPairing, LocalAgent, BenchmarkJob and BenchmarkRun with owner relationships, source agent/job linkage, unique result-per-job, expiry/history indexes. Raw samples, summaries and environment snapshots are immutable JSON on BenchmarkRun; the allowlisted BenchmarkDefinition is versioned in code rather than an editable command table. A partial SQL unique index enforces one inflight job per runner.
- `packages/types/src/index.ts`: exports M4 types; existing contracts remain unchanged.
- `backend/src/app.ts`: mounts benchmark/runner routes after existing database session, origin and CSRF middleware.
- `backend/src/modules/auth/session-store.ts`: persists a scoped agentId on runner sessions. It does not grant userId or replace the Prisma session store.
- `backend/src/lib/openapi.ts`: shared-schema documentation for the benchmark API.
- `frontend/features/auth/auth-form.tsx`: safe protected Benchmark Lab return path.
- `frontend/app/[section]/page.tsx`: implemented Benchmark Lab removed from future placeholders; workspace milestone text updated.
- `frontend/components/app-shell.tsx`, `frontend/app/globals.css`: milestone label and responsive measurement forms/cards/charts using existing tokens. Existing themes, navigation and reduced-motion behavior remain intact.
- `package.json`: `pnpm agent` convenience command. No new JavaScript dependency or lockfile update is required.
- `.gitignore`: local measured results and GPU cache artifacts ignored.
- `README.md`, `AGENTS.md`, `obsidian/PRODUCT_SPEC.md`, `obsidian/STATUS.md`, `obsidian/architecture.md`: M4 scope, setup, security/service boundaries, exact methodology and verified results.

No existing M0–M3 tests were removed or weakened. No research-vault file or `.md.md` filename was changed. No database reset, commit, push or deployment was performed.

## Database migration

`20261114140000_m4_local_benchmarks` is the fifth additive migration. Pair codes and long-lived credentials are stored only as hashes; pairing expiry/use and credential expiry/revocation are explicit. Jobs retain config/status/error/lease timestamps. Runs retain raw samples, derived statistics, correctness diagnostics and complete measured environment/config snapshots. User deletion cascades only that owner's records; no account-deletion feature is added. There are no endpoints to edit/delete saved measurements or replace a completed result.

## API endpoints

All application benchmark endpoints require existing user database sessions; all writes require the session-bound CSRF header and origin controls. Agent endpoints also use PostgreSQL-backed sessions and CSRF, with only one-time code or scoped credential authorization, never a personal userId.

| Method/path                              | Purpose                                                          |
| ---------------------------------------- | ---------------------------------------------------------------- |
| GET `/api/benchmarks/catalog`            | Versioned allowlisted workload definitions and limits            |
| POST `/api/benchmarks/pairing`           | Ten-minute single-use pairing code for current owner             |
| GET `/api/benchmarks/agents`             | Owned paired devices, detected metadata and status               |
| POST `/api/benchmarks/agents/:id/revoke` | Revoke access and cancel pending work                            |
| POST `/api/benchmarks/jobs`              | Explicitly queue one bounded job for an owned runner             |
| GET `/api/benchmarks/jobs`               | Owned job status/history; expire abandoned running leases        |
| GET `/api/benchmarks/jobs/:id`           | One owned job                                                    |
| POST `/api/benchmarks/jobs/:id/cancel`   | Immediate queued or cooperative running cancellation             |
| GET `/api/benchmarks/runs`               | Immutable owned measurement history                              |
| GET `/api/benchmarks/runs/:id`           | Complete raw samples, summary, correctness and environment       |
| GET `/api/benchmarks/export.csv`         | Raw measured CSV including CPU-only/invalid rows                 |
| POST `/api/benchmarks/export-dataset`    | M3-compatible measured CSV with exclusion reasons                |
| POST `/api/benchmarks/datasets`          | Validate/save eligible measured samples through M3 ingestion     |
| POST `/api/agent/redeem`                 | CSRF-bound anonymous session + one-time code → scoped credential |
| POST `/api/agent/session`                | CSRF + bearer credential → regenerated runner-only DB session    |
| POST `/api/agent/claim`                  | Runner DB session + CSRF: claim own allowlisted job              |
| GET `/api/agent/jobs/:id`                | Runner session: poll own assignment/cancellation                 |
| POST `/api/agent/jobs/:id/result`        | Runner session + CSRF: immutable result/failure submission       |

The local runner exposes no network server. Remote transport requires HTTPS; only loopback development HTTP is accepted. Credentials are revocable and stored in the native credential vault; frontend localStorage has no API token.

## Verification and limitations

See [STATUS](STATUS.md) for actual final checks and local measured timings. The methodology document explains exact timing boundaries, library/algorithm differences, numeric tolerances, metadata, memory/deadline policies and trust limitations. Native GPU tests were actually executed on the detected RTX 3050 Laptop GPU in this environment; unsupported environments skip with a probe reason.

M3 dataset integration does not manufacture missing features or targets. CPU-only measurements remain raw data. Paired end-to-end measurements need explicit external capability/parallelism metadata; algorithmic operation/intensity features are labeled assumptions. The tested 60-sample dataset used test-only USER_ENTERED capability assumptions, not claimed hardware calibrations, and was removed with its exact generated test account. No calibrated real-world ML accuracy claim is made. M5 may use trained artifacts later, but was not implemented.
