# November 14: refresh health on each audit slice

[Run 43612825543](https://github.com/mechaghost/unity-releases/actions/runs/43612825543)
restored the November 13 checkpoint. Exact logs and artifact 14120759700 confirm
2,250 requests this slice, 42,470 recorded destinations, one carried HTTP 200
`Health reports degraded` result for `/api/updates/health`, and 38,112 unverified.
The crawl started November 13 at 17:51:57 UTC; it is incomplete. Fresh public
core and product health both returned `ok` during this investigation.

The audit CLI now probes `/api/health` and `/api/updates/health` on every slice,
replacing old observations for exactly those URLs. Ordinary link observations,
queue order, cursor positions, crawl start and sample rotation are preserved.
Already refreshed health URLs are not requested again as the cursor passes them,
and queued health URLs do not create duplicate synthetic coverage entries.
Failed fresh requests and degraded/malformed payloads remain failures; blocked
responses remain visible. Cancellation or budget exhaustion leaves unverified
health, not yesterday's status, and the CLI exits 2 for incomplete health checks.
Request counts include actual refresh attempts.

Validation: 39 audit tests passed, including both health transitions, preserved
historical failures/cursor progress, deduplication, network failures, blocks,
invalid JSON, budget exhaustion and cancellation. Typecheck passed. A bounded
live CLI check made exactly two requests, reported both endpoints reachable,
and retained three unverified queued destinations with `crawlComplete: false`.

This is CI-only; production release and Railway remain untouched. The existing
code fingerprint causes one new cache namespace for this audit-code change;
subsequent compatible slices resume normally. Historical artifacts are retained.
Remote CI and the next live workflow remain separate verification evidence.
