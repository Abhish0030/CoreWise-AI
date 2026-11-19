# M3 ML engineering

M3 adds real model fitting and inference. It does not add benchmark execution, SHAP, or an agent. M0–M2 remain available; the analytical model is independent and retains `ANALYTICAL` provenance.

## Architecture and setup

Browser → Next `/api` rewrite → authenticated Express → private FastAPI. FastAPI listens on loopback by default, has no CORS/browser credentials, disables public API documentation, and requires `ML_INTERNAL_TOKEN` as a bearer credential. Express never sends the token to the frontend. Deploy both services over a private network; use TLS if the internal network is not trusted. Production hosting itself is not verified here.

From the repository root, with Python 3.13:

```powershell
python -m venv backend/ml/.venv
backend/ml/.venv/Scripts/python -m pip install -r backend/ml/requirements.lock.txt
pnpm env:setup
docker compose up -d --wait
pnpm db:migrate
pnpm db:generate
pnpm dev
```

On POSIX use `.venv/bin/python`. Direct dependencies are pinned in `requirements.txt`; the tested dependency closure is `requirements.lock.txt`. Registry metadata/requirements and `pip check` were checked before installation. `pnpm dev` starts API, web, private ML service and the **separate** worker. Individually: `pnpm ml:serve`, `pnpm ml:worker`. Both need the same PostgreSQL connection and trusted artifact root. `ML_ORIGIN` defaults to `http://127.0.0.1:8000`; `ML_ARTIFACT_ROOT` defaults to `backend/ml/artifacts` relative to repository root. `pnpm env:setup` creates/preserves random private credentials without printing them. Never configure a `NEXT_PUBLIC_` secret.

## Immutable dataset schema: cw-features-1

Upload a UTF-8 CSV inside the authenticated JSON upload envelope `{name,mode:"CSV",csv}`. Maximum 2,000,000 UTF-8 bytes and 5,000 rows, minimum 60 rows. The dataset JSON body parser alone permits 2,200 KB to account for CSV escaping; other API bodies retain 32 KB. The server rejects unknown/duplicate columns, malformed rows, absent columns, nonfinite numbers, nonpositive targets/critical capacities and unsupported schema/provenance. No client-supplied filesystem paths or artifact uploads exist.

| Columns                                                         | Units / policy                                                                           |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| workload_type                                                   | Nonempty category; training/inference categories must match                              |
| workload_unit                                                   | ELEMENTS, BYTES, MiB, GiB, ROWS, PIXELS or MATRIX_DIMENSION; cannot silently interchange |
| precision                                                       | FP32, FP64 or FLOP_EQUIVALENT; precision compatibility is checked                        |
| workload_size                                                   | Positive size in workload_unit                                                           |
| operation_count                                                 | Positive per-invocation operations                                                       |
| arithmetic_intensity                                            | Positive FLOPs or declared FLOP-equivalent operations/byte                               |
| parallel_fraction                                               | [0,1], offloadable fraction                                                              |
| memory_mib, transfer_mib                                        | Nonnegative MiB; transfer is total host/device bytes in both directions                  |
| cpu_cores                                                       | Integer 1–4096                                                                           |
| cpu_frequency_ghz                                               | Optional positive GHz; never used to manufacture throughput                              |
| cpu_gflops, gpu_gflops                                          | Explicit positive whole-device effective GFLOP/s at declared precision                   |
| cpu_bandwidth_gbps, gpu_bandwidth_gbps, transfer_bandwidth_gbps | Positive decimal GB/s, required even for zero transfer                                   |
| gpu_memory_gb                                                   | Optional positive decimal GB                                                             |
| launch_overhead_us                                              | Nonnegative microseconds, explicit zero supported                                        |
| cpu_time_ms, gpu_time_ms                                        | Positive finite end-to-end times per invocation, **training targets only**               |
| workload_family, hardware_id                                    | Required group metadata: consistently identify repeated measurements                     |
| benchmark_source, measurement_methodology                       | Required nonempty audit descriptions; measurements remain uploader-attested              |
| provenance                                                      | Only MEASURED or SYNTHETIC_DEMO may supply supervised labels                             |
| dataset_version, schema_version                                 | One version per immutable upload; schema_version=cw-features-1                           |

`USER_ENTERED`, `PREDICTED`, and `ANALYTICAL` remain valid product provenance values but are rejected as supervised-label provenance. Measured and synthetic rows cannot be blended in one dataset. Real-world source authenticity cannot be automatically established from CSV text; no independently verified measured dataset is included. Dataset rows/validation are immutable; new uploads create new version records and history. `GET /api/ml/dataset-schema` exposes machine-readable feature constraints and required metadata columns. `GET /datasets/:id` returns only an eight-row preview, not a filesystem path.

Synthetic generation accepts `{mode:"SYNTHETIC",name,count,seed}` (120–5000 rows). Full features, equations, ranges, noise and limitations are in [the generator document](ml/synthetic-data.md). **Demonstration dataset — not measured hardware performance.**

## Feature engineering and fitting

CPU numeric inputs: workload size, operations, intensity, parallel fraction, memory MiB, cores, CPU GHz, CPU effective throughput and CPU bandwidth. GPU adds transfer MiB, GPU throughput/bandwidth/capacity, transfer bandwidth and launch overhead. Host CPU inputs are also used by the GPU model because its label includes serial host work. Both use category, unit and precision. Targets, hardware identifiers, benchmark descriptions, provenance and dataset versions are never input features.

Each fitted scikit-learn pipeline contains training-only median imputation with missing indicators for optional frequency/capacity, log1p of nonnegative numeric inputs, standard scaling, and consistent categorical one-hot encoding. Unknown categories during grouped evaluation are encoded explicitly as unknown; prediction rejects unsupported category/unit/precision rather than implying trained coverage. All-null optional features use the explicit SimpleImputer keep-empty policy (zero in transformed numeric space). Models and preprocessing persist together. Inference never refits preprocessing.

Algorithms: ordinary LinearRegression, RandomForestRegressor (100 trees, min leaf 2), XGBRegressor (160 trees, depth 4, rate 0.06), each with separate CPU/GPU models. Tree seeds are fixed; tree parallelism is one thread for reproducibility. Users can select any nonempty algorithm subset. Targets use log(time_ms); TransformedTargetRegressor applies exp on inference to return original milliseconds. Invalid/nonfinite/underflowed model outputs are rejected, never replaced by constants or analytical estimates.

## Splits and evaluation

Default grouping fingerprints repeated workload/hardware configurations, including operation/memory/transfer/parallel/precision/unit inputs. Users can instead hold out whole workload families or hardware IDs. Two GroupShuffleSplit stages produce approximately 60/20/20 **groups**; row proportions vary with group size. All repeats stay together. Fewer than six groups or fewer than two rows in a split fails explicitly; no random fallback. Metadata consistency is the uploader's responsibility.

- Configuration split: new samples/configurations from potentially known families/hardware; does not prove unseen-family/device generalization.
- Family split: tests unseen workload families. Unseen one-hot categories can materially degrade results.
- Hardware split: tests unseen hardware configurations; capability ranges and simulation coverage still limit applicability.

Fit transformations and regressors on training rows only. Select each target winner by validation RMSE in original milliseconds, before evaluating any held-out test predictions. Do not tune or refit using test data. Every candidate stores validation and held-out MAE, RMSE and R²; per-family counts/errors/R² (null with insufficient samples); actual/predicted/residual points; split groups/counts; training configuration; dependency versions and provenance. R² can be negative; no quality threshold or uncertainty interval is invented. Charts display up to 500 points, while metrics use the full test set. **Synthetic validation results — not real-world benchmark accuracy.**

## Durable jobs and registry

PostgreSQL stores QUEUED/RUNNING/COMPLETED/FAILED jobs and logs. A partial unique index permits one inflight job per owner. The dedicated Python worker claims via FOR UPDATE SKIP LOCKED, commits the claim, fits outside the HTTP request/transaction, and renews a five-minute lease every 20 seconds. Expired running leases become FAILED on subsequent worker scans; queued jobs survive restarts. Failure records an actionable error. Submit a new job to retry. No untracked FastAPI background task is the queue.

Each artifact is written under a generated UUID using a temporary file and atomic replace. All candidate registry rows and completed status commit together. Successfully trained models are READY but inactive; winners are marked separately. Account-row locking and a partial unique index enforce one active version per owner/target. Users may activate/deactivate any successfully fitted owned model, including a nonwinner, while retaining version history.

Registry fields include identity/name/algorithm/target/version, dataset and job references, provenance, feature schema/ranges, training configuration/timestamp, evaluation JSON, artifact location and SHA-256. Dataset-version metadata lives on immutable Dataset; ModelEvaluation is stored immutably with its MLModel rather than a redundant table. Version is a unique UUID artifact identity. Registry APIs hide private artifact paths/hashes and all owner IDs.

Only service-created artifacts in the private root are loaded. The service constructs UUID filenames itself, verifies SHA-256 before Joblib loading, then checks feature/dependency versions. No uploaded pickle/Joblib can be loaded. Hashes detect accidental changes but do not replace filesystem trust: anyone who can replace both registry metadata and artifacts controls the runtime. Keep database/artifact write access private. See [scikit-learn persistence guidance](https://scikit-learn.org/stable/model_persistence) and [target transformation](https://scikit-learn.org/stable/modules/generated/sklearn.compose.TransformedTargetRegressor.html).

## Prediction and comparison

Express resolves owned saved workload/profile plus explicit per-run assumptions, constructs schema-compatible features, and forwards only them and authenticated owner ID to FastAPI. Profile cores/GPU bandwidth can fill explicit missing capability fields; every source remains user-entered. CPU frequency/capacity may be absent. The workload selector pre-fills saved capability assumptions for review; analytical peak assumptions are not verified effective throughputs and must be replaced with values matching the training methodology when needed. No hardware detection or GHz-to-FLOPS inference occurs. Whole-footprint VRAM overflow is rejected. Saved repetitions multiply both predicted per-invocation times; round-trip transfer doubles the declared transfer feature first. The snapshot preserves the actual assumptions, profile and repetitions used.

Both active compatible targets are required. An optional model ID must be owned, active and match its target. Missing models return MODEL_UNAVAILABLE (409); missing features/incompatibility 422; private-service failures 503. Inference uses fitted pipelines, reports CPU/GPU milliseconds and CPU/GPU ratio, exact versions, dataset provenance, PREDICTED output provenance and range warnings. Range warnings do not establish multivariate coverage. No probability/confidence interval or default GPU preference is claimed.

Predictions are immutable owned records with workload, hardware, feature and result snapshots. Historical source IDs are retained as identifiers without live workload/hardware foreign keys, so deletion cannot rewrite history; the user relationship cascades. Model IDs/versions/provenance are snapshotted. `/cpu-vs-gpu` switches between independent Analytical Estimate and ML Prediction modes. If ML is absent or offline, analytical comparison still works.

## Reproducible review artifacts and verification

Run `backend/ml/.venv/Scripts/python -m corewise_ml.demo` with `PYTHONPATH=backend/ml`, from the root, to create a 1,200-row seed-42 synthetic CSV, six fitted Joblib artifacts and an actual evaluation report under ignored `backend/ml/artifacts/reference-demo/`. This local review bundle is not registered or activated for any account. Browser users generate/upload and train their own owned datasets.

Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm test:e2e`. From `backend/ml`, run `.venv/Scripts/ruff check .` and `.venv/Scripts/python -m pytest`. The TypeScript M3 suite starts a real private Python service on an ephemeral port and runs the actual worker for exact generated fixture job IDs; it requires the installed Python environment and PostgreSQL. No arbitrary account cleanup or database reset is used. See STATUS for actual results.

M4 must collect authorized real measurements with consistent precision, units, transfer/warmup/repetition conventions, hardware identities and metadata before real accuracy claims. Synthetic artifacts are engineering demonstrations, not benchmark ground truth. No M4 execution, M5 SHAP, or M6 agent work is included.
