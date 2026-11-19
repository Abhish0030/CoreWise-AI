# M7 implementation inventory

M7 completes reporting, final integration, UI review, security hardening and deployment preparation while preserving M0–M6. No additional milestone, commit, publication or production deployment is included. Actual verification and limitations are recorded in [STATUS](STATUS.md).

## Reporting

- `packages/types/src/m7.ts` and index: strict report inputs, references, immutable snapshot/section/chart contracts, export metadata and compact workspace summary.
- `backend/prisma/schema.prisma` and `backend/prisma/migrations/20261115140000_m7_generated_reports/migration.sql`: GeneratedReport with owner FK/cascade, owner/date index, configuration/references/snapshot JSON, READY status and exact bounded PDF/CSV bytes. Eighth additive migration, applied without reset.
- `backend/src/modules/reports/{routes,snapshot,export}.ts`: owner-scoped source selection, repeatable-read public-contract snapshots, credential filtering, PDF text/vector charts, UTF-8 CSV, checksummed immutable downloads and independent report deletion. Preview does not persist. No invented results or computation is triggered.
- Routes: authenticated `GET /api/reports/sources`, `POST /api/reports/preview`, `POST /api/reports`, `GET /api/reports`, `GET /api/reports/:id`, `DELETE /api/reports/:id`, `GET /api/reports/:id/download?format=pdf|csv`. All writes retain session-bound CSRF. Sources are capped at latest 100 per group; selection is1–12 total, at most6 per group. History is capped at 100 reports/user, creation at 5/minute and requests at 40/minute. Snapshot 750 KB, PDF 80 pages, each export 2.5 MB.
- `frontend/app/reports/page.tsx`, `features/reports/{reports-workspace,report-preview}.tsx`: protected builder, owned selection, validation/loading/empty/error states, preview/history, download, confirmation and printing. CPU/GPU and measured/analytical/predicted sources remain separate, with units, provenance, model/dataset versions, assumptions and source IDs. SHAP is ln(ms), not causal attribution or additive milliseconds.

## Integration and UI

- `backend/src/modules/workspace/routes.ts`, `backend/src/app.ts`, `backend/src/lib/openapi.ts`: authenticated compact real workspace summary, route mounts and shared-schema API documentation.
- `features/overview/{dashboard,workspace-evidence}.tsx`: actual owned inventory, workloads, comparisons, models, prediction, measured runs, SHAP/report counts and provider readiness. Public views do not expose owned records. Existing M0 synthetic opt-in remains explicit.
- `app/settings/page.tsx`, `features/settings/settings-workspace.tsx`: existing theme/account/default-profile functions, actual model readiness, runner pairing/last seen, provider availability and version 0.8.0. No credentials UI.
- `app/[section]/page.tsx`, shell/navigation and auth return destinations: truthful system-monitor capability state, concrete reports/settings links and final milestone/version copy. Browser hardware sensors remain unavailable.
- `app/globals.css`: theme-token report/settings layouts, source selections, tables/cards/charts, mobile grids, visible controls and print rules. Existing reduced-motion behavior is preserved.
- Shell/account controls align accessible names with visible text; offline meters omit prohibited labels; loading skeletons across overview/comparison/ML/SHAP/assistant/benchmark/report pages have status semantics. Theme text-link tokens improve contrast without changing the primary button color.

## Security and release preparation

- `backend/src/lib/csv.ts` and benchmark exporter: shared CSV formula protection without corrupting signed numeric SHAP values.
- `backend/ml/corewise_ml/training.py`: verify hash of the exact bytes loaded by Joblib; preserve trusted-artifact boundary.
- `backend/src/modules/assistant/routes.ts`: independently reject malformed delegated session identity/expiry before tool execution.
- Pinned `pdfkit@0.20.2`, `@types/pdfkit@0.17.7`, `@axe-core/playwright@4.14.0` and `playwright-core@1.65.0`; registry/peer requirements checked. Workspace override `deepmerge-ts@8.0.0` fixes the audited transitive advisory. Package versions updated to 0.8.0, with the lockfile retained.
- `scripts/check-production.mjs` and declaration, `deploy/production.env.example`, `deploy/Caddyfile.example`: validated single-host environment shape and TLS proxy reference, no embedded secrets. Not a live deployment.
- AGENTS, README, PRODUCT_SPEC, architecture and STATUS updated. New DEPLOYMENT, DEMO-GUIDE and SECURITY-REVIEW document service boundaries, startup/migrations, backups/recovery, provider/GPU prerequisites and residual risks. Ignored PDF/review output directories contain no committed credentials.

## Verification sources

`backend/tests/m7.test.ts` covers real PostgreSQL reports, owner isolation, sessions/CSRF, validation, PDF/hash/download integrity, CSV sanitization, redaction, immutable snapshots after edit/deletion and malformed agent sessions. `backend/tests/production.test.ts` checks production configuration boundaries. Python explanation tests include the artifact byte-race regression. `tests/e2e/m7.spec.ts` exercises the report/settings UI, four widths/both themes, accessibility and an actual bounded measured CPU/GPU → measured dataset → fitted models → prediction → SHAP → report chain. Its provider endpoint is explicitly mocked; it proves protocol/tool integration, not external LLM connectivity. The measured test uses clearly labeled user-entered capability assumptions and cannot establish calibrated hardware prediction accuracy.

PDF uses deterministic core fonts and represents unsupported Unicode as code points. UTF-8 values remain in CSV/snapshot. Full source metadata can produce long reports; select fewer sources for presentations. Persistent report bytes consume PostgreSQL/backup storage. Broad assistive-technology certification, live TLS/provider verification, backup recovery drills and multi-instance shared rate limits remain operator release gates.
