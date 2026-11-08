# November 8 health baseline

Checked 16:28–16:30 UTC. **No new operational defect found; no code change or
release needed.** Compared with the [November 7 baseline](../2026-11-07-health/README.md).

## Failed workflow diagnosis

The [November 8 run](https://github.com/mechaghost/unity-releases/actions/runs/42498463331)
on `6bfb510` resumed the crawl begun November 4 at 18:26 UTC. Downloaded and
compared its [artifact 13624589402](https://github.com/mechaghost/unity-releases/actions/runs/42498463331/artifacts/13624589402)
with [November 7 artifact 13581161319](https://github.com/mechaghost/unity-releases/actions/runs/42388228053/artifacts/13581161319).
All 25 broken result records are exactly identical, including URLs, status,
redirect destination and referring pages. **Zero new broken destinations.**
These are the cached 24 tracker GUID routes and one particle source, not a new
collection failure or evidence that yesterday's deployed repairs regressed.

The crawler retains prior results and checked external URLs while resuming
(`src/lib/link-audit.ts`). Today it made 2,230 requests and recorded 45,169 total
destinations, with 33,940 unverified (718 fewer than yesterday).
`crawlComplete`, `internalComplete` and `complete` remain false;
`blockedInternal` and `interrupted` are false. Do not claim a green full crawl,
or reset/erase its evidence to suppress the known failures.
[Exact comparison](comparison.json).

## Production and live verification

- Remote `release` remains `a800908258353f131d5c87016c88862274694190`.
  Railway web source remains `release`; deployment
  `535259b9-309e-4fe7-8b06-2aade0bc0192` is SUCCESS at that exact commit.
  [Railway service](https://railway.com/project/7ba363a4-6f53-404b-8661-899df329ce42/service/aece26a1-22f2-4b7b-b66d-687103719b88?environmentId=3bbb9971-68d9-400e-8ccd-2a0dcf8cf432).
  Before this audit, remote `main` was `6bfb5106c9af8c438923d0a45fd326c359e6aab1`,
  differing only by the November 7 evidence documentation. Checkout was clean.
- `/`, `/releases`, `/stats`, `/api/releases`, `/api/packages`, `/api/updates`
  and both health routes return 200 with meaningful content/data.
  [HTTP evidence](http.json). The health checker also passed at 16:30 UTC.
- Production browser recheck: Localization has 87 tracker links, 79 search
  fallbacks, zero obsolete GUID links; AI Navigation has 14 tracker links,
  12 search fallbacks, zero obsolete GUID links. LOC-725 and NAVB-144 preserve
  their IDs in `?q=`. The historical 2022.3.13f1 page has zero particle-source
  anchors and one “Source unavailable” label. [Browser evidence](production-browser.json).
  These fallbacks do not imply that Unity restored missing upstream issues.
- [Deployed-code CI](https://github.com/mechaghost/unity-releases/actions/runs/42390365105),
  [baseline CI](https://github.com/mechaghost/unity-releases/actions/runs/42391129374)
  and [latest ingestion monitor](https://github.com/mechaghost/unity-releases/actions/runs/42499057870)
  are successful. No implementation changed, so no redundant build/test run.

## Collection and official upstream

[Core health](https://unityreleases.com/api/health) contains all nine configured
jobs, all successful. The eight 12-hour core collectors last succeeded today
12:02–12:09 UTC, 4.3–4.4 hours ago; none exceed the 18-hour investigation or
30-hour escalation thresholds. Issue reports succeeded 16:07 UTC, with zero
failed, pending, due or overdue reports; four intentionally unavailable records.

[Product health](https://unityreleases.com/api/updates/health) exactly matches
all 84 active manifest targets: no missing or unexpected targets, failures,
open circuits, leases, or past-due targets. Cadences remain two 12-hour,
75 daily and seven weekly targets. The four retired targets remain excluded:
Tencent iOS, VK iOS, VK Android mediation, and VPC AWS. [Snapshot](freshness.json).
Railway schedules remain core twice daily, products every six hours, issues
every half-hour; all three active worker deployments are SUCCESS. The three
old family workers still have no source or schedule and use `cron-retired.json`.

Fresh official fetches match production: [stable Editor](https://unity.com/releases/editor/latest)
6000.3.28f1, [beta](https://unity.com/releases/editor/beta) 6000.7.0b8,
[alpha](https://unity.com/releases/editor/alpha) 7000.0.0a16 (all revisions match);
[Hub](https://unity.com/unity-hub/release-notes) 3.22.6 / 4.0.0-beta.5;
[CLI](https://docs.unity.com/en-us/unity-cli/release-notes) 1.0.0-beta.17;
[Version Control](https://docs.unity.com/en-us/unity-version-control/release-notes/11)
11.0.16.10616, checked through its product-filtered API because undated entries
can fall outside the general feed's first page;
[Input System](https://packages.unity.com/com.unity.inputsystem) 1.20.1;
[Entities registry](https://packages.unity.com/com.unity.entities) 1.5.0 and
[Editor-aligned docs](https://docs.unity3d.com/Packages/com.unity.entities@6.6/changelog/CHANGELOG.html)
6.6.0. [Comparison evidence](upstream-comparison.json).

[Stats](https://unityreleases.com/stats) remains 529 Editor releases,
197 packages / 7,392 versions, and 3,433 product updates. Staff posts increased
from 18,099 to 18,101. All active target health was checked; upstream content
was sampled, not comprehensively recrawled. No new alert or deployment warranted.
