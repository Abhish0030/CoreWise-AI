# M5 — SHAP explainability

SHAP allocates a fitted model's output relative to a reference distribution using Shapley values. These are explanations of model behavior, not causal effects, verified hardware measurements, or evidence of real-world model accuracy. Synthetic-trained models and their explanations retain SYNTHETIC_DEMO dataset provenance.

## Models and output space

The actual registered fitted pipeline is loaded only after UUID/path containment, SHA-256, dependency/schema version, target and algorithm checks. LinearRegression uses SHAP LinearExplainer with an Independent masker. RandomForestRegressor and XGBRegressor use TreeExplainer with an explicit training background, interventional feature perturbation and raw model output. SHAP is pinned to 0.54.1. There is no fabricated fallback or client-side attribution calculation.

All current regressors fit `log(time_ms)` inside a TransformedTargetRegressor. SHAP therefore explains **LOG_TIME_MS**, with contributions in **ln(ms)**. We do not label these as additive milliseconds. For a saved workload with r repetitions:

`baseline_total = expected_log_time + ln(r)`

`final_total = baseline_total + sum(feature_contributions)`

`predicted_total_ms = exp(final_total)`

Feature contributions remain unchanged by repetition scaling. `exp(baseline_total)` is a geometric reference time, not an arithmetic mean execution time. CPU and GPU have separate models and baselines; subtracting their attributions is not a speedup attribution.

## Reproducible references

The dataset's immutable rows, version, provenance, training seed and grouped split configuration determine the reference. Background rows are sampled without replacement from the training partition only, using seed + 505. The default limit is 32, with an allowed range of 8–128. If fewer rows exist, all available training rows are used. Saved indices and actual counts disclose the selection.

Global importance evaluates held-out test rows, sampled with seed + 506, default 32 and allowed range 2–128. An optional exact workload-family filter applies only to the held-out evaluation set; fewer than two matching rows produces an explicit error. Background selection is unchanged by that filter. No validation/test row enters the training background.

New training bundles save a canonical dataset SHA-256, split indices and configuration. Legacy M3 bundles lack this reference: their split is reconstructed from their own registered immutable dataset and original configuration and explicitly labeled LEGACY_REGISTRY_SPLIT_RECONSTRUCTION. This is weaker historical evidence than a training-time digest and is not concealed. New predictions snapshot artifact hashes. Older predictions use LEGACY_REGISTRY_VERSION binding and must still reproduce their saved output from the exact registered model UUID/version and verified file.

## Feature transformations

The fitted ColumnTransformer determines transformed names and mapping. Numeric features pass through median imputation, optional missing indicators, log1p and scaling; categorical features use the fitted one-hot categories. No input-to-output dimensionality equivalence is assumed. Unsupported transformation shapes fail explicitly.

Local displays group signed transformed SHAP values by their original feature. One-hot levels and missing indicators contribute to that group's sum. These are **grouped transformed-feature SHAP** values, not a newly computed coalitional game in original input space. Expandable metadata preserves the complete transformed mapping and signed values. Correlation and interventional assumptions limit interpretations of feature importance.

## Local and global results

Local jobs accept a saved prediction ID, never arbitrary model paths or invented inputs. Both devices use that prediction's own model versions, immutable feature/workload snapshots and repetition count, including inactive historical READY models. Recomputed time must match saved time (relative tolerance 2e-5, zero absolute tolerance).

Each sample must satisfy `abs(baseline + sum(phi) - raw_output) <= max(1e-5, abs(raw_output) * 2e-6)`. Nonfinite or nonadditive results fail; residual and tolerance are retained. Global importance is the mean absolute **grouped** contribution over sampled held-out rows, not a sum of absolute one-hot contributions. Each evaluated row passes the same additivity check. Rankings and deterministic top-contribution summaries derive only from calculated values.

## Persistence and security

Express exposes owner-scoped session APIs under `/api/explanations`; POST requires the existing session-bound CSRF header. The private `/internal/explanations` requires bearer authentication and independently scopes predictions, models and datasets to the supplied authenticated owner. Runner-only sessions cannot access personal APIs. Clients cannot upload artifacts or select filesystem paths.

PostgreSQL ModelExplanation records persist QUEUED/RUNNING/COMPLETED/FAILED jobs, options, immutable completed results, errors, attempts and leases. Cache identity includes owner, request, model/version/hash, dataset digest/configuration, saved prediction and SHAP/policy version. A cached POST still verifies artifact availability/hash; historical GET reads the retained result without recomputing or requiring the file. Failed jobs retry explicitly; GET never queues work. Maximum four pending jobs per owner is serialized with a database row lock.

The dedicated ML worker runs each explanation in a killable child. ML_EXPLANATION_TIMEOUT_SECONDS defaults to 60, bounded to 5–120 seconds; leases expire after five minutes. Expired work becomes FAILED rather than remaining indefinitely pending. Sampling and deadlines bound computation, although deployment still needs process/container memory limits. Registry Joblib artifacts must remain private and trusted; a hash does not make an untrusted pickle safe.

## Limits

Only the three supported fitted regression pipelines and their present log/exp target convention are supported. There is no explanation of analytical estimates, raw sensors, a ratio, causal intervention or an LLM recommendation. Synthetic data does not validate real hardware performance. Legacy references have the qualifications above. Global explanations describe sampled held-out data, and small/family-filtered sets may be unrepresentative. History currently lists the latest 100 owned records without pagination. Missing/deleted models or datasets prevent new calculations while completed historical JSON remains readable. M6 agentic AI is not implemented.
