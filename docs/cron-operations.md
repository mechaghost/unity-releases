# Cron operations

Production has three scheduled collection workers: core twice daily, combined
product updates every six hours, and issue reports every 30 minutes. Product
targets retain their own 12-hour, daily or weekly due dates; the extra product
wakeups allow retry after failures. Each family has its own execution budget.
Logs distinguish success, nothing due, retired, disabled, overlap and circuit
breaker skips. Missing schema and failed children fail the combined run.

Core health expires after 36 hours without successful collection; the issue
collector expires after two hours and a still-running issue batch fails health
after 15 minutes. Lock/cooldown skips do not update successful collection time
or hide an older running/failed collector. An empty queue is a successful check.
The HTTP health routes stay usable as readiness checks; monitoring reads JSON.

## Monitoring

`site-health.yml` checks both health endpoints at minutes 7 and 37. It uses Node
without npm installation or a full crawl. An unhealthy response, missing coverage,
or stale check timestamp fails the job. It opens one GitHub issue per outage and
closes that issue after recovery. GitHub notification delivery follows the user's
repository notification settings. Actions schedules are best-effort, not an alert
delivery SLA. A stopped Actions workflow cannot monitor its own absence.

`site-links.yml` checks up to 2,000 internal URLs per daily run with a 20-minute
budget. It saves a resumable queue in Actions cache and resumes later pages on
the next run. At least 20% of the time budget is reserved for the external sample.
The sample advances after each full crawl, independently of the calendar date.
Reports include the crawl start time and distinguish partial from full coverage;
an intentional saved slice can pass, but detected broken pages and blocked
internal pages fail. Unexpected cancellation fails the run too. Atomic partial
reports are saved every 100 requests and on graceful interruption. Artifacts
explicitly include the hidden output file. A lost cache restarts discovery.

## Repeat crawling

Discussions publishes a roster cache only after a complete duplicate-free walk.
It refreshes after 23 hours (allowing a daily refresh on a twice-daily schedule).
The existing active scope remains staff who posted in the last year. Staff who
posted within 30 days are checked every 12 hours; others weekly, with one hour
of scheduler tolerance. Due users are oldest-due first. Errors or due users left
behind fail the run; users not yet due do not. Failed fetches never advance a
user checkpoint. Daily rosters discover returning posters.

Legacy LTS stores sitemap timestamp and parser version in the same transaction
as release content. Unchanged complete releases are skipped for up to seven days.
Missing or invalid timestamps, parser changes, incomplete stored releases and
weekly expiry force a new fetch. Duplicate sitemap entries are fetched once.

Resource discovery now uses the content sitemap and resource index. On November 4,
the removed `https://unity.com/resources/sitemap.xml` returned HTTP 200 but zero
parsed entries (SHA-256 `1214c52cace28c40b45da48b46ef96fe9ad1bb0584cde1ba6f66c9a70a5ed5df`).
The content sitemap had 809 resources; all nine index URLs were in that set.
Historical URL rechecks remain enabled; discovery absence does not retire content.

## Rollback

The old product service variables and original family config files are retained.
To restore separate workers, stop the combined schedule, restore the editor-tooling
family config, then reconnect the other family services to the `release` branch
and their original config paths. Verify effective commands and schedules before
triggering runs. Do not delete a referenced config or fall back to the root web
config. Schema changes are additive; `skipped` run history should be retained.

Railway redeploys of an existing build can retain its old file-based manifest.
After changing a service's config-file path, deploy a fresh source upload or
GitHub build and verify the effective command and schedule. Changing the service
settings alone is not proof that the deployed manifest changed.
