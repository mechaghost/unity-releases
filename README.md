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
4. Add separate Railway services for the cron jobs you want — each one
   reuses the repo and overrides the start command:

| Service | Start command | Notes |
|---|---|---|
| Web | `npm run start` | Healthcheck: `/api/health` |
| Migrate | `npm run db:migrate` | One-off, run once after creating the DB |
| Editor cron | `npm run ingest:editor` | Cron every 30–60 min |
| Package cron | `npm run ingest:packages` | Cron every few hours |
| News cron | `npm run ingest:news` | Cron daily |
| Backfill | `npm run ingest:backfill` | One-off |

Railway cron jobs should finish and exit. The job entrypoints under
`src/jobs/` already exit cleanly after a successful run.

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
