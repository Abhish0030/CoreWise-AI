# ADR 0002: Express sessions, CSRF, and user-owned hardware

Status: Accepted for M1, 2026-11-12.

## Decision

Express remains the authentication authority. `express-session` generates and signs session identifiers; a small Prisma Store adapter persists only its server-side payload and absolute expiration. This is storage integration, not custom cryptography. `argon2` uses Argon2id (64 MiB, three iterations, parallelism one). `csrf-sync` provides synchronizer tokens and comparison through the session. There is no frontend token or credential storage.

Cookie settings, session regeneration, saving before responding, and database storage follow the [Express session middleware documentation](https://expressjs.com/en/resources/middleware/session/). The server uses HttpOnly, SameSite=Lax, a fixed eight-hour lifetime, production Secure cookies with the `__Host-` prefix, and no rolling extension. Login/registration regenerate sessions. Logout destroys the database record. Tokens are regenerated with the session, and public responses never include credentials or session IDs.

State-changing operations, including pre-authentication registration/login, require a session-bound custom CSRF header. Exact Origin checks and cross-site Fetch Metadata checks add defense in depth. The design follows the [OWASP synchronizer-token guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) and uses [csrf-sync](https://github.com/Psifi-Solutions/csrf-sync) rather than implementing token cryptography.

## Personal routes and ownership

The original overview and feature descriptions remain public because they are demonstration/empty views. `/hardware-library` and `/profile` check the Express session during server rendering; no cookie-presence-only gate is treated as authentication. APIs independently check the session and user existence. Next.js server fetches forward only the cookie to the configured private Express origin with `cache: no-store`.

Hardware reads, updates, deletes, and default/selection connects all scope their database keys to both profile ID and authenticated user ID. Another user's ID returns 404. Strict Zod inputs reject owner IDs and provenance supplied in request bodies. The server always sets `USER_ENTERED`.

The user has one nullable default-profile reference and one independent selected-profile reference. Each action verifies ownership atomically through a composite owned-ID connect. PostgreSQL foreign keys clear those references on deletion. Selection is persisted for future analysis; no workload calculation is implemented in M1.

## Compatibility and limits

Migrations are additive, including nullable unknown specifications, and preserve M0 records. Legacy profiles without CPU manufacturer can be displayed and completed during editing. Existing session rows lacking express-session data cannot authenticate and expire normally. M0 health/capability response envelopes and disconnected/demo monitoring behavior remain intact; the public capability version advances to M1.

Search/filter is client-side within the user's inventory. The single API process uses an in-memory rate limiter; multiple instances need shared limiter storage before production scaling. Password reset, email verification/change, MFA, device session management, and production TLS deployment are beyond this milestone. HTTPS configuration is integration-tested through a trusted-loopback-proxy simulation; a live production deployment is not claimed.
