# M5 change inventory

- Python: `corewise_ml/explanations.py` implements actual fitted-model SHAP, mapping, deterministic references, grouped local/global results and additivity checks. `explanation_jobs.py` provides owner-scoped cache/queue validation; `explanation_worker.py` executes bounded jobs. Existing app/worker modules integrate the private route and queue. Training adds immutable reference digests/indices and shares verified artifact loading. Inference snapshots artifact hashes. requirements and lock add pinned SHAP and resolved dependencies.
- Database: additive `20261115060000_m5_shap_explanations` creates ModelExplanation, owner/prediction relations, cache uniqueness and job/history indexes. No reset or real data deletion.
- Shared contracts: `packages/types/src/m5.ts` defines strict requests, job/results, metadata, transformed mapping and output units; index exports it. M3 prediction model references gain optional artifact hashes for backward compatibility.
- Express: `modules/explanations/routes.ts`, application mounting and OpenAPI add authenticated, CSRF-protected submission and owned history/detail/prediction/global retrieval.
- Frontend: protected `/explainability`, `features/explainability/*`, reusable saved-prediction explanation in the ML playground and `/cpu-vs-gpu`, theme-token styles, safe auth return routing and implemented-route exclusion. Charts show global mean absolute importance, separate device comparison and local signed waterfalls, with accessible tables, provenance and limitations.
- Tests: `backend/ml/tests/test_explanations.py`, `backend/tests/m5.test.ts`, `tests/e2e/m5.spec.ts`. Previous tests remain intact.
- Documentation: M5 methodology/inventory, STATUS, product scope, architecture and README setup/review guidance.

Endpoints: POST `/api/explanations`; GET `/api/explanations`, `/api/explanations/:id`, `/api/explanations/prediction/:predictionId`, `/api/explanations/global/:modelId`. Private POST `/internal/explanations` queues work; it is not browser-accessible. All personal resources remain owner scoped.

Review `/explainability`, `/ml-predictions` and ML Prediction mode on `/cpu-vs-gpu`. Generate/import a real dataset, train, explicitly activate the two device models and save a prediction first. Synthetic generation is visibly labeled demonstration data. Background/global limits and optional workload-family filtering are explicit controls; errors are actionable and no model is silently trained or replaced.

See [methodology](M5-SHAP-EXPLAINABILITY.md) for units, reproducibility, legacy compatibility and limitations, and [STATUS](STATUS.md) for actual verification results. M6 and M7 remain pending.
