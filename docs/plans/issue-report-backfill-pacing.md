# Backfill pacing

Unity's tracker robots.txt advertises a 10-second crawl delay. The current one-second
spacing should be corrected. The hourly worker spends most of its time idle, and
many legacy URLs add redirect requests that the public sitemap can avoid.

Plan:

1. Make the default HTTP spacing ten seconds, including redirects/retries. Verify
   with a fake-clock test. Keep one worker and shared Retry-After cooldown.
2. Stop admitting new reports when less than the 90-second per-report deadline
   remains in the eight-minute batch. Pending work must remain pending, rather
   than turn routine batch completion into a fetch failure. Test this and retain
   the real timeout/backoff contract.
3. Seed URL hints only for unattempted pending reports with no canonical URL,
   using unique exact slug matches from the downloaded public tracker sitemap.
   Retain original source URLs, acquire the collector/write locks, save the
   sitemap snapshot, and require the existing identity parser on every fetch.
4. Deploy verified code, then change only the report collector schedule to every
   ten minutes. Observe one complete batch, inspect failures/cooldown/coverage,
   and recheck live health and the customer's searches.

Do not infer tracker quotas from unrelated Unity APIs. Response headers currently
advertise higher HTTP limits, but those do not override the crawler delay. Greater
hourly volume can still meet an unpublished limit; preserve automatic backoff and
avoid guaranteeing that no 429 will ever occur. The initial URL seed does not
change the general ingestion flow for future reports.

Acceptance: correct request spacing; no overlapping collector; no false timeout
at an ordinary batch boundary; verified identity for hinted URLs; normal successful
exit; no live search regression. Completion time is an estimate based on measured
throughput, not a fixed promise.
