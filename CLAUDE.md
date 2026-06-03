# Unity Releases Handoff

This file captures the current project state and working conventions for another coding assistant.

## Project Goal

Unity Releases is a release-first Unity 6+ intelligence hub. It should help Unity developers quickly understand:

- latest Unity Editor releases across stable/beta/alpha streams
- official Unity package updates
- dense release-note search and filtering
- upgrade risk by version, platform, package, area, issue ID, impact, and risk
- broader official Unity news/blog posts, secondary to release intelligence

The user wants functionality tested first. Visual polish can come later, but information architecture and parseability matter a lot.

## User Preferences

- Always commit completed work to `main` unless the user explicitly asks otherwise.
- Railway deploys from the `release` branch.
- If the user says `release`, treat that as updating/pushing the `release` branch for Railway deployment, not a GitHub release/tag.
- Avoid force-pushing or rewriting history unless explicitly approved.
- **Always verify the site after a deploy. Never depend on the user to flag breakage.** After every `release` push, wait for Railway to finish building, then probe `/`, `/stats`, `/releases`, and `/api/health` for 200s. If anything 5xxs, pull `railway logs --service unity-releases`, find the root cause, fix it, and push another release in the same session. Common breakage classes: middleware bundle pulling in Node-only deps (Edge runtime can't load `pg`/`crypto`); schema changes that haven't been migrated with `railway run npm run db:migrate`; server-only modules imported into client components. The post-deploy probe is a hard requirement, not a courtesy.

## Local Development

Local Postgres runs in Docker (container name predates the repo rename — it's still `unity-alerts-postgres` and the database is still `unity_alerts`; `scripts/migrate-db-to-prod.sh` defaults to the same name when pushing to Railway):

```bash
docker ps --filter name=unity-alerts-postgres
```

Connection string used locally:

```bash
postgres://unity:unity@localhost:54329/unity_alerts
```

Start the preview:

```bash
DATABASE_URL='postgres://unity:unity@localhost:54329/unity_alerts' npm run dev -- --port 3000
```

Useful checks:

```bash
npm test
npm run typecheck
DATABASE_URL='postgres://unity:unity@localhost:54329/unity_alerts' npm run build
curl -sS http://localhost:3000/api/health
```

Known local note: running `next build` can disturb an active `next dev` server's `.next` output. Restart the dev server after production builds.

## Data And Ingestion

Important scripts:

```bash
npm run db:migrate
npm run ingest:all       # runs every ingest job in sequence (Railway cron uses this)
npm run ingest:editor
npm run ingest:packages
npm run ingest:legacy-lts
npm run ingest:news
npm run ingest:resources
npm run ingest:backfill
npm run check:packages   # surfaces com.unity.* mentioned in release notes but not in the curated list
```

Production ingestion is one mega-cron on Railway running
`npm run ingest:all` twice a day (00:00 + 12:00 UTC). The orchestrator
lives in `src/jobs/poll-all.ts` and shells out to each
`npm run ingest:*` in sequence. A per-job failure logs and continues
so a flaky news endpoint can't block fresh package data; the run
exits non-zero at the end so Railway flags it as failed.

Current local database was populated from real Unity sources:

- Editor releases: latest, beta, alpha
- Package histories for key official packages such as Input System, Addressables, URP, HDRP, Cinemachine, Burst
- Official Unity blog/news RSS

Unity 6+ is the focus. The user explicitly does not care about pre-Unity-6 history right now.

### Catching missing packages

Unity has no list endpoint for `com.unity.*` packages — `UNITY_OFFICIAL_PACKAGES`
in `src/lib/ingest/unity-packages.ts` is the canonical curated list. To
catch new packages Unity ships, run `npm run check:packages` after each
`npm run ingest:editor`. It prints any `com.unity.*` package mentioned in
the editor release notes that isn't in the curated list, sorted by
mention count. Add the ones worth tracking to the list and re-run
`npm run ingest:packages`. Built-in `com.unity.modules.*` are skipped
(they're not registry entries).

## Current App Shape

Primary navigation (sidebar on desktop, drawer on mobile):

- `/` - serves the compare view (re-exports `/compare/page`)
- `/releases` - editor release index, paginated, with stream filter
- `/releases/[version]` - release detail with lane-bucketed parsed notes
- `/compare?from=X&to=Y` - diff view, lane-bucketed, with sub-range slider
- `/packages` - package index (sortable; no per-package page yet, only `/api/packages/[name]`)
- `/news` - official Unity blog feed
- `/resources` - Unity 6 ebooks/videos/webinars/podcasts/articles, marketing+enterprise filtered out by default
- `/stats` - tracked-artifact counts, ingestion freshness, and traffic (self-hosted analytics, no third-party services)
- `/faq` - source list + not-affiliated-with-Unity disclaimer
- `/explorer` - global release-note workbench (faceted search)
- `/upgrade` - upgrade review lanes
- `/issues/[issueId]` - every release-note that mentions a UUM-xxxxx

Do not put `/api/health` back in primary navigation.

## Analytics

Self-hosted: pageviews land in the `page_views` table via an Edge
middleware that fire-and-forgets a POST to `/api/track`. Server-side
events (filter applies, compare loads, copy-to-LLM clicks) land in
`site_events` via `recordEvent()` from `src/lib/analytics.ts`. No IPs,
UAs, or cookies are stored - the goal is volume signal, not visitor
fingerprinting. The `/stats` page reads these tables. Bots are
filtered at the middleware via user-agent regex.

After any schema change, run `npm run db:migrate` against prod with
the Railway DATABASE_URL (`railway run npm run db:migrate` works from
any worktree).

## Filter system

Both `/compare` and `/releases/[version]` share a Filter drawer
(`src/app/_components/FilterDrawer.tsx`) backed by a single state
shape (`src/lib/filters.ts`). State is URL-encoded for shareability +
sticky cookie for persona/saved presets. Plan + decisions in
`docs/filter-plan.md`.

## Useful Implementation Files

- `src/lib/search.ts` - release-note SQL builder (filters + COUNT() OVER for pagination)
- `src/lib/filters.ts` - filter state + presets + URL/cookie projection
- `src/lib/classification.ts` - Unity-specific area/impact/risk classification
- `src/lib/lane-catalog.ts` - canonical lane id → title/variant/impactPill map (shared by compare + release detail)
- `src/lib/release-notes/format.ts` - shared release-note text cleanup and issue-link helpers
- `src/lib/db/repositories.ts` - database reads/writes (incl. getReleaseRangeFacets)
- `src/lib/ingest/unity-packages.ts` - curated package allowlist (run check:packages after editor ingest)
- `src/app/_components/{ReviewLanes,FilterDrawer,FilterBar,NoteRow}.tsx` - shared lane + filter UI
- `src/app/compare/page.tsx`, `src/app/releases/[version]/page.tsx` - the two main lane views
- `src/app/styles.css` - shared UI styles
- `scripts/release.sh` - promote main → release for Railway deploy
- `scripts/migrate-db-to-prod.sh` - one-shot dev DB → Railway DB seeding

## Current Test Coverage

`npm test` runs the full Vitest suite — 297 tests across 38 files
covering parsers, classification, search SQL, lane logic, ingestion
normalization, filter state round-trips, server actions, component
renderers, release-note body tokenization, SEO metadata, sitemap
shape, the cron orchestrator, and the analytics middleware +
tracking route.

Run `npm run typecheck` + `npm test` before committing anything
non-trivial. Both must pass.
