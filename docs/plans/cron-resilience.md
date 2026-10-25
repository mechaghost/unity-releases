# Cron resilience

Scope: core cron orchestration, product update child cleanup, shared HTTP downloads,
database connection waits, and reporting interrupted runs. Keep existing data writes
and schedules unchanged. Do not retry entire jobs or database writes.

Plan:
1. Share a bounded child-process supervisor between both cron entrypoints. Keep
   per-job failure isolation, terminate process groups after a grace period, and
   stop scheduling on shutdown. Test real hung processes and descendants.
2. Retry transient GET failures in fetchText, with bounded attempts, timeout,
   jitter and Retry-After. Make fetchHtmlWithRetry use that single retry layer.
   Test permanent errors, recovery, exhausted retries and request cancellation.
3. Bound pool connection waits, handle idle-client errors, and flag abandoned
   running records after a generous two-hour threshold. Test health transitions.
4. Run focused tests, typecheck and full unit suite; review diff and commit main.

Review perspectives:
- Data integrity: retrying whole jobs can duplicate writes. Retry only GETs; no
  changes to persistence or last-good-data replacement rules.
- Operations: killing just npm can leave its children running. Kill the Unix
  process group, including after its leader exits; propagate parent shutdown.
  Default core job limit is 30 minutes, 60 minutes for historical backfill.
- Testability: mocks cannot prove cleanup. Use real Node children, including a
  child that ignores SIGTERM; use fake time for HTTP backoff cases.

Checklist:
- [x] Process failure tests and supervisor integration
- [x] HTTP retry tests and implementation
- [x] Database and health safeguards
- [x] Review and verification

Delivery: commit and push the verified change to main; deployment is separate.

Implementation review:
- Confirmed no new database-write retries or schema changes.
- Found resource discovery's existing retry loop and disabled nested shared
  retries there. Preserved Discourse's counted requests and 15-second stream
  lookup fallback by opting those callers out.
- Process tests prove orphan cleanup on the local Unix host. Windows taskkill
  remains unverified. A source cannot report success after a timeout even if
  its signal handler exits zero.
- No distributed lock was added; concurrent manual invocations remain an
  operational limitation documented in docs/cron-resilience.md.

Verification: typecheck passed; full unit suite passed (982 tests, six skipped);
additional product-group shutdown test passed (nine focused tests); production
build passed. No production cron was triggered during testing.
