# Cron recovery

The core cron still runs twice a day, and product update groups keep their
existing schedules. A failed job does not stop the next core job. The overall
run exits nonzero if any job fails.

- Each core child has 30 minutes; the historical backfill has 60 minutes.
  Product update sources retain their existing source and group deadlines.
- On timeout, the supervisor sends SIGTERM to the whole Unix process group,
  waits five seconds, then sends SIGKILL. This includes children left behind
  when npm exits. Windows uses taskkill to stop the process tree.
- SIGTERM or SIGINT to either cron entrypoint stops scheduling new work and
  terminates active children. Logs distinguish timeouts and cancellation.
- Shared GET downloads try up to three times for network errors, timeouts,
  HTTP 408, 429 and 5xx. Each attempt defaults to 30 seconds. Backoff includes
  jitter. Retry-After is respected up to 30 seconds; longer requested waits
  return the HTTP failure for a later scheduled run.
- Resource discovery keeps its existing retry loop. Discourse disables shared
  retries to preserve its request budget and stop immediately on rate limits.
  Optional release-stream lookups retain their 15-second fallback budget.
- Database connection acquisition stops waiting after ten seconds. Idle-client
  disconnects are logged instead of becoming unhandled process errors.
- A core job still marked running after two hours is reported as failed by
  health checks, even if an earlier run succeeded. The health check does not
  rewrite historical records.

No entire job or database write is retried automatically. Existing transactions,
source-specific validation and last-good-data rules remain responsible for data
integrity. These safeguards do not add a distributed lock for manual concurrent
invocations; avoid manually starting the same job while its scheduled run is active.

Verification uses real local child processes for hangs, ignored SIGTERM, orphaned
children, cancellation and bounded logs. HTTP failures use deterministic test
responses. Production cron execution and Windows process cleanup require separate
runtime verification after deployment/on Windows.
