# Repository cleanup audit — 2026-11-15

Maintenance scope only; M0–M7 behavior and dependency versions remain unchanged. This inventory was prepared before cleanup. No commit, push, deployment or database reset is authorized or performed.

## Original structure and Git state

The audited root contains `.ruff_cache/`, `backend/`, `deploy/`, `frontend/`, `node_modules/`, `obsidian/`, `packages/`, `scripts/`, `test-results/`, `tests/`, `tmp/`, `.env`, `.env.example`, `.gitignore`, `.prettierignore`, `.prettierrc.json`, `AGENTS.md`, `docker-compose.yml`, `eslint.config.mjs`, `LICENSE`, `package.json`, `playwright.config.ts`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `prisma.config.ts`, `README.md` and `vitest.config.ts`. No root log or `output/` directory was present at audit time.

The Git working tree already contains the previous folder reorganization: old tracked `docs/`, `.obsidian/` and root contribution-guide paths appear deleted, while their relocated contents and most application files are untracked. These are existing changes, not cleanup deletions. No files will be staged or discarded to make status appear clean. `.env` is ignored and is not tracked; its contents are never logged or copied.

## Cleanup inventory and decisions

| Candidate                                                                            | Classification                          | Evidence / action                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `frontend/`                                                                          | KEEP                                    | Active Next.js workspace, App Router, components, styles, assets and configuration. No UI behavior changes.                                                                                            |
| `backend/` source, tests, Python environments                                        | KEEP / IGNORE generated state           | Express, ML/agent, explicitly invoked runner and Prisma are already grouped appropriately. Preserve all environments and dependency installations.                                                     |
| `backend/prisma/`                                                                    | KEEP                                    | Eight existing migrations and schema, resolved by root Prisma configuration. No moves or migration changes.                                                                                            |
| `backend/ml/artifacts/`                                                              | KEEP / IGNORE                           | Eight reference-demo model/dataset/evaluation files; preserve exact bytes and paths. No existing model is retrained.                                                                                   |
| `backend/local-agent/results/`                                                       | KEEP / IGNORE                           | Three measured vector/matrix/sort JSON records; preserve exact bytes and paths.                                                                                                                        |
| `obsidian/`, including `.obsidian`                                                   | KEEP                                    | Valid vault, 31 original research notes, 9 attachments, engineering documents and private workspace/plugin settings. Preserve original notes/attachments byte-for-byte.                                |
| `packages/types`, `packages/config`                                                  | KEEP                                    | API and frontend import the same contracts/Zod schemas; both tsconfigs extend shared strict settings. Removing or moving these would duplicate shared code.                                            |
| Root `scripts/`                                                                      | KEEP                                    | Setup, database/production checks and service/runner launchers coordinate workspace paths, root `.env` or deployment configuration. None is obsolete; moving launchers provides no functional benefit. |
| Root `tests/e2e/`, `tests/fixtures/`                                                 | KEEP                                    | Integration tests span frontend, Express, PostgreSQL, Python worker/runner and test-only provider. Keep Playwright/Vitest discovery stable.                                                            |
| `deploy/`, `docker-compose.yml`                                                      | KEEP                                    | Single-host deployment examples and persistent PostgreSQL volume configuration; no volume operations.                                                                                                  |
| Root `node_modules/` and workspace installations                                     | KEEP / IGNORE                           | Required installed dependencies; no reinstall or deletion for appearance.                                                                                                                              |
| `.env`, `.env.example`                                                               | KEEP                                    | Private environment and safe template. Preserve original file hash without printing values.                                                                                                            |
| Package/workspace/lock files, Prisma/ESLint/Playwright/Vitest/Prettier configuration | KEEP                                    | Root resolution and cross-workspace commands require these locations. Only artifact paths/ignore settings need changes.                                                                                |
| `README.md`, `AGENTS.md`, `LICENSE`, `.git/`                                         | KEEP                                    | Entry documentation, engineering instructions, license and Git history.                                                                                                                                |
| `.ruff_cache/`, project-owned `.pytest_cache/`, project-owned `__pycache__/`         | SAFE TO DELETE / IGNORE                 | Generated tool state only; no tracked files, symlinks, environments, model artifacts or measurements may be traversed. Run Python verification without cache/bytecode generation.                      |
| `frontend/.next/cache/`                                                              | SAFE TO DELETE / IGNORE                 | Rebuildable Next cache; retain the current production build needed for startup and browser checks.                                                                                                     |
| Old `tmp/pdfs/previous-layout/frontend-.next/`, `backend-dist/`                      | SAFE TO DELETE                          | Obsolete generated builds preserved during the previous move; neither is an active workspace. Remove only after confirming no tracked files, data files or links occur inside.                         |
| `test-results/`                                                                      | MOVE                                    | 107 prior test outputs, including measured integration evidence. Preserve all files, including 104 screenshots, instead of treating the complete directory as disposable.                              |
| `tmp/pdfs/` remaining review files                                                   | MOVE                                    | Prior PDF renders, reference hashes, reusable Poppler tool/archive and relocation backups. Retain anything uncertain; no blanket deletion or ignore of `tmp/`.                                         |
| Old dependency backups under `previous-layout/`                                      | REQUIRES USER CONFIRMATION for deletion | Preserve under the review archive. Installed dependencies and uncertain backup contents are outside the deletion allowlist. No confirmation is needed to keep them.                                    |
| Temporary logs                                                                       | IGNORE future tool-generated logs only  | None found at root. Add explicit pnpm/npm/yarn debug-log patterns rather than hiding arbitrary `.log` user records.                                                                                    |

Current `frontend/.next`, `backend/dist` and `packages/types/dist` are KEEP / IGNORE: package exports and compiled startup commands depend on them. Obsolete copies were removed; verification rebuilds the active outputs and can recreate Next's ignored cache. Dependencies, virtual environments and source directories are not removed to make the root appear empty.

## Final structure

```text
CoreWise-AI/
  .artifacts/              Ignored local review archive and generated verification output
    review/               Preserved prior test evidence, PDF review/tools and backups
    test-results/         Current screenshots, diagnostics and API review exports
      playwright/         Playwright-managed transient results only
    evidence/             Unique per-report measured integration exports
  frontend/               Next.js application and its local configuration
  backend/                Express src/tests, ml/, local-agent/, prisma/
  obsidian/               Documentation, research, attachments and vault settings
  packages/               Shared contracts and strict TypeScript configuration
  scripts/                Cross-workspace setup/startup/verification commands
  tests/                  Cross-workspace browser tests and provider fixture
  deploy/                 Production environment/proxy reference examples
  node_modules/           Existing ignored workspace dependencies
  .git/                   Existing Git history/state
  root configuration      Environment/template, manifests, lock, tooling, README/AGENTS/LICENSE
```

## Moves, deletions and configuration changes

Executed the inventory's allowlisted cache/build cleanup: **324,577,511 bytes (about 310 MiB)** removed initially. Removed root Ruff cache, project-owned ML/runner Python/Ruff/Pytest caches, `frontend/.next/cache`, and the two obsolete generated build trees under the former `tmp/pdfs/previous-layout/`. No tracked content or reparse points were traversed. An exact per-path count/byte receipt is retained at ignored `.artifacts/review/cleanup-actions.json`. Current production builds, dependencies, environments, source, model artifacts and measurements remain.

Moved `test-results/` intact to `.artifacts/review/pre-cleanup-test-results/`, preserving 107 files including 104 screenshots and the measured-flow JSON. Moved the remaining `tmp/pdfs/` intact to `.artifacts/review/pdfs/`, preserving PDF renders, Poppler tools/archive, research hash receipt and dependency backups. Removed the now-empty `tmp/` directory only after verifying it contained no other entries. No source/application/documents or persistent model/measurement paths moved.

Configuration changes: Playwright `outputDir` is `.artifacts/test-results/playwright`; existing screenshot/API export paths now use `.artifacts/test-results`. The M7 measured integration saves PDF/JSON to `.artifacts/evidence/<report-id>/`, preventing overwrites and separating them from Playwright's automatically cleared directory. Test assertions, ownership and cleanup scopes remain unchanged. `.gitignore` explicitly ignores the three known artifact subdirectories and tool debug-log patterns, without hiding all of `tmp/` or all logs. Prettier/ESLint exclude local artifacts. README and DEMO-GUIDE describe the new locations; AGENTS required no path/command changes. No dependency, workspace, database, application import, service configuration or CI change was needed.

## Verification plan and boundaries

Ran typecheck, lint, build, full API tests, ML/agent Python tests, runner tests, both Ruff checks, database validation/status and full browser regression. API and browser suites ran sequentially against the existing PostgreSQL instance. Necessary training/benchmark steps created only new exact fixture-owned records; they did not retrain existing models, overwrite existing datasets or execute persistent user jobs. Only fixture identities created by these tests were cleaned. Provider verification remains test-mocked; no deployed service, live external provider or calibrated predictive accuracy is claimed.

Verification completed successfully. Python used `PYTHONDONTWRITEBYTECODE=1`, pytest `-p no:cacheprovider` and Ruff `--no-cache` to avoid recreating the cleaned caches. All **73 protected files** are byte-identical: original research/attachments, vault settings, migrations/schema, model/dataset artifacts and raw benchmark records. `.env` is byte-identical, ignored and untracked; its content was never printed or copied. All **782 archived review files** match their fingerprints after verification. Read-only digests/counts for **14 personal database tables** match the pre-test baseline after exact fixture cleanup. The Docker volume/session store were not reset. Test listeners stopped; PostgreSQL remains running.

| Check                                         | Actual result                                                                                                      |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `pnpm typecheck`                              | Passed                                                                                                             |
| `pnpm lint`                                   | Passed                                                                                                             |
| `pnpm test`                                   | 97 API/TypeScript tests passed                                                                                     |
| `pnpm build`                                  | Passed                                                                                                             |
| ML/agent Python                               | 44 tests passed                                                                                                    |
| Runner Python                                 | 17 tests passed                                                                                                    |
| Both Ruff / both `pip check`                  | Passed                                                                                                             |
| Prisma validation / migration status          | Passed; existing 8 migrations applied                                                                              |
| `pnpm db:check`                               | Passed; actual PostgreSQL query                                                                                    |
| Local Markdown links / active old-path search | Zero missing file targets / no obsolete runtime paths                                                              |
| Full browser suite                            | **60/60 passed (7.1 minutes)**; all M0–M7 regression cases, both themes at 375/768/1280/1440 and all-page Axe scan |
| Protected file/database/archive fingerprints  | 73 protected files, 782 archived files, `.env` and 14 database tables unchanged                                    |

## Remaining cleanup opportunities

Deletion of retained dependency backups or review evidence requires a separate user decision. Historical references in completed milestone documents remain historical; active commands/links will point to the consolidated artifact paths. Ordinary builds may recreate local ignored outputs; maintenance does not make generated files impossible. Pre-existing unresolved wiki links remain documented in MIGRATION-LINK-AUDIT.md. This task does not stage the earlier reorganization or resolve unrelated Git changes.

Git audit after cleanup: the set of pre-existing tracked deletions is unchanged. No additional tracked file was deleted; no files were staged or committed. The earlier reorganization remains visible in Git status. `git diff --check` passed. Root `tmp/`, `test-results/` and `.ruff_cache/` are absent, and the new artifact subdirectories are ignored. Active `.next`/compiled outputs remain available for normal startup.
