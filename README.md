# Unity Releases

Unity Releases is an independent Unity 6+ release intelligence app. It tracks Editor releases, curated official package releases, Unity Hub/news sources, searchable release-note items, upgrade-impact signals, and watchable RSS URLs.

This project is not affiliated with, endorsed by, sponsored by, or approved by Unity Technologies or its affiliates.

## Stack

- Next.js App Router
- TypeScript
- Postgres with full-text search and `pg_trgm`
- Vitest
- Railway-ready cron entrypoints

## Local Setup

```bash
npm install
npm test
npm run typecheck
npm run build
```

Set `DATABASE_URL` before using DB-backed pages or jobs.

```bash
npm run db:migrate
npm run ingest:editor
npm run ingest:packages
npm run ingest:news
```

## Railway Deployment

Build is configured for **Railpack** in `railway.json` (auto-detects the
Next.js app, no `nixpacks.toml`/`Dockerfile` required). Deploys are
triggered from the `release` branch — push commits onto `release` when
you want production to update.

### One-time setup

1. Create a Railway project from the GitHub repo and pick the `release`
   branch as the deploy source.
2. Add a Postgres plugin to the project. Copy its
   `DATABASE_URL` into the web service's variables.
3. Set the remaining env vars on the web service:
   - `DATABASE_URL` (from the Postgres plugin)
   - `APP_BASE_URL` (your Railway-provided HTTPS URL)
   - `INGESTION_USER_AGENT` (e.g. `unity-releases/0.1 (+contact@example.com)`)
   - `PACKAGE_ALLOWLIST` (optional)
4. Add separate Railway services for the cron jobs. The repo ships
   ready-to-use Railway config-as-code files for each:

| Service | Config file | Cron schedule | What it does |
|---|---|---|---|
| Web (default) | `railway.json` | — (long-running) | `npm run start`, healthcheck `/api/health` |
| `cron-editor` | `config/railway/cron-editor.json` | `0 * * * *` (hourly) | `npm run ingest:editor` |
| `cron-packages` | `config/railway/cron-packages.json` | `0 */6 * * *` (every 6h) | `npm run ingest:packages` |
| `cron-news` | `config/railway/cron-news.json` | `0 5 * * *` (daily 5am UTC) | `npm run ingest:news` |

Each cron config sets `deploy.cronSchedule` + `deploy.startCommand` and
uses `restartPolicyType: NEVER` so a failed run doesn't loop. Jobs all
exit cleanly via `withIngestionTransaction` so Railway's "skip if
already running" guard never triggers.

For each cron service in the dashboard:
1. **+ New** → **Empty Service** (or use the CLI:
   `echo "" | railway add --service cron-<name>`).
2. Settings → **Source** → connect to `mechaghost/unity-releases`,
   branch `release`.
3. Settings → **Config-as-code** → set the path to
   `config/railway/cron-<name>.json`.
4. Variables — these are already set by the CLI helpers above:
   - `DATABASE_URL = ${{Postgres.DATABASE_URL}}`
   - `INGESTION_USER_AGENT = unity-releases/0.1 (+you@example.com)`

Trigger the first run manually via **Deploy** to validate; subsequent
runs fire on schedule. Logs are per-service.

`Backfill` and `Migrate` aren't cron — leave them as one-off services
or run them via `railway run --service <web> npm run ingest:backfill`.

### Seeding prod from your local DB

The dev DB built up by running `npm run ingest:*` against your local
Docker Postgres is canonical and large enough that re-running the
ingest jobs against an empty Railway Postgres is slow. Ship the
snapshot instead:

```bash
# Local: dump → stream into Railway Postgres
scripts/migrate-db-to-prod.sh "$RAILWAY_DATABASE_URL"

# Or preview the command first without applying:
scripts/migrate-db-to-prod.sh --dry-run "$RAILWAY_DATABASE_URL"
```

Requirements: Docker container `unity-alerts-postgres` running, `psql`
on PATH (`brew install libpq && brew link --force libpq`), and the
target `DATABASE_URL` from the Railway Postgres plugin. The script
streams `pg_dump --clean --if-exists` straight into `psql`, so the
target tables are dropped and rebuilt — point it at an empty DB or one
you're OK overwriting. After it finishes, the script prints row counts
for the main tables so you can sanity-check the load.

After seeding, you can skip the Migrate one-off (the dump already
shipped the schema) and let the cron services keep the data fresh.

## Functional Surfaces

- `/`: release-first hub
- `/explorer`: release-note search/filter surface
- `/upgrade`: rule-based upgrade-impact page
- `/watch`: no-account RSS/watch URL builder
- `/rss`: RSS feed endpoint
- `/api/health`: health endpoint
- `/api/release-notes`: search API
- `/api/releases`, `/api/packages`, `/api/events`: JSON APIs

## Current Limitations

- UI is intentionally plain; visual polish comes after functionality is tested.
- Jobs currently parse and report source data, with DB persistence ready through schema/repositories.
- Package discovery uses a curated allowlist, not registry-wide discovery.
- Issue Tracker pages are linked, not crawled.
