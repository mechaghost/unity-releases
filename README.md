# Unity Releases

Unity Releases is an independent Unity 6+ release intelligence app. It
tracks editor releases across LTS / Supported / Beta / Alpha streams,
the official Unity package registry, and the Unity blog. Every parsed
release-note item is bucketed into impact lanes (blockers, breaking,
API, security, packages, features, fixes, …), filterable per-view via
a drawer that supports persona presets, saved presets, and shareable
URL-encoded filter state. Diff two versions side-by-side at `/compare`,
or drill into one release at `/releases/[version]`.

This project is not affiliated with, endorsed by, sponsored by, or
approved by Unity Technologies or its affiliates. See `/faq` for the
data-source list and disclaimer.

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

Keep normal preview data in the local database's `public` schema and set that
connection in `.env.local`. After `npm run build`, run `npm run preview` on
port 3100. The preview command rejects browser-test fixture connections. Browser tests use
port 3101, `.next-e2e`, and the separate `unity_alerts_e2e` schema; they must
never be used as the normal preview. `npm run test:e2e` manages its own server.

```bash
npm run db:migrate
npm run ingest:editor
npm run ingest:packages
npm run ingest:news
```

To repair a single incomplete Unity 6+ release from the official API, use:

```bash
npm run ingest:backfill -- --version 6000.3.26f1
npm run check:invariants
```

This fetches only the exact version and its notes. Complete, current-parser
releases are skipped; incomplete rows are repaired without `FORCE_BACKFILL`
or a parser-version bump. Failed responses and incomplete modern release
bundles are rejected before replacing stored data.

Linked bug report search is available behind separate collection/search flags. See
[`docs/issue-report-search-operations.md`](docs/issue-report-search-operations.md)
for the compatibility rollout, backfill commands, coverage, limits, and rollback.

Optional Product Updates has separate jobs and is disabled by default. See
[`docs/product-updates-operations.md`](docs/product-updates-operations.md) for
feature flags, source allowlists, dry runs, snapshot replay, health, and
rollback.

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
| Web (default) | `railway.json` | — (long-running) | Migrate schema, then start web server |
| `cron-all` | `config/railway/cron-all.json` | `0 0,12 * * *` | Core collection and data checks |
| `cron-updates-editor-tooling` (combined worker) | `config/railway/cron-updates.json` | `15 */6 * * *` | All product families; targets keep their 12h/daily/weekly cadence |
| `cron-issue-reports` | `config/railway/cron-issue-reports.json` | `5,35 * * * *` | Due issue reports, eight-minute budget |

The combined product worker reuses the existing service ID. Its allowlist is the
union of the four old workers (71 source keys at migration). The three replaced
services use `cron-retired.json` and have their repository sources disconnected.
Old family configs remain for rollback; do not enable them alongside the combined
worker. The issue collector retains its shared lock and ten-second request spacing.

Each cron config sets `deploy.cronSchedule` + `deploy.startCommand` and
uses `restartPolicyType: NEVER` so a failed run doesn't loop. Core jobs
exit cleanly via `withIngestionTransaction`; Product Updates family jobs
run bounded child processes, close their database pool, and report all
source outcomes before exiting.

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

After deploying the build, trigger a validation run with
`railway cron run --service <name> --yes` (CLI 5+). Deploying a cron service does
not execute it. Check `railway cron list --service <name> --json` for completion.

Core includes an incremental historical backfill. Migrations run at web startup.
See [cron operations](docs/cron-operations.md) for monitoring, crawl checkpoints,
freshness thresholds, and rollback.

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

- `/`, `/whats-new`: current release guides; `/whats-new/past-releases`: superseded guides
- `/releases`, `/releases/[version]`: editor release index + per-release notes
- `/compare?from=X&to=Y`: diff lanes between two versions
- `/packages`: official Unity package index with paged history dialogs
- `/news`: official Unity blog feed
- `/explorer`: release-note search/filter surface
- `/upgrade`: redirects to `/compare`, preserving supported filters
- `/issues/[issueId]`: every release-note that mentions a UUM-xxxxx
- `/faq`: source list + disclaimer
- `/updates`, `/updates/[family]`, `/updates/products/[product]`: optional,
  family-tiered Unity product changelogs
- `/api/health`: health endpoint (used by Railway)
- `/api/updates`, `/api/updates/health`: optional Product Updates data and health
- `/api/release-notes`: search API
- `/api/releases`, `/api/packages`, `/api/events`: JSON APIs

## Current Limitations

- Package discovery uses a curated allowlist (`src/lib/ingest/unity-packages.ts`)
  because Unity doesn't publish a registry-listing endpoint.
  `npm run check:packages` surfaces `com.unity.*` mentions in editor
  release notes that aren't in the list yet.
- Unity Issue Tracker pages are linked, not crawled.
- Backport-status filter is blocked on missing source data — see
  `docs/filter-plan.md` § Phase 3.

## Verification and link upkeep

Pushes to `main` and `release`, and pull requests, run `.github/workflows/verification.yml`:
unit tests, type checking, database contracts, and desktop/mobile browser regressions.
Database tests use disposable schemas; never point the browser fixture setup at a production database.
The browser suite builds production code before testing it.

A separate `site-health.yml` checks ingestion health every 30 minutes and opens
one incident issue on failure, closing it after recovery. Scheduling is best-effort.
A daily Actions check (`site-links.yml`, 09:30 UTC) resumes a bounded internal
crawl and checks a rotating sample of external links.
Run it manually with:

```bash
npx tsx scripts/check-site-links.ts --site https://unityreleases.com --max-pages 2000 --budget-seconds 1200 --resume .artifacts/link-cursor.json --output .artifacts/link-check.json
```

It detects HTTP errors, Unity's HTTP-200 not-found pages, missing internal anchors,
and unhealthy ingestion payloads. It also follows package-history pages using the
same link parser as the dialog. It stops checking a host after 403/429, bounds
requests and response sizes, and never calls the analytics write endpoint.
Failures return exit code 1; an incomplete one-shot crawl returns exit code 2.
With `--resume`, a saved partial slice can pass while reporting unchecked pages.
Blocked URLs, request limits, and unsampled external
links remain explicitly unverified in the JSON artifact. Use `--require-complete`
to return exit code 2 when there are no confirmed failures but verification is
incomplete. Set `--max-pages`, `--external-limit`, and `--sample-index` to control
coverage. A successful bounded run is not proof that every external link works.

Confirmed removed sources are listed in `src/lib/external-links.ts`. Their text
and original URL remain available, but the UI labels them “Source unavailable”
and does not send users to dead pages. Recheck a listed destination before
removing it from that list; a 403/429 is not evidence of removal or recovery.
Never replace an old source with a guessed URL.

Core freshness uses whole-job records for all eight scheduled imports, including
separate modern Editor, legacy Editor, registry, and package-docs jobs. A recent
failure stays visible during a retry. Missing successes and more than 36 hours
without success are unhealthy for the 12-hour schedule. `/api/health` returns
HTTP 200 while the database works, even if ingestion is stale, so an upstream
outage does not block a healthy web process. `npm run health:ingest` returns a
nonzero exit code for failed, never-run, stale, or unavailable ingestion.
The issue collector is tracked separately at a 30-minute cadence, with two-hour
staleness and a 15-minute running limit. Overlap/cooldown skips do not refresh health.

The additive audit migration creates `core_job_runs` and resource availability
fields. Run `npm run db:migrate` before running the new jobs/web code. Existing
per-item success records are not treated as proof of whole-job success: a newly
upgraded database shows jobs as never completed until each new scheduled job
finishes. Confirm freshness after the next full scheduled cycle. Resource imports
also recheck up to 100 older URLs per run, including URLs no longer in the sitemap;
confirmed 404/410 responses hide the entry without deleting history, and a later
valid response restores it.

Audit evidence and repair acceptance are in
[`docs/audits/2026-10-24-site-audit/`](docs/audits/2026-10-24-site-audit/report.md).
