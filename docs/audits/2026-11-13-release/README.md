# November 13 repair release: deployed, ingestion recovery pending

The authorized repairs were published and deployed. This is **not yet a claim
that the collection incident is resolved**: the repaired product worker has not
executed since deployment. Snapshot: November 13, 14:44 UTC.

## Verified publication

- Clean checkout at `ce528b40a06ba7e369a3affaa23853150c518c7d`; inspected the
  preceding `3e09b8e` and `7faa759` issue-link fixes. All three are in scope.
- Typecheck, 1,188 tests (six skipped), and production build passed.
  `NEXT_TELEMETRY_DISABLED=1` uses the installed Next.js opt-out; no telemetry
  permission was changed and no denied telemetry call was retried.
- Both remote `main` and `release` were confirmed at
  [`ce528b4`](https://github.com/mechaghost/unity-releases/commit/ce528b40a06ba7e369a3affaa23853150c518c7d)
  after ordinary fast-forward pushes. This report is a later documentation-only
  commit on `main`. Production remains sourced from `release`.
- Web deployment `cf7fd616-e819-4c10-8644-4f3513bf3a76` and product-worker
  deployment `af9a578d-cf59-412e-8e55-4695d7646214` both report SUCCESS for
  that exact code commit.
  [Railway project](https://railway.com/project/7ba363a4-6f53-404b-8661-899df329ce42).
- [Release CI](https://github.com/mechaghost/unity-releases/actions/runs/43444712895)
  passed, including database contracts and end-to-end tests.
  [Main CI](https://github.com/mechaghost/unity-releases/actions/runs/43444710033)
  also passed against the same code commit (completed 14:47:41 UTC).

## Live evidence and remaining work

Homepage, stats, releases, core health and product health return HTTP 200 with
meaningful bodies. Core health is `ok`: all nine expected jobs are present,
eight core collectors succeeded 2.6–2.7 hours ago and issue reports 0.1 hours
ago. No core source crosses the 18-hour investigation or 30-hour escalation
threshold. [HTTP evidence](http.json), [full health snapshot](health.json).

All 84 active product targets match the manifest, excluding the four retired
targets. 82 are healthy; CLI and LevelPlay Unity retain their pre-deployment
parser-drift failures, last attempted at 12:20 UTC. Both have two failures,
no lease and no open circuit. Deployment success does not mean a cron execution
has happened. The normal combined worker schedule remains `15 */6 * * *`;
next run is 18:15 UTC.

CLI 1.0.0 is still absent from the live filtered API. LevelPlay 9.8.0 currently
has iOS and Android records, but **not the Unity record**. Verify specifically
`componentKey=unity` after ingestion; do not mistake another platform for recovery.
The repaired parsers previously replayed all 25 official CLI releases and
149 LevelPlay Unity rows without dropping notes.

The issue-link changes are live: 2022.3.3f1, 6000.0.0b12 and 2021.3.28f1
return 200 and contain zero anchors for the three newly reviewed missing source
slugs, with unavailable labels retained. The numeric `/issues/404` audit exception
is covered by tests; no historical audit cache was erased.

## Blocked immediate recovery action

The connected Railway tool's attempted restart of only the product-worker
deployment `af9a578d-cf59-412e-8e55-4695d7646214` was **denied, not executed**.
Automatic approval review stated: “Restarting the production worker causes
service interruption and is not clearly authorized or necessary; the documented
scheduled run remains a less disruptive alternative.” It was not retried or
worked around. The user's verified publication approval was read; it does not
explicitly name this restart.

Separately, npm blocked the official CLI install script, and Railway's documented
API helper found no usable local login token. Neither install policy nor
credentials were changed. No immediate ingestion run has been confirmed.

After the scheduled run (or an explicitly approved one-off run), verify both
targets succeed, CLI 1.0.0 and LevelPlay **Unity** 9.8.0 display complete notes,
all 84 active targets and core health are healthy, and the normal health workflow
closes [incident #35](https://github.com/mechaghost/unity-releases/issues/35).
The incident remains open at this checkpoint. Do not report the site fully fixed
until those checks pass.
