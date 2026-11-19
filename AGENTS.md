# CoreWise AI engineering

Repository layout: `frontend/` contains Next.js; `backend/src` and `backend/tests` contain Express and its tests; `backend/ml`, `backend/local-agent` and `backend/prisma` contain the Python services/runner and database schema/migrations. Documentation and the Obsidian vault live under `obsidian/`. Run workspace commands from the repository root. Preserve shared `packages/` and root browser tests/scripts.

Read `obsidian/PRODUCT_SPEC.md` and the current milestone in `obsidian/STATUS.md` before editing. M7 is the current scope; stop after M7 and do not add milestones without a new task.

- Preserve the existing research vault and its `.md.md` filenames.
- Use pnpm workspaces, strict TypeScript, Next.js App Router, and Express. Browser API requests go through Express using the Next.js `/api` rewrite.
- Keep design tokens in `frontend/app/globals.css`. Both themes and reduced-motion behavior must remain usable.
- Never portray browser-accessible hardware sensors as live telemetry. Every demo value must be labeled `SYNTHETIC_DEMO`; measured, analytical, and predicted outputs require their actual sources.
- Do not invent benchmarks, trained models, SHAP contributions, or recommendations.
- Keep application dependencies pinned; check registry versions and peer requirements before adding packages.
- Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and relevant `pnpm test:e2e` checks. Update `obsidian/STATUS.md` with actual results and limitations.
- Never commit `.env`, user credentials, generated build outputs, or database volumes. Do not push or publish without an explicit task.
- All personal APIs require a database session and owner scoping. All writes require a session-bound CSRF header, including login/registration. Never replace the Prisma session store with an in-memory production store.
- Tests use PostgreSQL and only remove accounts with exact generated test identities. Never reset the database or delete real user data to make a test pass.
- Analytical calculations belong in the tested backend model. Preserve explicit units, capability sources, transfer conventions, immutable snapshots, and `ANALYTICAL` result provenance. Never infer CPU FLOPS from GHz or silently fill missing hardware capabilities.

See `README.md` for setup and `obsidian/architecture.md` for service boundaries.

- ML fitting/inference belongs in the private Python service. Only measured or explicitly synthetic labels may train supervised models; never relabel analytical estimates. Keep preprocessing, grouped splits, model artifacts and dataset provenance reproducible.

- Local benchmarks require explicit bounded allowlisted runner execution. Preserve raw samples, correctness, scopes, environment snapshots and MEASURED provenance. Runner-only DB sessions must not grant personal API access; all writes retain session-bound CSRF. Never fabricate missing GPU labels or infer calibration features from target times.

- Agent tools must call the fixed authenticated Express boundary with an expiring session/CSRF-bound turn grant. Keep ownership and budgets in Express; never expose arbitrary execution, SQL, filesystem, network or write tools. Retrieved text is untrusted data. Keep provider credentials out of prompts, messages, SSE and browser storage. Preserve provenance and SHAP ln(ms) units; mocks belong only in tests.
