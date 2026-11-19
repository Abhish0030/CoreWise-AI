# M1 change inventory

M1 adds authentication and private hardware management to the existing M0 checkout. No M2 workflow is implemented. The existing checkout contained uncommitted M0 files before this task; this inventory distinguishes this milestone's changes without attributing those files' original creation to M1.

## Created

| Area                               | Files                                                                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| API validation/documentation       | `backend/src/lib/errors.ts`, `backend/src/lib/openapi.ts`                                                                                |
| Authentication/session persistence | `backend/src/modules/auth/routes.ts`, `backend/src/modules/auth/session-store.ts`                                                        |
| Hardware endpoints                 | `backend/src/modules/hardware/routes.ts`                                                                                                  |
| API integration tests              | `backend/tests/m1.test.ts`                                                                                                                |
| Pages                              | `frontend/app/login/page.tsx`, `frontend/app/register/page.tsx`, `frontend/app/profile/page.tsx`, `frontend/app/hardware-library/page.tsx` |
| Authentication UI                  | `frontend/features/auth/auth-form.tsx`, `account-controls.tsx`, `profile-page.tsx`, `use-auth.ts` in the same directory                    |
| Hardware UI                        | `frontend/features/hardware/hardware-library.tsx`, `frontend/features/hardware/profile-form.tsx`                                           |
| Frontend API/session boundary      | `frontend/lib/api.ts`, `frontend/lib/server-auth.ts`                                                                                       |
| Shared validation                  | `packages/types/src/m1.ts`                                                                                                                 |
| Migration                          | `backend/prisma/migrations/20261112060000_m1_auth_hardware_profiles/migration.sql`                                                                 |
| Local configuration helper         | `scripts/setup-env.mjs`                                                                                                                    |
| Browser coverage                   | `tests/e2e/helpers.ts`, `tests/e2e/m1.spec.ts`                                                                                             |
| Documentation                      | `obsidian/PRODUCT_SPEC.md`, `obsidian/adr/0002-m1-sessions-and-ownership.md`, this inventory                                                       |

## Modified

- API: `backend/package.json`, `backend/src/app.ts`, `backend/src/index.ts`, `backend/tests/app.test.ts`.
- Frontend: `frontend/package.json`, `frontend/app/layout.tsx`, `frontend/app/globals.css`, `frontend/app/[section]/page.tsx`, `frontend/components/app-shell.tsx`, `frontend/features/overview/dashboard.tsx`.
- Data/contracts: `backend/prisma/schema.prisma`, `packages/types/src/index.ts`.
- Tooling/tests: `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `vitest.config.ts`, `tests/e2e/foundation.spec.ts`.
- Configuration/docs: `.env.example`, `AGENTS.md`, `README.md`, `obsidian/STATUS.md`, `obsidian/architecture.md`.
- Local ignored `.env`: a random session secret was added without printing or committing it. Next.js may refresh its generated `next-env.d.ts` as part of development/build verification.

## Migration details

The additive M1 migration retains users, sessions, and hardware records. It adds a display name and nullable default/selected profile references; extends hardware specifications; adds session payload storage and permits anonymous CSRF sessions; indexes expiration, owners, creation time, and profile names; adds an owned-ID composite unique key; and clears default/selection references when a profile is deleted. The M0 `tokenHash` column is retained for compatibility and is not used by express-session.

Prisma's interactive migration command refused a non-interactive unique-index warning. SQL was instead generated against the actual schema using `prisma migrate diff`, inspected, and applied with `prisma migrate deploy`. The composite index includes the already-unique profile primary key, so existing records cannot conflict with that new index. No reset, table truncation, or deletion of existing application data was used.
