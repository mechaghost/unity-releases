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

## Local Development

Local Postgres runs in Docker:

```bash
docker ps --filter name=unity-releases-postgres
```

Connection string used locally:

```bash
postgres://unity:unity@localhost:54329/unity_releases
```

Start the preview:

```bash
DATABASE_URL='postgres://unity:unity@localhost:54329/unity_releases' npm run dev -- --port 3000
```

Useful checks:

```bash
npm test
npm run typecheck
DATABASE_URL='postgres://unity:unity@localhost:54329/unity_releases' npm run build
curl -sS http://localhost:3000/api/health
```

Known local note: running `next build` can disturb an active `next dev` server's `.next` output. Restart the dev server after production builds.

## Data And Ingestion

Important scripts:

```bash
npm run db:migrate
npm run ingest:editor
npm run ingest:packages
npm run ingest:news
npm run ingest:backfill
```

Current local database was populated from real Unity sources:

- Editor releases: latest, beta, alpha
- Package histories for key official packages such as Input System, Addressables, URP, HDRP, Cinemachine, Burst
- Official Unity blog/news RSS

Unity 6+ is the focus. The user explicitly does not care about pre-Unity-6 history right now.

## Current App Shape

Primary navigation:

- `/` - Today, release-first dashboard
- `/releases` - Editor release browse
- `/releases/[version]` - release detail with compact release-note workbench
- `/packages` - package browse
- `/packages/[name]` - package detail
- `/explorer` - global release-note workbench
- `/upgrade` - upgrade review lanes
- `/watch` - feed builder
- `/rss` - RSS output
- `/news` - broader official Unity news

Do not put `/api/health` back in primary navigation.

## Important Recent Work

Latest commits:

- `fa95969 feat: improve release detail notes`
- `4c3d109 feat: improve release intelligence IA`
- `be277cb docs: add repository workflow conventions`
- `90bae57 fix: use trigger-backed release note search vector`

Release detail pages now:

- show compact release-note rows
- clean raw markdown and `<br>` tags
- render compact `UUM-xxxxx` chips
- link `UUM-xxxxx` internally to `/issues/[issueId]`
- link `Tracker` chips to Unity Issue Tracker when available
- support scoped search, quick tabs, filters, grouping, ordering, and explicit result windowing

Global Explorer now:

- has labeled facets rather than raw unlabeled inputs
- groups by version
- shows active filter chips and result counts
- uses readable impact/risk labels

Upgrade Review now:

- groups target-version findings into active known issues, fixes gained, API/breaking changes, package changes, platform/install impact, and other notes
- still needs deeper true `from` to `to` diff semantics in future work

## Useful Implementation Files

- `src/lib/search.ts` - release-note SQL builders and whitelisted ordering
- `src/lib/classification.ts` - Unity-specific area/impact/risk classification
- `src/lib/release-notes/format.ts` - shared release-note text cleanup and issue-link helpers
- `src/lib/db/repositories.ts` - database reads/writes
- `src/app/explorer/page.tsx` - global release-note workbench
- `src/app/releases/[version]/page.tsx` - release-specific workbench
- `src/app/upgrade/page.tsx` - upgrade review lanes
- `src/app/styles.css` - shared UI styles

## Current Test Coverage

The suite currently includes parser, RSS, search SQL, classification, formatting, schema, normalization, and smoke tests.

Most recent verification before this handoff:

- `npm test` passed, 33 tests
- `npm run typecheck` passed
- `DATABASE_URL='postgres://unity:unity@localhost:54329/unity_releases' npm run build` passed
- `curl http://localhost:3000/api/health` returned `databaseConfigured: true`
