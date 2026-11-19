# Neon, Prisma and pgvector integration

This task extends the existing M0–M7 architecture. It does not deploy, switch local development to production, replace authentication, change personal IDs/passwords, or reset a database. See STATUS for executed results rather than treating this guide as a production-readiness claim.

## Existing architecture and audit

The actual Compose service is `postgres`, container `corewise-ai-postgres-1`, database/role `corewise`, PostgreSQL **17.7 Alpine**, loopback host port **55432**, volume `corewise-ai_corewise_postgres` mounted at `/var/lib/postgresql/data`. Prisma is **6.19.3** and retains its existing generator/schema/config and ten original migrations. Express owns database sessions, Argon2id authentication, CSRF, ownership and tool grants; private FastAPI/worker use psycopg for durable jobs and numerical ML. Groq remains the language-generation provider.

Before this task, 19 public tables included `_prisma_migrations`. Audit counts: 2 users, 68 sessions, 1 hardware profile, 2 workloads, 1 analytical comparison, 1 dataset with 600 MEASURED rows, 6 registered models / 2 active, 1 prediction, 1 measured run, 1 benchmark job, 1 training job, 1 local agent, 1 pairing, 1 conversation with 2 messages and 1 tool call. Reports and SHAP records were empty. There was no vector implementation. These counts are a snapshot, not application constants.

## Backup and tested restore

Stop application/worker writers before creating the cutover snapshot. Never run `docker compose down -v`, `prisma migrate reset` or a forced database push.

```powershell
backend/ml/.venv/Scripts/python.exe scripts/verify-local-backup.py
```

The local-only script validates the host, creates a timestamped custom-format archive under ignored `.artifacts/backups/`, verifies its archive listing, creates a uniquely named isolated restore database, restores with `--no-owner --no-acl --exit-on-error`, then compares every table's count and order-independent row digest. It also verifies and copies every registered Joblib file by its stored SHA-256. Errors with private connection details are withheld. Treat the archive as sensitive: it contains password hashes, session data and personal records. Preserve its access controls and never commit/upload it publicly.

Initial successful pre-migration restore: `20261118_155147` (19 tables, 10 migrations). Successful post-migration restore: `20261118_160908` (21 tables, 11 migrations, 2 knowledge documents / 26 chunks), including six verified model artifacts. Isolated restore databases remain available as evidence; no existing database was deleted. Original personal table digests were compared separately and unchanged. PostgreSQL records alone do not copy trained model files or the embedding cache.

## Local pgvector compatibility

`deploy/postgres/Dockerfile` builds pgvector **0.8.7**, pinned to upstream commit `f37c13f68b57d2c3472b2214fbcff699d6d34876`, against the same PostgreSQL 17.7 Alpine base. Only the extension library/SQL enter the final image; the runtime base, volume and port remain unchanged. `OPTFLAGS` avoids machine-specific compiler defaults. This avoids changing the cluster to a Debian/libc image or a different PostgreSQL major version.

For an existing database, verify backup/restore **before** rebuilding and applying the additive migration:

```powershell
docker compose build postgres
docker compose up -d postgres
pnpm db:migrate
pnpm db:generate
node scripts/database.mjs --environment local status
```

Migration `20261118160000_neon_pgvector_knowledge` enables `vector` and creates additive `KnowledgeDocument`/`KnowledgeChunk` tables, ownership/source/hash indexes and integrity constraints. Exact cosine search is used. HNSW is deferred until measured corpus size/query performance justify it. Existing migrations are unchanged.

## Separate local and Neon environments

Local `.env` remains Docker-backed. `COREWISE_DB_ENV` defaults to `local`; local services/commands refuse remote database hosts. Runtime Prisma uses pooled `DATABASE_URL`. The installed Prisma 6 config supplies `DIRECT_URL` (or the local URL fallback) to the classic CLI migration engine. No second Prisma project, serverless adapter or ORM was added.

Use `deploy/neon-development.env.example` as a template for ignored root **`.env.neon.development.local`**. Enter actual newly rotated values privately:

- `DATABASE_URL`: actual pooled Neon URL, with TLS and a bounded `connection_limit` such as 5.
- `DIRECT_URL`: matching direct endpoint/database/role, with TLS.
- `COREWISE_DB_ENV=neon-development`.
- `NEON_BRANCH_NAME`: actual disposable development branch name, never production/main.
- `NEON_CREDENTIALS_ROTATED=true`: only after rotation and checking the destination in Neon.
- `NEON_BRANCH_ID`: actual intended branch ID if available.
- `NEON_PROJECT_ID` and `NEON_API_KEY`: optional for read-only inspection; needed for independent branch verification before restore if the database does not report a matching `neon.branch_id`.

Never copy an exposed screenshot credential. Rotate the role password in Neon, update only private files/secret storage, restart affected services and revoke/rotate an exposed Neon API token separately. The helper does not perform credential rotation on your behalf. Never use `NEXT_PUBLIC_` for database or provider configuration. `.env.neon.production.local` is a separate, privately configured production file used only after approval.

```powershell
# Read-only, no import or schema writes
backend/ml/.venv/Scripts/python.exe scripts/neon-transfer.py --environment neon-development inspect
```

The probe reports connection/version/table/extension state without DSNs/passwords. Branch names cannot safely be inferred from a database name such as neondb. Before restore, branch identity must match a server-reported branch ID or Neon API endpoint→branch metadata. The tool refuses restore if verification is absent. A manually entered branch label alone is insufficient proof.

After independently verifying and restoring the development branch, stop local application listeners and run `pnpm dev:neon` to test the complete application explicitly against it. The launcher merges common private service/session/Groq settings with the development DB file, verifies branch identity/schema through the read-only probe, then starts the normal pnpm workspace services. It refuses production. Ordinary `pnpm dev` continues to use local `.env`; no file is rewritten by selection.

The Node migration helper suppresses raw Prisma CLI datasource output. `node scripts/database.mjs --environment neon-development status` uses the private development file. `migrate` applies schema to a clean environment **only when that is the chosen strategy**; do not run it before the full-data restore strategy below. Direct `prisma` commands retain the config's environment guards. Every remote migration is admitted only after the guarded helper independently verifies the exact direct endpoint, database, role and branch through the read-only probe. A process-only proof marker is issued to its Prisma child; direct remote mutation commands without that proof are refused. Production additionally requires the explicit cutover flag; no automatic production operation is scheduled.

Python removes Prisma-only `schema`, `connection_limit`, `pool_timeout` and `pgbouncer` parameters before libpq, keeps TLS, uses a ten-second connection timeout and disables server-side prepared statements for pooled transaction compatibility. Configure connection limits for the actual deployed instance count; process-local API rate limits still need shared storage for multiple replicas.

## Migration strategy and destination safety

Chosen strategy for an **empty, verified branch**: restore the complete newly verified archive, including schema, IDs, relationships, timestamps, hashes and `_prisma_migrations`. Do not first apply schema migrations then mix in an unreviewed restore. Destination inspection must show a compatible PostgreSQL major (17 or newer), vector availability and no public tables. Nonempty destinations are refused rather than overwritten or merged.

```powershell
backend/ml/.venv/Scripts/python.exe scripts/neon-transfer.py --environment neon-development restore --backup .artifacts/backups/ACTUAL_VERIFIED_TIMESTAMP
node scripts/database.mjs --environment neon-development status
```

The restore uses direct TLS and `pg_restore --single-transaction --no-owner --no-acl --exit-on-error`. Credentials travel in process environment, not command-line values or logs. All restored table counts/digests must match the verified archive. A failed transactional import is not a successful migration. No production write is authorized by a development test.

If a branch already contains application data, stop and prepare a separate conflict/merge plan with backups. Do not drop its schema or reset its migration history. Test authentication/session persistence, complete application workflows, vector retrieval and private model artifacts against the actual development environment before requesting production cutover approval.

## Knowledge schema and embedding pipeline

`KnowledgeDocument` retains an optional owner FK, explicit PRIVATE/PUBLIC scope, source type/ID, title, original text, content hash, provenance, model ID/revision/dimension and timestamps. `KnowledgeChunk` retains stable parent linkage, chunk index, original text slice, chunk hash and `Unsupported("vector(384)")`. Public rows are restricted to operator-curated project documentation; private rows require an owner. Partial unique source indexes make per-owner/source replacement deterministic; a transaction lock serializes concurrent replacement. Atomic reindexing avoids partial corpora. Deletion cascades chunks.

The embedding model is **sentence-transformers/all-MiniLM-L6-v2**, pinned revision **1110a243fdf4706b3f48f1d95db1a4f5529b4d41**, dimension **384**. The CPU-only pipeline uses Sentence Transformers 6.3.0, Transformers 5.23.0 and PyTorch 2.15.0+cpu; exact dependencies are in the lockfile. It preserves original casing and source text using token offsets, with 192-token windows / 32-token overlap. The document fingerprint includes chunk policy `cw-token-offset-192-32-v1`; reindex when that policy changes. Vectors are finite, nonzero and normalized; model/revision/dimension are checked before insertion and retrieval. Different models cannot silently share this column/index.

```powershell
backend/ml/.venv/Scripts/python.exe -m pip install -r backend/ml/requirements.lock.txt
$env:PYTHONPATH='backend/ml'
backend/ml/.venv/Scripts/python.exe -m corewise_ml.knowledge
```

This explicit warm command downloads once into ignored `backend/ml/embedding-cache` (or private `ML_EMBEDDING_CACHE`). HTTP requests load only cached files and reuse one model instance; they do not download models. One embedding operation runs per process at a time, one CPU thread, 24k source characters / 64 chunks maximum, 192 query tokens, batch size 16. Private FastAPI authenticates embedding calls with its existing internal bearer credential. A missing cache is an explicit unavailable error. Preserve/warm the revision on each deployment host; database restore does not restore it.

Plain text/Markdown is supported, along with selected owned structured report/workload summaries. Credentials, PostgreSQL DSNs, known private values and contact email patterns are rejected before indexing; this is conservative screening, not a comprehensive DLP guarantee. No arbitrary URL crawling, filesystem upload path, PDF/OCR pipeline or automatic private-vault scan is provided.

## APIs and ownership

All browser calls use Express through the existing Next `/api` rewrite, database session and CSRF header on POST/DELETE, including searches. No Neon Auth replacement is introduced.

| Route                                       | Purpose                                                    |
| ------------------------------------------- | ---------------------------------------------------------- |
| POST `/api/knowledge/documents`             | Index private validated text/title, optional own source ID |
| POST `/api/knowledge/sources`               | Index an owned REPORT or WORKLOAD summary by source ID     |
| GET `/api/knowledge/documents`              | Bounded visible metadata list                              |
| GET `/api/knowledge/documents/:id`          | Visible original text and chunk metadata; no vector output |
| POST `/api/knowledge/documents/:id/reindex` | Rebuild an owned private document atomically               |
| DELETE `/api/knowledge/documents/:id`       | Delete an owned private document and chunks                |
| POST `/api/knowledge/search`                | Query plus optional sourceType; limit 1–6                  |

SQL uses Prisma parameter binding. A transaction-local five-second statement timeout bounds exact search. Owner/private OR explicitly public project scope is enforced inside the SQL. Returned values include chunk/source IDs, title, text, scope, provenance and cosine similarity. The 0.15 minimum similarity is a retrieval heuristic, not calibrated confidence or a factual guarantee. Embeddings/raw vectors do not enter browser responses.

Operator-only public seeding is restricted to two reviewed methodology sources; the benchmark source uses an explicit technical excerpt that excludes pairing/setup material. No HTTP or agent write tool can publish documents:

```powershell
# Existing private ML service must be running; this is local by default.
pnpm exec tsx --env-file=.env scripts/seed-knowledge.ts
# Explicit rebuild of only the fixed public sources
pnpm exec tsx --env-file=.env scripts/seed-knowledge.ts --reindex
```

## LangGraph RAG and evidence

The assistant now has 20 allowlisted tools. `search_corewise_knowledge` accepts validated query, bounded limit and optional source filter; it returns actual authorized chunk references at `/api/knowledge/documents/:id`. It uses the same fixed Express callback, expiring session/CSRF-bound grant, ownership and six-call/two-round budgets. It grants no ingestion, SQL, file, arbitrary HTTP or execution capability.

For GPU overhead questions, combine structured selected hardware / exact compatible benchmark / prediction / optimization tools with semantic methodology support. Actual numeric records remain authoritative; retrieved prose is untrusted supporting data, never a system instruction, measurement or replacement prediction. The versioned prompt explicitly distinguishes these roles and prohibits invented citations. Groq generates language; LangGraph selects tools; MiniLM creates vectors; pgvector stores/searches vectors; Prisma handles relational data; Docker supplies local PostgreSQL; Neon supplies managed production PostgreSQL. The trained CoreWise regressors and native runner remain separate.

## Production cutover and rollback — approval required

Do not run production writes until nonproduction migration and full application verification pass **and the user explicitly approves the production cutover**. The following is a reviewable runbook, not an executed deployment:

1. Freeze application, job/runner and worker writes; make a final verified backup. Inspect the actual production branch read-only. If nonempty, stop for a separate merge plan.
2. Privately configure `.env.neon.production.local` with newly rotated pooled/direct TLS endpoints, `COREWISE_DB_ENV=neon-production`, actual production branch identity and independent branch verification credentials.
3. Execute the approved import:

```powershell
backend/ml/.venv/Scripts/python.exe scripts/neon-transfer.py --environment neon-production inspect
backend/ml/.venv/Scripts/python.exe scripts/neon-transfer.py --environment neon-production restore --approved-production-cutover --backup .artifacts/backups/ACTUAL_FINAL_VERIFIED_TIMESTAMP
node scripts/database.mjs --environment neon-production status
# Only for subsequent reviewed additive migrations, or an idempotent no-pending check:
node scripts/database.mjs --environment neon-production --approve-production migrate
```

4. Copy the six verified Joblib files and their manifest to the deployment's private persistent artifact directory; verify each hash against restored MLModel metadata. Preserve file access boundaries. Warm the pinned embedding cache on the destination. Do not expose Joblib paths/files through web serving.
5. Supply the selected environment to the hosted Express and private ML/worker secret configuration, preserve session/internal/Groq secrets and deploy through a separately approved deployment task. Never edit local `.env` to production. Run `pnpm production:check` with the actual production environment.
6. Verify HTTPS auth/login/logout/session persistence, all personal data boundaries, real inference, authorized runner connectivity, reports, conversations and live structured+RAG evidence. Resume writes only after checks pass.

Before new Neon writes, rollback can retain the prior application release and Docker connection; local data was never reset. After Neon accepts new writes, do not blindly switch to an older local snapshot: freeze writes, back up both sides and reconcile/reverse-migrate the delta. Keep the additive vector tables/extension when rolling back application code. Do not swap back to a server image without its installed extension library or drop existing data.

Neon live connectivity, branch state, remote restore and production behavior must be separately verified with rotated credentials. Local success, mocks and an authenticated Groq response do not establish production readiness.
