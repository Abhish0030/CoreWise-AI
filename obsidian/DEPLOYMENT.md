# Deployment readiness — CoreWise AI 0.8.0

This is an operator reference, not a claim of production deployment. The implemented topology is deliberately small: browser → TLS reverse proxy → Next.js → Express → PostgreSQL/private FastAPI. A separate Python worker claims durable training/SHAP jobs. The outbound-only benchmark runner remains on a separately authorized user machine. The LLM provider is optional and private to FastAPI.

## Supported reference topology

Use one trusted host with a private PostgreSQL service, one API instance, Next.js, FastAPI and the worker under an OS service manager. Bind app services to loopback. Only the TLS proxy accepts public traffic. `deploy/Caddyfile.example` is a reference, not a provisioned domain/certificate. The existing `docker-compose.yml` runs only PostgreSQL and binds it to loopback; it is useful locally, not a complete hardened production stack. Set a unique POSTGRES_PASSWORD in the operator environment; never use the local default in production. Do not run the benchmark runner in application containers or start it automatically with services.

Multiple API instances require a shared implementation for the existing IP/auth/report-request rate limiters, which currently use process-local storage. Database sessions, agent turn/call limits and report admission limits are shared, but they do not replace those IP/auth controls. Do not deploy multiple replicas with independent limit stores and claim equivalent protection. Multi-host private routing/proxy trust and an external shared limiter require a separately validated topology.

## Configuration

Copy `deploy/production.env.example` outside the checkout, replace all secret placeholders, and restrict file permissions to the service identity. Never commit the populated file. `pnpm production:check` validates the environment shape only; use `node --env-file=/etc/corewise/corewise.env scripts/check-production.mjs` on a host with a protected environment file. The template intentionally fails validation until placeholders are replaced. The check does not contact services or prove deployment/TLS/backup success.

| Variable                               | Consumer / requirement                                                                                               |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| NODE_ENV                               | Node API/web: production; activates Secure HttpOnly __Host- cookie rules                                             |
| APP_ORIGIN                             | Exact public HTTPS origin, no path/query/userinfo; CSRF Origin comparison                                            |
| HOST / PORT                            | Express bind, reference 127.0.0.1:4000                                                                               |
| API_ORIGIN                             | Next server requests and `/api` rewrite, reference http://127.0.0.1:4000                                             |
| AGENT_API_ORIGIN                       | Private Python callback to Express; reference same API origin                                                        |
| ML_ORIGIN                              | Express → private FastAPI, reference http://127.0.0.1:8000                                                           |
| DATABASE_URL                           | Prisma and Python worker/service; unique DB identity/password, private networking; TLS for remote PostgreSQL         |
| SESSION_SECRET                         | At least 32 random characters; unique to sessions                                                                    |
| ML_INTERNAL_TOKEN                      | Different random credential, at least 32 characters; trusted internal calls in both directions                       |
| TRUST_PROXY                            | `loopback` only for the documented local trusted TLS/Next proxy path                                                 |
| ML_ARTIFACT_ROOT                       | Absolute private persistent directory shared by Python service and worker; UUID files and registry hashes must agree |
| ML_EXPLANATION_TIMEOUT_SECONDS         | Default 60, bounded 5–120; enforce OS/container memory/CPU limits too                                                |
| LLM_PROVIDER / LLM_API_KEY / LLM_MODEL | Optional `openai-compatible` provider and tool-capable model; incomplete config means explicitly unavailable         |
| LLM_BASE_URL                           | Optional operator-controlled compatible endpoint; HTTPS for remote hosts, never browser-controlled                   |
| LOG_LEVEL                              | API structured logging; info recommended; avoid credential-bearing debug traces                                      |

No secret may use a NEXT_PUBLIC_ variable. CoreWise does not provide a browser secrets editor. The Next rewrite destination is captured during production build: supply the intended API_ORIGIN during build and rebuild if it changes. Keep server-runtime API_ORIGIN consistent with that build. A real HTTPS/proxy test must confirm the final `__Host-corewise.sid` cookie has Secure, HttpOnly, SameSite=Lax and Path=/ and that forged Origin/CSRF requests fail before opening access.

## Install and startup order

1. Install the pinned Node/pnpm versions from package.json and Python 3.13. Use an isolated service identity with a persistent private data directory. Check out the entire workspace including migrations and Python modules; never ship a developer `.env`, caches, volumes or test fixture outputs.
2. `pnpm install --frozen-lockfile`; create the ML virtual environment and install `backend/ml/requirements.lock.txt`. Run `pip check`. The benchmark runner has its own environment/lock and optional CUDA packages and is not installed as an automatic app service.
3. Start PostgreSQL and wait for readiness. Back up any existing database before applying a new release. Run `pnpm db:migrate` using the production environment; **never** use migrate reset or db push to bypass migration history. Generate Prisma with `pnpm db:generate` and build with `pnpm build` under the intended environment. M7 adds the eighth, additive report migration.
4. Create the artifact directory with restricted access. Restore/verify existing registry-matching model files if migrating an installation. API reports store snapshot/export bytes in PostgreSQL, not a public filesystem bucket.
5. Start private FastAPI from the repository root: `backend/ml/.venv/bin/python -m uvicorn corewise_ml.app:app --host 127.0.0.1 --port 8000`, with PYTHONPATH=backend/ml and the protected environment loaded by the service manager.
6. Start the separate worker: `backend/ml/.venv/bin/python -m corewise_ml.worker`, with the same PYTHONPATH, database, token and artifact root. Do not confuse the ML worker with the local benchmark runner.
7. Start Express: `node backend/dist/backend/src/index.js` from the root, with the validated environment. Start Next using `pnpm --filter @corewise/web start` on loopback port 3000. Supervise/restart each service separately with graceful shutdown; persisted sessions/jobs survive process restarts, not lost storage.
8. Configure the TLS proxy, DNS/firewall and certificate renewal. Confirm SSE buffering is disabled and proxy/read deadlines allow the bounded 80-second agent response (recommend at least 120 seconds). Confirm report attachments, CSRF, session expiry/logout and large validated CSV envelopes through the actual proxy. Only then expose the service.

Windows uses `.venv/Scripts/python.exe`; load the protected environment with the Windows service manager. Local helpers `pnpm dev`, `pnpm ml:serve` and `pnpm ml:worker` are development conveniences. No OS service installation, TLS certificate issuance, DNS configuration, image publication or cloud deployment is performed by this milestone.

## Health and operational checks

- `/api/health`: API process liveness, no database claim.
- `/api/ready`: actual PostgreSQL query; require success before admitting data operations.
- Next `/` and `/api/health` through the public origin: web/rewrite routing, then verify private pages require a session.
- FastAPI `/health`: bearer-authenticated. Supply the token from protected process configuration, not a browser or pasted diagnostic transcript. Status does not imply the worker is running.
- Worker: monitor supervised process and logs; queue progress/leases identify stalled work. Use a fixture-owned job for a release smoke check, clean up that exact identity, and never reset the database to make it pass.
- `/api/agent/status`: authenticated configured/NOT_CHECKED/CONNECTED/ERROR status. A configured key is not a successful external-provider request.
- Report downloads: authenticate ownership, check stored checksum metadata, PDF/CSV Content-Type, attachment filename and no-store/nosniff headers.

## Backup and recovery

Back up PostgreSQL with a consistent `pg_dump -Fc` or managed snapshot, using a protected PGPASSFILE/credential source rather than a password in command history. Reports include potentially private hardware/workloads/raw measurement snapshots and binary exports: include them in retention/access policies. Back up the private artifact directory and registry together; briefly quiesce training/activation around the coordinated snapshot or use an atomic storage snapshot. Keep environment secrets separately in a protected secret store. Encrypt backups and restrict recovery access.

Restore into an isolated database first, restore matching artifacts, apply only pending migrations, run readiness and verify selected artifact hashes, report checksums, owned histories, login and CSRF. Do not deserialize untrusted Joblib files. Old sessions may be invalidated deliberately on recovery/secret rotation; disclose that operational choice. Expired training/SHAP leases fail and require explicit retry. Expired agent turns become FAILED on later reads; cancelled hardware jobs do not execute themselves. Verify a restore before treating backups as usable. No destructive restore drill against the local/user database is claimed here.

## Logging, privacy and troubleshooting

Express emits structured Pino logs; Authorization, Cookie, CSRF, grant and Set-Cookie headers are redacted. Keep logs private and rotate them. Do not enable upstream SDK/debug prompt tracing for sensitive data without an explicit policy. Application filtering is best-effort, not comprehensive DLP. Never collect `.env`, runner vault credentials or whole request bodies in support tickets.

| Symptom                              | Check                                                                                                                  |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Database unavailable                 | DB service/readiness, private URL/port, role permissions, migrations and TLS settings                                  |
| Secure login cookie missing          | Exact HTTPS APP_ORIGIN, trusted loopback proxy chain, forwarded protocol, public cookie scope                          |
| CSRF 403                             | Same-origin browser API rewrite, fresh session token, exact origin, no cross-site Fetch Metadata                       |
| Job stays queued                     | Separate worker process/env, DB access and artifact permissions; do not reset queues/data                              |
| Model unavailable / hash mismatch    | Explicit model activation, correct private root/version/hash/dependency lock; retrain only owned data when appropriate |
| Assistant unavailable                | Private ML health, explicit provider/model/key, provider tool support, connectivity; no fake fallback exists           |
| SSE interrupted                      | Client Stop/disconnect, proxy buffering/deadline, provider/tool timeout; inspect retained terminal status              |
| Report source missing                | Select current owned completed records; generated historical snapshots remain independent                              |
| PDF/CSV integrity failure            | Treat as corruption, restore known-good stored bytes or regenerate a new report from available sources                 |
| CSV looks different in a spreadsheet | Formula-leading strings are apostrophe-escaped; original sanitized UTF-8 values remain in the saved snapshot           |

Release gates are the established typecheck/lint/build, PostgreSQL API tests, ML/agent/runner Python checks, Ruff and browser suites. API and browser suites must run sequentially because their real ML worker queue is shared. Test-only mocked provider runs must never be presented as live external LLM verification. See STATUS and SECURITY-REVIEW for executed results and remaining limits.

## Neon database preparation

Use the [Neon/pgvector runbook](NEON-PGVECTOR.md) for separate pooled/direct URLs, rotated credentials, verified backups, disposable branch testing, persistent model files/embedding cache and production approval. Local .env remains Docker-backed. Neither applying local vector migrations nor passing mocked tests establishes Neon production readiness. Production data restore and hosted deployment have not been authorized or executed by this follow-up.
