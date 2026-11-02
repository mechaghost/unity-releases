# Linked bug report search

The feature defaults off in code. Production enablement follows the steps below.

## Enable safely

1. Deploy the application with both flags below false before applying the schema.
   It explicitly selects existing API fields, so later schema additions cannot
   leak internal search columns. Commit `9ba496a` contains that compatibility change;
   the full implementation also works before the new schema when both flags are off.
2. Apply `npm run db:migrate`. It adds report storage and search functions/columns,
   without rebuilding all existing notes or creating the new GIN index.
3. Upgrade and drain old editor/legacy/backfill/manual writers before collection.
   New import, report writes, and vector repair share a short transaction lock.
   Legacy collection and projection repair now commit one release at a time.
4. Run `npm run ingest:issue-reports -- --inventory` to count referenced, available,
   unavailable, failed, and pending reports by release line. Choose the initial
   lines from current Unity support information; existing stream labels alone do
   not establish current support dates.
5. Set `ISSUE_REPORT_COLLECTION_ENABLED=true` and `ISSUE_REPORT_MINOR_LINES` to an
   explicit comma-separated list on the cron service. For broad coverage, use the
   dedicated `cron-issue-reports` service, following the `release` branch and
   using the existing Postgres database. Configure its start command as
   `npm run ingest:issue-reports`, cron as `*/10 * * * *`, and restart policy as
   `NEVER` directly on Railway. New Railway services no longer read the legacy
   JSON config files used by this repository's older services. Set the same variables on
   the web service for health reporting. Leave search disabled.
6. Seed the customer example with `npm run ingest:issue-reports -- --issue UUM-145761`.
   Use `--version 6000.3.23f1` for a bounded release backfill. Run again to resume
   pending work; successful reports are cached and normally due again after a week.
7. Run `npm run repair:issue-report-search`. It rebuilds missing/outdated vectors
   in batches of 100, then builds the GIN index concurrently on a maintenance
   connection (15-minute statement timeout, five-second lock timeout). It checks
   index validity and repairs invalid indexes on rerun. Report changes rebuild
   affected notes automatically. NULL vectors fall back to the original index.
8. Check supported-line coverage, failed/pending reports, query performance, and
   the customer API/UI searches. Confirm the index is valid. Enable
   `ISSUE_REPORT_SEARCH_ENABLED=true` on the web service only after these checks.
   The same flag controls search, result context, and the search text in llms.txt.
9. Use explicit `--all` runs to add historical references only after measuring
   sustainable refresh capacity. No command fetches more than 100 reports per run.

Environment values must be exactly `true` to enable a flag. Flags are independent.
Disabling collection does not disable cached search; disabling search immediately
restores original matching and removes the added `issueReports` response field.
Keep the schema/cache when rolling back. Do not reverse database migrations.
Follow the repo Railway release workflow and verify the four health routes plus
the customer search after deployment.

## Collection and health

Collection uses one worker, one request per ten seconds, 20-second HTTP attempts, one
transient retry, at most five redirects, and a 90-second total deadline per report.
HTTP and validated HTML redirects share the rate/hop limits. Responses are capped
at 2 MiB. The batch ends after eight minutes or 100 reports. It stops starting new
reports with less than 90 seconds remaining, leaving time for a complete attempt.
That normal cutoff leaves untouched reports pending and does not fail the run.
Network work happens
outside write transactions. A database lock prevents concurrent manual/cron workers.

Due refresh/retry work and pending work are interleaved. Pending issues referenced
by releases from the last 14 days precede historical pending work. Normal cron
also keeps refreshing previously attempted reports outside the current line list;
manual `--issue` and `--version` remain strictly scoped. Health uses the same active
scope, and ignores unattempted historical backlog outside configured lines.

Transient failures keep the last good report, record a retry delay from five
minutes up to 24 hours, and fail the job summary. Retry-After persists a shared
cooldown. A deadline during an attempt also saves a retry delay; it cannot leave
the oldest row stuck forever. Successful writes survive failures elsewhere.
A stale slug or bare resolver 404 is not proof of removal. Only a verified resolver
result with the explicit unavailable page withdraws text from search/display.
Unavailable reports are checked monthly; successful reports weekly. These targets
require capacity: two 100-item runs/day allow at most 1,400 items/week before
new reports, retries, and time limits. The dedicated collector now starts every
ten minutes; actual throughput depends on redirects and the crawl delay. Workers
share a lock and the request rate limit; overlapping scheduled/manual runs skip.

Trigger and inspect the dedicated service with a current Railway CLI:

```sh
railway cron run --service cron-issue-reports --yes
railway cron list --service cron-issue-reports --limit 5
```

Redeploying a cron service prepares its build; it does not run the collection job.

`/api/health` includes active report coverage when collection is enabled and reports
stale when attempted work is more than 48 hours overdue. Logs and the singleton
collector-state row retain requested/fetched/unchanged/unavailable/failed counts,
HTTP request count, bytes, duration, pending age, and due age. Use the inventory
command for per-line coverage. Inspect failed rows before expanding scope.

## Search contract

Release notes, status, scores, platform filters, and original hashes are unchanged.
Search uses cached report text; it never fetches Unity while serving a search.
Results include `issueReports` with identity, title, canonical URL, retrieval time,
a plain-text excerpt of at most 400 characters, and `descriptionTruncated`.
Descriptions are capped at 16,000 characters and titles at 2,048. The UI discloses
shortened descriptions; the canonical link leads to the complete report.

Unquoted AND terms can span note/report fields. Quoted phrases must occur in one
field. Overlapping word-position windows avoid PostgreSQL's long/repetitive-text
phrase limits. Phrases spanning more than 128 word positions return an API 400
rather than silently missing results. OR and negative phrases are tested. Rank
weights prefer original metadata, then notes/titles, then descriptions; this is a
preference, not strict tiers. Default sorting and newest-first explorer grouping
remain unchanged. Compare markdown still exports the full selected version range.

Report text reflects its last successful retrieval, not historical release-time
content. `/issues` still uses its existing separate search. Missing/unavailable
reports and unfinished index rows do not hide original release notes. External
search engines and AI tools may not discover every result.

## Verification commands

```sh
npm test
npm run typecheck
npm run test:db
ISSUE_REPORT_SEARCH_ENABLED=true npx playwright test tests/e2e/issue-report-search.spec.ts
npm run build
```

`tests/db/issue-report-search-benchmark.ts` copies every eighth note from the local
public dataset into a disposable schema, adds synthetic report text, measures
searches/counts/ranges, prints an execution plan, and removes its schema. It rejects
non-local database URLs. Run it with `npx tsx tests/db/issue-report-search-benchmark.ts`.
Browser and contract fixtures use the separate `unity_alerts_e2e` schema. Do not run
browser and contract database setup simultaneously, because each resets that schema.


## Local verification on 2026-11-02

The full unit suite passed after merging current main (1,090 tests; six existing skips), as did all five
Postgres contract programs, typecheck, and the production build. The existing
browser suite passed 243 checks with nine expected skips while report search was
off. Six additional desktop/mobile checks passed with report search on, covering
the customer searches, release details, all compare lane types, and markdown.
Screenshots were inspected for desktop/mobile layout.

A live-source smoke followed three requests to the actual public UUM-145761 page,
validated its identity, and searched its content successfully in the local test
schema. No production data or service settings were changed.

The local performance run used 30,529 sampled real notes and synthetic 3KB reports
for 500 real issue IDs. Normal enriched search p95 was approximately 1–16 ms;
quoted and mixed negative-phrase searches were about 10 ms or less. Extra matches
and field verification explain increases over the original search for those
queries. An additional exclusion-only query, which must examine the sample,
measured 62.68 ms p95 (3.75 ms within a 20-version range). The enriched GIN index
was about 6.6 MiB. These results establish sample
behavior; full production latency and sustainable collection capacity remain
rollout checks.

## Production rollout on 2026-11-02

The compatibility release (`e22d589`) was deployed and checked before the schema
was expanded. The full implementation (`177c726`) then deployed successfully.
`npm run db:migrate` was also run explicitly against production and completed.

The customer report UUM-145761 and all 37 reports linked from 6000.3.23f1 were
fetched successfully. The release batch fetched the remaining 36 reports in
140 seconds, using 117 requests and about 12.6 MB of source HTML, with no failures.

The dedicated `cron-issue-reports` service follows `release`, runs at minute 35
each hour, and uses `ISSUE_REPORT_MINOR_LINES=6000.3,6000.6`. The initial queue has
3,301 distinct report IDs. The selected lines follow Unity's current
[LTS support page](https://unity.com/releases/unity-6/support) and
[6.6 release announcement](https://discussions.unity.com/t/unity-6-6-is-now-available/1735357).
The customer release is fully backfilled; wider report collection continues in
bounded batches. Older release lines are not all backfilled.

The service configuration is stored directly on Railway because new services
cannot opt into legacy JSON config files. The existing services retain their
current configuration. A first manual collector run was stopped by a pending
collector redeployment; it was retriggered after that deployment settled.
That full run fetched 100 reports in 385 seconds using 328 requests and about
35.4 MB, with no failures, cooldown, or time-budget exhaustion. Railway recorded
the run as `EXITED`. It left 138 reports available and 3,163 pending. This measured
batch fits within the eight-minute budget. At this observed rate, the hourly
schedule can cover the initial queue's weekly refresh. Continue monitoring retry
rates and overdue work as collection reaches older reports.

All 246,476 production note rows now have enriched search vectors. PostgreSQL
confirmed the new GIN index is valid; it occupies 24 MB. The rebuild resumed on
Railway after beginning locally, and completed with no missing vectors.

## Backfill pacing update on 2026-11-02

The initial hourly schedule and one-second spacing above describe the original
rollout. A subsequent check of the tracker's
[robots.txt](https://issuetracker.unity.com/robots.txt) found `Crawl-delay: 10`.
Default spacing is now ten seconds, including redirects and retries. The report
collector runs every ten minutes to reduce idle time. One worker, shared cooldown,
and report identity checks remain in place. Unpublished quotas may still produce
429 responses; the collector stops and respects Retry-After.

A one-time seed used the public sitemap to find 1,714 unique exact-slug URL
matches among 3,063 pending reports. Only unattempted pending rows with no
canonical URL were eligible; original source URLs were retained. These are URL
hints, not verified content: the next fetch must still pass the existing issue-ID
check, and can fall back to the original URL/resolver. The sitemap was saved as
an `issue_report_sitemap` source snapshot (SHA-256
`48a081282527c048236d71a866f1413c68c9b1b1cc9d8c71e1e4c325b1c66af4`).
The seed acquired the collector lock and transaction write lock before updating.
This reduces redirect requests for the initial backlog; future reports continue
through the regular discovery flow.

Validation: 1,093 unit tests, all five database contracts, type checking, and the
production build passed. New tests cover the ten-second spacing and leaving
pending work untouched when the batch cannot fit another report deadline, plus
rejecting a URL hint with the wrong issue ID and falling back to the source.
