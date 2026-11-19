# Homepage session hydration fix — 2026-11-16

## Reproduction and root cause

Before editing application code, the Turbopack browser regression logged in, navigated directly to `/`, and compared the HTTP response with the hydrated DOM. The DOM showed the personal dashboard, but the server response lacked the `Workload prediction journey` section. The authenticated SSR assertion failed. The reported component mismatch follows directly from this differing initial auth state; the span in FunctionalJourney was not the cause.

`app/page.tsx` rendered `<Dashboard />` without resolving a server session. `useAuth()` had no server initial data on the homepage. Its per-render server query cache therefore reported no user, producing `dashboard ` and the public hero. The browser's shared `current-user` cache could already contain an authenticated result from login, protected-page initialization, or shell revalidation when the dashboard hydrated. That first client render produced `dashboard-personal` and inserted FunctionalJourney before the hero. No query hydration boundary coordinated those consumers.

Credentials were not coming from browser storage. Authentication uses the existing Express HttpOnly cookie and PostgreSQL session store. The query cache is in memory, not persisted. Sidebar storage is read in an effect; theme initialization already has its own mounted-state handling. Neither was the authentication root cause.

## Change and initial state agreement

The root server layout resolves the optional session through the fixed Express `/api/auth/me` boundary, forwarding only the incoming cookie and using `cache: 'no-store'`. No-cookie requests resolve to null without a network call. A 401 also means null; service failures remain errors instead of being mislabeled anonymous. React `cache` memoizes only within the server request and also supplies protected-page `requireSession`, avoiding contradictory duplicate resolutions.

Each request creates a new server QueryClient, seeds `['current-user']` with that public CurrentUser projection or null, and dehydrates it. Providers places HydrationBoundary around **both** WorkspaceFrame and its page children, before any auth consumer renders. Hydrating only Dashboard would leave the shell with the same original mismatch. No singleton server cache, credential serialization or authentication bypass was introduced. Express continues to own session expiry, user scoping and CSRF protection.

| Request state | Server HTML / first client render | After hydration |
| --- | --- | --- |
| Anonymous | Public dashboard, null user, no private widgets | Asynchronous session revalidation can update it normally |
| Authenticated | Personal root class and functional journey from the same user snapshot | Owner-scoped profile/workload/evidence queries load normally |
| Selected profile data pending | Personal dashboard with explicit loading labels | Detected/user-entered identity replaces the labels when fetched |
| Client session revalidation pending | Retains the known server user; no public/personal structural flip | Updates to the actual session result |
| Logout / expired session | Existing logout clears personal cache; new server requests resolve null | Personal widgets remain absent; no cached user resurrection |

SSR is retained. No dashboard suppression, client-only dashboard wrapper, arbitrary delay, redesign or removal of functionality was used. The existing `<html suppressHydrationWarning>` for next-themes is unchanged and is not the auth fix.

## Other render risks reviewed

Dashboard/journey contain no render-time random values, browser cookie/storage auth reads or window-dimension branching. Export timestamps occur only in a click handler. Existing theme/sidebar initialization remains unchanged. The two observation-time displays now use explicit UTC formatting; workload numbers use `en-GB`, removing environment-dependent display formatting from these components. Selected hardware remains loading until its owned API result arrives instead of claiming no selection.

## Files

- `frontend/app/layout.tsx`: request-scoped session/query snapshot.
- `frontend/lib/server-auth.ts`: shared optional session resolver and protected-page reuse.
- `frontend/components/providers.tsx`: QueryClient hydration around shell/pages.
- `frontend/features/auth/use-auth.ts`: documents the server snapshot authority; async revalidation remains intact.
- `frontend/features/overview/dashboard.tsx`, `frontend/features/functional/journey.tsx`, `frontend/lib/observed-time.ts`: loading labels and deterministic display formatting.
- `tests/e2e/hydration.spec.ts`, `playwright.hydration.config.ts`: direct-request/refresh regressions against development or built servers.
- `tests/e2e/foundation.spec.ts`: existing M0 assertions preserved; real database fixture sessions replace incidental registrations so adding auth regressions does not exceed the unchanged production IP limit. M1 and hydration cases still exercise real registration/login/logout.
- `package.json`, README, STATUS and this note: verification commands/results.

No dependency, schema migration, password, user-owned record or deployment configuration change is needed.

## Regression boundary and commands

Seven cases cover authenticated SSR versus DOM, login followed by direct navigation and hard refresh in both themes, anonymous direct navigation/refresh in both themes, held-pending client auth revalidation, and anonymous → login → selected-profile loading/data → logout → anonymous refresh. They capture browser console/page errors and fail on hydration errors. Authenticated HTML is checked for no-store and absence of password/session-cookie bytes; anonymous HTML is checked for absence of the fixture's private identity. Browser locale/timezone is explicitly en-IN / Asia-Kolkata.

With other CoreWise listeners stopped, `pnpm test:e2e:hydration` starts the API and **Next development mode with Turbopack**, using PostgreSQL and exact generated disposable account identities. For built-server verification set `COREWISE_HYDRATION_MODE=production`; to inspect already running matching development listeners set `COREWISE_HYDRATION_REUSE=1`. Reuse is opt-in. The same tests also run in the normal full browser suite. No Python service or hardware benchmark is needed by this focused regression.

Final verification on **2026-11-18**: typecheck, lint, all **106 API tests**, production build and diff whitespace check passed. Fresh Next development/Turbopack verification passed **7/7**. Production browser verification of foundation, auth/hardware, functional journey and hydration passed **25/25**, including all seven hydration cases and both themes. Console/page error capture reported no hydration errors in exercised states. A full 71-case browser rerun is not claimed.

An intermediate parallel attempt exhausted Windows memory and crashed compiler/browser processes; verification was rerun sequentially with only required project services running. After the environment restart Docker was stopped; starting the existing persistent PostgreSQL container restored database-backed checks without reset. Both original accounts remain, and generated fixture accounts are zero. There is no remaining reproduced hydration error. Authenticated SSR requires the existing Express session service to be available; service failure remains an error, never a false anonymous snapshot. No deployment or additional milestone was introduced.
