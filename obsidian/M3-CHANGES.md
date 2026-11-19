# M3 implementation inventory

M3 implements real model fitting, evaluation, persistence and inference. M0/M1/M2 are preserved. No benchmarking execution, SHAP or agent functionality is included.

## Added

- `backend/ml/requirements.txt`, `requirements.lock.txt`, `pyproject.toml`: pinned Python environment and Ruff/Pytest configuration.
- `backend/ml/corewise_ml/__init__.py`, `schema.py`, `datasets.py`, `training.py`, `database.py`, `worker.py`, `app.py`, `demo.py`: private FastAPI, versioned data contracts, CSV/synthetic pipeline, train-only preprocessing, three algorithms for both targets, grouped evaluation, trusted artifact persistence/inference, durable PostgreSQL worker and reproducible local review command.
- `backend/ml/tests/test_pipeline.py`: dataset, feature, provenance, split leakage, fitting, evaluation, persistence, train-only preprocessing, dependency compatibility and internal-auth tests.
- `obsidian/ml/synthetic-data.md`: every generated field, equations, ranges, noise, independent-M2 boundary and limitations.
- `packages/types/src/m3.ts`: strict shared Zod request/response schemas, unit-bearing ML features, jobs, registry, evaluation and prediction envelopes.
- `backend/src/modules/ml/routes.ts`, `backend/tests/m3.test.ts`: authenticated owner-scoped Express integration and real PostgreSQL/Python/worker/artifact tests.
- `frontend/app/ml-predictions/page.tsx`, `frontend/features/ml/ml-workspace.tsx`, `prediction-playground.tsx`, `evaluation.tsx`: protected engineering dashboard, dataset upload/generation/preview/history, job configuration/status/logs, registry/version activation, metrics/charts, prediction form/results/history.
- `tests/e2e/test.ts`: shared case-start pacing that respects the unchanged production API rate limiter.
- `tests/e2e/m3.spec.ts`: seven real browser cases, including CSV validation/upload, asynchronous training, artifacts/evaluation/activation, prediction persistence, M2 mode switch, errors and four responsive sizes in both themes.
- `scripts/run-ml.mjs`: repository-root Python service/worker launch using the local virtual environment.
- `backend/prisma/migrations/20261114080000_m3_ml_engineering/migration.sql`: additive tables/indexes/relationships. No reset.
- `obsidian/M3-ML-ENGINEERING.md`, this inventory.

## Modified

- `backend/prisma/schema.prisma`: Dataset, TrainingJob, MLModel and MLPrediction; owner relationships/indexes. Immutable Dataset contains version metadata; evaluation lives with each MLModel. Partial SQL indexes enforce one inflight owner job and one active model per target.
- `packages/types/src/index.ts`: exports M3 contracts. M0–M2 contracts unchanged.
- `backend/src/app.ts`: mounts ML routes after existing session/CSRF middleware; only dataset JSON gets a larger bounded body allowance.
- `backend/src/lib/openapi.ts`: documents all M3 requests/responses with shared schemas.
- `frontend/features/workloads/capability-fields.tsx`: optional ML wording and omission of analytical-only similarity tolerance; default analytical behavior unchanged.
- `frontend/features/comparison/comparison-workspace.tsx`: explicit Analytical Estimate / ML Prediction mode switch; original analytical controls/history/result path preserved.
- `frontend/features/overview/dashboard.tsx`: real owned model readiness and ML entry point; preserves analytical summary and synthetic sensor controls.
- `frontend/features/auth/auth-form.tsx`: safe protected ML return route.
- `frontend/app/[section]/page.tsx`, `frontend/components/app-shell.tsx`: implemented ML route removed from future placeholders; M3 workspace version text.
- `frontend/app/globals.css`: ML layouts, tables, job states, forms, charts and responsive styling using existing light/dark tokens; no chart animation.
- `package.json`, `scripts/setup-env.mjs`, `.env.example`: private service/worker scripts, development startup, random internal credential generation and configuration template. No new JavaScript dependency or lockfile change is needed.
- `.gitignore`: private artifacts, Python test/lint caches ignored.
- `playwright.config.ts`: starts ML service and dedicated worker for browser tests.
- `tests/e2e/helpers.ts`: removes only exact generated fixture users' UUID artifacts during account cleanup. Existing foundation/M1/M2 test files import the shared paced fixture; their assertions and workflows remain intact.
- `AGENTS.md`, `README.md`, `obsidian/PRODUCT_SPEC.md`, `obsidian/STATUS.md`, `obsidian/architecture.md`: authorized M3 boundary, setup, methodology and actual verification results.

Generated `.venv`, artifacts, build/test outputs and local secrets are ignored. The local synthetic review bundle includes an actual generated CSV, six fitted Joblib files and evaluation JSON, under `backend/ml/artifacts/reference-demo/`; it is not a seeded account, production registry entry or activated model.

## Migration

`20261114080000_m3_ml_engineering` creates four new tables with user ownership, dataset/job references and owner/time indexes. Inflight jobs and active targets have partial unique constraints. Existing users, profiles, workloads and analytical comparisons are not reset or rewritten. Prediction snapshots retain source identifiers as historical values, with the owning user relationship enforced; edits/deletions cannot rewrite saved evidence. All four migrations are applied with `prisma migrate deploy`.

## API

All endpoints require a valid PostgreSQL-backed application session. Every POST also requires the existing session-bound CSRF header and origin protection. All resources, overrides, lists and registry activations are owner scoped. Responses retain `{data:...}` and `{error:{code,message,fields?}}`.

| Method/path                        | Behavior                                                                |
| ---------------------------------- | ----------------------------------------------------------------------- |
| GET `/api/ml/dataset-schema`       | CSV feature constraints, metadata columns, units and policy             |
| POST `/api/ml/datasets`            | Validate CSV or generate SYNTHETIC_DEMO dataset, immutable upload (201) |
| GET `/api/ml/datasets`             | Owned dataset version history                                           |
| GET `/api/ml/datasets/:id`         | Owned validation and eight-row preview                                  |
| POST `/api/ml/training-jobs`       | Durable queue, returns immediately (202); conflicting owner job 409     |
| GET `/api/ml/training-jobs`        | Owned queue/history                                                     |
| GET `/api/ml/training-jobs/:id`    | Status, logs, error and fitted model references                         |
| GET `/api/ml/models`               | Registry/version history including evaluation                           |
| GET `/api/ml/models/:id`           | Owned model metadata/evaluation, private paths/hashes omitted           |
| POST `/api/ml/models/:id/activate` | `{active:true}` or `{active:false}`, serialized per owner               |
| POST `/api/ml/predict`             | Compatible active CPU/GPU pipelines; saved PREDICTED snapshot (201)     |
| GET `/api/ml/predictions`          | Owned immutable prediction history                                      |
| GET `/api/ml/predictions/:id`      | One owned prediction snapshot                                           |

Internal FastAPI endpoints require a private bearer token: GET `/health`, POST `/internal/datasets`, POST `/internal/predict`. There are no browser calls to these endpoints and no public artifact upload/load interface.

## Verification and limitations

See [STATUS](STATUS.md) for the final command results and [ML engineering](M3-ML-ENGINEERING.md) for exact methodology and limitations. TypeScript tests use the real private Python service, real PostgreSQL job records, actual fitting and saved Joblib inference; no static prediction substitutes. Browser tests exercise compiled Next/Express and the dedicated worker. Exact generated fixture identities and their own UUID artifacts are cleaned up. No existing M0–M2 test was removed or weakened.

Synthetic evaluation proves only recovery of an illustrative generator. No independently verified measurement dataset, general hardware accuracy, calibrated uncertainty, distributed production deployment, automatic retries, fairness guarantees or benchmark execution is claimed. Inventories/history are unpaginated; CSV ingestion is bounded and synchronous, while training is durable/asynchronous. A stopped worker leaves QUEUED jobs visible until restarted; expired RUNNING leases fail on subsequent worker scans. A hard process/power crash between file publication and registry commit can leave unreferenced files; they are never activated or served as registered models. Keep the artifact root private and backed up with PostgreSQL. M4–M6 remain unimplemented.
