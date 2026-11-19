# Functional audit and restoration — 2026-11-15

This is a new user-authorized functional restoration task following M0–M7, not a rewrite. Existing research files, data, model artifacts and security boundaries remain protected. The user separately authorized bounded local benchmark execution and measured-model training, including regression hardware execution, before collection began. No tuning, deployment or publication is authorized.

## Initial findings, before repairs

Read README, current status/product specification, service architecture, deployment examples and M1–M7 API/ML/runner contracts. Inspected the active Express/Next/FastAPI/worker startup and persistence code. Read-only database audit found2 users but **zero profiles, selections, paired agents, workloads/results, benchmark runs, datasets, registered models or active models**. The private provider was not configured. Existing empty states therefore did not demonstrate broken authentication, model loading or prediction calculations.

| Workflow | Initial classification | Reproduced finding / cause |
| --- | --- | --- |
| Authentication | Working | Existing2 accounts, running session-backed API; preserved PostgreSQL tests cover registration/login/logout/expiry. No credentials are printed or bypassed. |
| Hardware profile selection | Partially working | CRUD/default/selection APIs exist, but no profile exists. Runner detection has no import-to-profile handoff. Overview offers a generic setup link rather than a guided sequence. |
| Local agent pairing | Working, not configured | One-time pairing, native vault and runner-only sessions exist. No paired agent exists. Pairing starts no benchmark and does not mean a persistent connection. |
| Hardware detection | Working in local CLI; disconnected from UI | Actual `pnpm agent detect` reports Intel i5-11400H,6 physical/12 logical CPUs,8316059648 RAM bytes, NVIDIA RTX3050 Laptop GPU with4294967296 vendor-reported bytes. CuPy/CUDA allocation probe succeeds. No browser detection is claimed. |
| Telemetry ingestion | Missing implementation | Runner has no bounded sampling/upload command or telemetry endpoint/model. Dashboard always renders offline placeholders. Pairing/lastSeen does not supply CPU/GPU utilization or temperatures. |
| Workload configuration | Working; empty | Owned workload/preset forms and strict units/capability inputs exist; no saved workload. |
| Analytical estimation | Working; input-dependent | Tested M2 engine is available, but requires supplied throughput/bandwidth/transfer/launch assumptions. Detection cannot infer FLOPS from GHz. No source configuration is present. |
| ML model loading | Blocked by missing data/models | Private service, artifact verification and worker exist; registry is empty. No trained artifact is selected for this user. |
| CPU/GPU prediction | Blocked by missing models/configuration | Requires compatible owned active CPU/GPU versions, workload units/precision/features and capacity checks. No valid source records exist; no prediction should be manufactured. |
| Benchmark execution | Working for3 families; incomplete requested catalog | Bounded NumPy/CuPy vector addition, matrix multiplication and stable sorting exist with raw compute/transfer/end-to-end samples and correctness. Reduction and image-processing execution are absent. |
| SHAP | Working, prerequisites absent | Exact saved model/artifact versions and persisted predictions are required. Empty output is correct without models/predictions. |
| AI assistant | Blocked by provider configuration | Actual bounded provider adapter and authorized tools exist. Provider/key/model absent; explicit unavailable is correct. No fake fallback should be added. |
| Reports | Working, sources absent | Owned immutable PDF/CSV snapshots exist; no user evidence exists to select. |
| Optimization / prediction-measurement journey | Missing integration | M2 returns a processor preference, but no evidence-ranked optimization/crossover or compatible measured-vs-predicted comparison workspace exists. |

The legacy public `/api/system/status` intentionally retains its M1 disconnected/untrained envelope for compatibility. Personal state must come from authenticated owner-scoped endpoints. The dashboard also hardcodes disconnected sensor text; merely changing that label would be dishonest. The original visual reference screenshot remains absent; no screenshot reproduction is claimed.

## Repair sequence and verification policy

Start with detected-hardware import/selection and explicit onboarding. Add bounded runner telemetry with fresh/stale/disconnected/unsupported states, preserving per-session CSRF and runner isolation. Extend only the fixed benchmark allowlist with tested bounded implementations. Reuse the existing Python grouped fitting/selection and backend analytical engine. Add an evidence-ranked optimization/readiness service and actionable dashboard controls, then verify the complete fixture-owned journey.

Measured samples require actual execution and correctness; input capabilities remain separately sourced assumptions, never derived from timing targets. A single local machine cannot establish general hardware accuracy. Preserve synthetic artifacts. Report model versions, held-out/grouped errors and limitations, including negative R² when present. Provider tests remain explicitly mocked unless a real configured provider succeeds. Final results and remaining configuration will be recorded below and in STATUS.

## Repairs delivered

- Guided overview connects the existing owned profile, runner, workload, analytical/ML prediction, bounded queue, exact compatible measurement, SHAP and report screens. Pairing instructions distinguish registration from a live sampling connection. Missing prerequisites produce reasons and review links.
- `GET /api/hardware/connection`, `POST /api/hardware/import-hardware`, runner-only `POST /api/agent/telemetry` and personal `POST /api/optimization/preview` / `run` reuse database sessions, CSRF and strict shared Zod schemas. Runner sessions cannot access personal APIs. Imported snapshots remain runner-attested observations, not independently certified specifications. Edits remove detection binding and become USER_ENTERED.
- Additive migrations `20261115190000_functional_hardware_telemetry` and `20261115191000_fractional_detected_ram` add snapshot/latest-sample fields and preserve fractional RAM GiB. Existing data is retained; ten migrations are applied without reset. GPU vendor bytes convert explicitly to decimal GB; RAM bytes to GiB.
- Native telemetry reads psutil CPU utilization/RAM and read-only NVIDIA utilization/VRAM/temperature. Unsupported CPU temperatures, GPU tools and fans are not guessed. Fresh requires both receipt and capture within 15 seconds; stale/expired values are withheld. At most 120 samples, 300-second sampling budget, bounded vendor/HTTP timeouts; no persistent daemon or tuning.
- Reduction (`sum`) and image blend (`0.5*(a+b)`, two fixed kernels) extend the three existing allowlisted families with FP32/FP64, correctness, memory bounds, one-process lock, deadlines and raw CPU/GPU compute/H2D/D2H/end-to-end evidence. No arbitrary kernel or execution interface is added.
- Recommendations rank exact compatible MEASURED evidence, measured-trained PREDICTED estimates, then ANALYTICAL estimates. Synthetic-trained models remain explicit demonstrations. Matching checks owner, detected runner/device, family, size/unit/precision, CPU threads, correctness, end-to-end scope, operations, memory and transfer semantics. Mismatches never produce signed prediction error. Stored model versions/hashes and immutable snapshots are checked.
- Crossover samples reuse the M2 backend model and declared family scaling, returning sign-change brackets, not invented exact thresholds. Transfer/launch costs and capacity warnings retain sources/units. Compatible observed thread runs may be compared; thread count is not an ML feature. Resident batching is outside the current invocation contract, so no batch recommendation is claimed.
- The public legacy system-status contract and opt-in SYNTHETIC_DEMO illustrations are preserved. Personal dashboards bind measured sensors to the selected detected profile, with stale/offline states, compact onboarding, exact readiness and evidence references. Both themes and responsive navigation remain.

## Actual measured collection and training

Evidence directory: `.artifacts/evidence/functional-collection-1794767410781/` (ignored, retained). `manifest.json`, 60 raw configuration results, two independent calibration records, `measured.csv`, `dataset-provenance.json`, six fitted artifacts and `trained-review/evaluation.json` preserve reproducibility. The CSV SHA-256 is `17bf5078338de74a815617af3765414a2086fa8e9ad4d258961e0f3202289e19`.

Five families × six sizes × two data types × ten paired CPU/GPU repetitions produced **600 valid MEASURED rows, zero exclusions**. Vector/reduction/image sizes: 16000–96000 elements/pixels; matrices: dimensions 32–192; sorting: 4000–32000 elements. Each target run uses one CPU thread, two warmups and a 30-second deadline. Environment: Intel i5-11400H / RTX 3050 Laptop, NumPy/CuPy with actual CUDA execution. CPU-only/unsupported GPU paths remain tested separately; missing GPU labels are never filled.

Calibration precedes target collection: matrix dimension 128, vector size 200000 and vector size 16 per dtype, five repetitions each. These configurations are excluded from training labels. Derived effective GFLOPS/logical-traffic bandwidth and transfer bandwidth are empirical assumptions, not vendor peak specifications. The small-vector residual host overhead includes allocation, dispatch and synchronization; it is explicitly a launch-cost proxy, not an isolated kernel measurement. Features never derive from the timing target of the same configuration.

Existing Python fitting compares Linear Regression, Random Forest and XGBoost separately for CPU and GPU. Seed 42 CONFIGURATION splits contain **360/120/120 rows and 36/12/12 groups, with no group overlap**. Validation RMSE selects CPU XGBoost and GPU Linear before held-out reporting. Existing synthetic artifacts are preserved. The standalone review command changes no registry; the subsequent explicit university-account selection authorized the scoped import described below.

| Target / algorithm | Validation RMSE ms | Test MAE ms | Test RMSE ms | Test R² |
| --- | ---: | ---: | ---: | ---: |
| CPU Linear | 0.164223 | 0.056812 | 0.113881 | 0.645530 |
| CPU Random Forest | 0.216349 | 0.107605 | 0.190380 | 0.009355 |
| **CPU XGBoost (selected)** | **0.157262** | **0.062346** | **0.123024** | **0.586330** |
| **GPU Linear (selected)** | **0.174775** | **0.102860** | **0.183185** | **0.134009** |
| GPU Random Forest | 0.180762 | 0.109585 | 0.193292 | 0.035810 |
| GPU XGBoost | 0.176510 | 0.102566 | 0.187128 | 0.096327 |

Selected-model held-out workload-family errors:

| Family (test rows) | CPU MAE / RMSE ms | CPU R² | GPU MAE / RMSE ms | GPU R² |
| --- | ---: | ---: | ---: | ---: |
| Vector addition (40) | 0.001651 / 0.002621 | 0.560138 | 0.063183 / 0.070977 | -0.551941 |
| Matrix multiplication (20) | 0.081970 / 0.088681 | -5.622682 | 0.151290 / 0.309019 | -0.252912 |
| Sorting (30) | 0.189318 / 0.235029 | -0.558470 | 0.130352 / 0.203803 | 0.134263 |
| Reduction (10) | 0.000666 / 0.000724 | -0.337739 | 0.074906 / 0.080216 | -4.848757 |
| Image blend (20) | 0.004497 / 0.008507 | -0.328388 | 0.106525 / 0.173929 | -0.064411 |

Negative R² means these family models underperform a constant held-out mean. Small inputs, narrow size ranges, noisy sub-millisecond timings, one thread and one CPU/GPU do not support general hardware accuracy claims. CPU Linear's better test score does not retrospectively change validation-based selection. Exact-configuration measurements support local decisions; model quality needs more independently collected configurations and machines before deployment claims.

## Files and service boundaries

New shared `packages/types/src/functional.ts`, backend `modules/functional/{routes,optimization,optimization-routes}.ts`, frontend `features/functional/{journey,telemetry-workspace}.tsx`, runner `telemetry.py` / `collection.py`, Python `measured_review.py`, CSV preparation script, two migrations, and API/runner/browser functional tests contain the new workflow. Existing app mounting, hardware/manual edits, analytical source labels, benchmark allowlist/export, ML feature metadata, dashboard/shell/metric cards, workload/profile forms, OpenAPI, globals.css and test scheduling were updated in place. README, product specification, this audit and STATUS document the restoration. No dependency was added, and no research file, environment secret or existing artifact was replaced.

## Configuration and deployment limits

Apply ten migrations, regenerate Prisma/shared types, install the existing pinned Python dependencies and run the API, Next frontend, private ML service/worker and PostgreSQL. New installations pair the intended account and authorize native execution separately, then upload measured CSV, review training metrics and explicitly activate owned CPU/GPU versions. Existing users' passwords and pre-existing data are preserved. The current user's explicitly selected university account received the new setup below.

External AI remains blocked by absent provider/key/model configuration. Regression tests use the real LangGraph/provider adapter against an explicitly test-only mocked provider; they do not establish external connectivity. No live HTTPS deployment, backup restore, independent security/accessibility certification, universal hardware coverage, continuous monitoring daemon, batch tuning or generalized model accuracy is claimed. Use the existing DEPLOYMENT.md controls, shared rate-limit design for multi-instance hosting and trusted artifact storage before production. No commit, push or deployment was performed.

## Persistent university setup and manual review

The browser was initially signed into the Gmail account. Native UI review paired a runner using the Windows credential vault, imported the actual detected profile, observed telemetry and exercised exact missing-model/capability guidance. The user then selected the university account as the intended destination. A guarded local operator transaction moved only this newly created profile/runner, restored Gmail's former null selections and removed only the one comparison created during that same manual setup. Pre-existing Gmail workloads, both accounts and passwords remain unchanged. No arbitrary impersonation session, password replacement or public import/admin endpoint was added.

Explicitly scoped local operator import validated the original CSV through the private Python ingestion service, checked its SHA-256 and all six artifact byte hashes, copied artifacts exclusively into the trusted private root and registered their original evaluation/configuration/versions under the university owner. Existing model/dataset checks prevent replacement. Dataset validation retains actual device identities, one-thread policy and single-machine limitations. The two validation-selected models are active. This imports already fitted real models; it does not fabricate a training job or rerun fitting. The imported completed job logs describe review-artifact registration, not a worker execution at import time.

A 16,000-element FP32 vector workload uses the separately retained float32 empirical calibration, explicit units and description. Actual private inference produced saved CPU 0.002308235 ms / GPU 0.280048339 ms predictions with original artifact IDs/hashes. Its separately authorized one-thread, five-repetition, 30-second runner job completed through the authenticated runner/CSRF boundary. Compatible END_TO_END measured medians are CPU **0.0045 ms**, GPU **0.502 ms**; signed prediction errors are **-48.7059% / -44.2135%**. The evidence-ranked recommendation is CPU for this exact configuration. This point is not held-out quality evaluation; the model limitations above remain applicable. `university-review.json` records exact references and results alongside the raw collection. A 90-sample native telemetry command also completed and stopped automatically; stale values are withheld afterward.

Review after signing into the **university account**: `/` for the selected hardware/workload and decision action, `/hardware-library`, `/system-monitor`, `/benchmark-lab`, `/ml-predictions`, `/cpu-vs-gpu`, `/explainability` and `/reports`. The native credential remains in the OS vault; restart bounded monitoring as needed. Gmail intentionally does not own the university dataset/models/profile.

## Final verification

Typecheck, lint and production build passed. Full API/TypeScript suite: **106/106**; latest functional follow-up **9/9**. Python: **44 ML/agent**, **26 runner**, both Ruff and both dependency checks passed. Prisma validation and all ten migrations are current. All **64 browser scenarios** were verified across runs: full regression 63/64, remaining RAM-unit CRUD assertion corrected and passed, all final M1 cases passed, and final functional **4/4** passed after synchronizing the unchanged overflow assertion with fonts/theme/layout settlement. There is no single final 64/64 run claim. Both themes at 375/768/1280/1440, all-page Axe and the added journey scan passed in exercised states; desktop-dark/mobile-light screenshots were visually reviewed. These checks are not accessibility certification.

Actual benchmark execution, correctness, measured dataset ingestion, private fitting/inference/artifact verification, new optimization comparisons, exact-model SHAP, report exports and the real adapter/tool graph were exercised. The provider itself remained test-mocked. Native UI review covered pairing/import, source labels, telemetry and missing-prerequisite guidance; university persistence/prediction and the extra measured job were verified through scoped local operator/native runner execution. The browser is left at sign-in for the university account; no unobserved university UI login is claimed. Final state retains both original accounts and zero generated fixture accounts, with one university profile/dataset/workload/prediction/run and six registered/two active models. Development services and persistent PostgreSQL are running. Telemetry intentionally stops and becomes stale; restart a bounded monitor to review fresh values.
