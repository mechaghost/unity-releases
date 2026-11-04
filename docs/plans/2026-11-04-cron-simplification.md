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
- [x] Review and full local verification; ready to commit main
- [ ] Release, migrate schedules, verify live runs and endpoints

Implementation review fixed three issues: skipped overlap rows could mask a hung
collector; a child returning `not-configured` could look successful; and a sample
key based on the calendar could starve external links across multi-day crawls.
Regression tests cover all three, plus a real child interrupted during HTTP that
retains a valid cursor and partial report. No change to source request pacing.

Pre-release checks: typecheck, 1,146 unit tests (six skipped), all six database
contracts and production build passed. All 243 desktop/mobile browser tests passed (nine skipped). Live release checks
remain. All 71 product source keys were preserved in the
prepared union; no additional per-family override variables were configured.
