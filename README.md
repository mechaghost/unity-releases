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

Create a Railway Postgres database and set:

- `DATABASE_URL`
- `APP_BASE_URL`
- `INGESTION_USER_AGENT`
- `PACKAGE_ALLOWLIST`

Recommended services:

- Web: `npm run start`
- Migration one-off: `npm run db:migrate`
- Editor cron: `npm run ingest:editor`
- Package cron: `npm run ingest:packages`
- News cron: `npm run ingest:news`
- Backfill one-off: `npm run ingest:backfill`

Railway cron jobs should finish and exit. The current job entrypoints parse and report source state; the repository layer and schema are in place for persistent ingestion.

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
