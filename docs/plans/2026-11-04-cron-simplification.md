# Cron simplification and monitoring

Implement and release the recommendations from the November 4 production audit.

Plan:
1. Separate the small JSON health check from the daily link crawl. Give the crawl
   a time budget, resumable queue and atomic checkpoints; persist its cursor in
   Actions cache. Keep partial coverage explicit and report failures immediately.
   Open one GitHub incident on unhealthy checks and close it on recovery.
2. Define per-job cadence, stale limits and running limits. Report product source
   skips truthfully. Combine product families in one supervised entrypoint while
   preserving source allowlists, target leases and deadlines.
3. Cache only complete Discourse rosters for one day. Within the existing active
   staff scope (posted within a year), poll recent posters every 12 hours and
   others weekly. Keep due-work failures visible. Add transactional legacy LTS
   checkpoints with parser/lastmod checks and weekly full refreshes.
4. Close the invariant checker pool, remove the disabled issue child from core,
   verify the existing Package Manager redirect regression, and compare resource
   discovery sources before removing the empty sitemap. Update setup docs.
5. Test, review, commit main, and release. Reuse the editor-tooling service for
   all product groups with the union of source allowlists. Verify it before
   retiring the three old schedules. Change issue collection to every 30 minutes.
   Verify deployment SHAs, endpoints, health and real cron runs.

Review decisions (data correctness, operations, testing):
- Do not expand Discourse to all 2,311 staff in this change. Preserve its current
  one-year scope; daily roster refresh discovers returning posters. Sort due
  users by next due time, and advance checkpoints only after full processing.
- Cached rosters must come from a complete duplicate-free walk, not partially
  updated staff rows. A failed refresh must fail the run and retain old cache.
- Legacy checkpoints and release writes share a transaction. Invalid timestamps,
  missing/incomplete releases, parser changes and weekly expiry force refresh.
- Crawl cursor persistence must reach later pages and external links. Interrupted
  work cannot be called a complete audit. Artifacts include the explicit hidden
  output path. Health checks have their own workflow and parse HTTP-200 failures.
- Product migration must preserve all allowlists. Keep rollback configs for old
  workers; do not remove a referenced config and accidentally run the web server.
- GitHub scheduling is best-effort, not a guaranteed 30-minute alert deadline.
- Package manual redirect handling is already fixed; verify rather than broaden.

Execution:
- [x] Monitoring and resumable audit, with failure/continuation tests
- [x] Job health, combined product runner and schedule configs
- [x] Crawl checkpoints and cleanup, with database contracts
- [x] Review and full local verification; committed on main
- [x] Release, migrate schedules, verify live runs and endpoints

Implementation review fixed three issues: skipped overlap rows could mask a hung
collector; a child returning `not-configured` could look successful; and a sample
key based on the calendar could starve external links across multi-day crawls.
Regression tests cover all three, plus a real child interrupted during HTTP that
retains a valid cursor and partial report. No change to source request pacing.

Pre-release checks: typecheck, 1,147 unit tests (six skipped), all six database
contracts and production build passed. All 243 desktop/mobile browser tests passed
(nine skipped). Combined-run flags now preserve `--dry-run` and `--force`.
All 71 product source keys were preserved; no additional per-family override
variables were configured.

Production verification on November 4, 2026 (implementation commit `b8936b2`):
- Railway web deployment succeeded; `/`, `/stats`, `/releases`, `/api/health`
  and `/api/updates/health` returned 200. Both JSON health results were `ok`.
- Combined products completed all four families in 30 seconds without failures.
  Nothing was due; three retired sources were reported as retired.
- Issue reports completed in three seconds with no pending, due or failed items.
- Core completed all ten jobs in 443,959 ms; all 22 invariants passed.
  Discussions refreshed 47 roster pages, made 48 requests and skipped 462 users
  that were not yet due. This mid-cycle run does not establish steady-state cost.
- Only three collection schedules remain. The three replaced product services
  have no schedule, an inert command and no connected GitHub source. Variables
  and family configs remain available for rollback.
- GitHub verification passed on main and release (runs 41887594198 and
  41887642331). Production health workflow 41887642761 also passed.
