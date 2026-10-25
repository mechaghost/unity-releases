# Audit repairs — October 24, 2026

The confirmed source issues in the audit are fixed. The original report and CSV files remain unchanged as the record of the live audit. Production acceptance requires deploying the verified main branch separately.

## Findings and safeguards

| Finding | Repair | Regression check |
|---|---|---|
| Obsolete tracker searches and issue-ID links | One URL policy across imports, page links, changelogs and Markdown exports. Preserve valid source slugs; use `https://issuetracker.unity.com/?q=ID` as fallback. | Tracker tests and all confirmed audit failures from the CSV. Browser verified a real matching result and issue detail. |
| 43 unindexed release destinations | Retain the existing indexed-version guard; version text without a stored release stays unlinked. | NoteRow regression and audit inventory coverage. |
| Eight removed external destinations | Show historical text and original URL with “Source unavailable”; no dead clickable link. | Shared external-link policy and page-rendering tests. |
| Issue history truncated at 100 | Calculate counts, status and version scope from full history; page the visible rows. | 155-mention fixture, including an earliest fix beyond row 100. |
| Missing Explorer, Resource and package-history paging | Add paging with stable ordering and preserved filters; package API returns page metadata. | Unit and desktop/mobile tests, including 205 resources and 55 package versions. |
| Repeated package query causes 500 | Normalize string/array query parameters. | Page regression and browser checks. |
| Closing a loading package dialog prevents recovery | Cancel stale requests, fetch again on reopen, provide retry and history controls. | Delayed-request close/reopen browser regression. |
| Database failure shown as empty results | Explicit temporary-error views for affected pages. | Failure-injection rendering tests. |
| Import failures reported as success | Validate HTTP, RSS, sitemap and registry payloads; fail partial batches; preserve valid stored content. | Error/malformed-response tests and worker-drain checks. |
| Old package docs overwrite newer alignment after failed probe | Preserve stored alignment when an earlier probe is inconclusive. | Newer-probe failure regression. |
| Freshness ignores missing jobs and hides failures | Track eight whole scheduled jobs separately, including legacy Editor and package docs. Failures/never-run/stale remain visible; 36-hour threshold for 12-hour jobs. | Job-health tests and isolated database contract. |
| Dead resources persist indefinitely | Recheck up to 100 older entries per run, including entries absent from discovery; retire confirmed 404/410, preserve history, recover on valid response. Commit items separately and advance failed checks so the queue progresses. | Retirement/recovery, rollback and bounded-queue tests. |
| Failed migration allows incompatible startup | Stop startup when the schema migration fails. | Boot-script tests with successful and failed migrations. |
| Stale README and tracker guidance | Update current routes, checks and operational behavior. | Source review. |

## Ongoing checks

- GitHub verification workflow runs unit, type, database and desktop/mobile browser checks on pushes and pull requests.
- Daily live checker crawls internal links, sitemap, package histories and health endpoints; validates fragment targets; checks a rotating sample of 250 external links; retains JSON evidence.
- Confirmed failures return exit 1. An incomplete or blocked internal crawl returns exit 2. External blocks, rate limits and unsampled URLs remain explicitly unverified. `--require-complete` also fails for those unknowns.
- Redirect requests stay within the approved hosts, and response size, timeout and page limits bound the crawl. API error pages cannot silently skip package coverage.

## Verification

- Full unit suite: **959 passed, 6 skipped**.
- TypeScript check: passed.
- Four existing database contracts: passed.
- Dedicated migration, job-health and resource recovery database contract: passed against an isolated throwaway schema; migration applied twice.
- Production build: passed. Final desktop/mobile browser suite: **167 passed, 3 skipped**, including the audit regression fixtures and accessibility checks.
- Live checker CLI smoke: intentionally limited to three internal requests; recorded 1,695 destinations and exited **2**, correctly reporting 1,692 unverified rather than claiming success.
- Independent link, UI and ingestion reviews completed. Review findings received regression tests.

## Deployment boundary

These changes do not update Railway until the separate release workflow runs. The existing release-link guard, current/past guide separation and archive route likewise need deployment. After deployment, verify the migrated schema, all eight jobs' first complete runs, affected pages and a fresh link crawl. Jobs correctly show never-run until their first recorded whole-job success; database readiness remains separate from freshness.

External URLs blocked during the original audit remain unknown. The checker reduces future drift; it cannot guarantee that third-party content will remain available or detect every semantic change behind a successful HTTP response. No support-policy error was established by the audit; dated editorial guidance still needs review when Unity changes its policy.
