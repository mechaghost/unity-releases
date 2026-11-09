# November 9 health baseline

Checked 16:35–16:38 UTC against the [November 8 baseline](../2026-11-08-health/README.md).
**Healthy; no verified new defect and no repair/release needed.**

## Production and CI

- Clean checkout, no unrelated changes. Read current `AGENTS.md`, repository
  shipping/package-versioning skills and Railway deployment manifests.
- Remote `release` remains `a800908258353f131d5c87016c88862274694190`.
  Railway web source is still `release`; deployment
  `535259b9-309e-4fe7-8b06-2aade0bc0192` reports SUCCESS for that exact commit.
  [Service](https://railway.com/project/7ba363a4-6f53-404b-8661-899df329ce42/service/aece26a1-22f2-4b7b-b66d-687103719b88?environmentId=3bbb9971-68d9-400e-8ccd-2a0dcf8cf432).
- Incoming `main` was `18e0da62a0c900d0f5bd6e559a7ffe90d98cec41`, differing
  from production only by November 7/8 audit documentation.
  [Its CI](https://github.com/mechaghost/unity-releases/actions/runs/42500340735),
  [deployed-code CI](https://github.com/mechaghost/unity-releases/actions/runs/42390365105)
  and [latest ingestion monitor](https://github.com/mechaghost/unity-releases/actions/runs/42582038790)
  passed. No application changes warrant another build/test cycle.
- Web and all three active worker deployments report SUCCESS. Schedules remain
  core `0 0,12 * * *`, products `15 */6 * * *`, issues `5,35 * * * *`.
  Three former family workers still use `cron-retired.json` with no source or
  schedule; they are intentionally excluded.

## Live routes and collection

Homepage, releases, stats, core/product health, release/package/update data,
the Version Control filtered API and the activity API return 200 with meaningful
content/data. The repository health checker passed at 16:37:45 UTC.
[HTTP evidence](http.json), [recent activity sample](recent-feed.json).

[Core health](https://unityreleases.com/api/health) has all nine expected jobs.
The eight 12-hour collectors last succeeded today 12:03–12:13 UTC, 4.4–4.6 hours
before the snapshot. All are successful, below the 18-hour investigation and
30-hour escalation thresholds. Issue reports succeeded 16:08 UTC; no failed,
pending, due or overdue reports. Four unavailable records remain intentional.

[Product health](https://unityreleases.com/api/updates/health) matches all
84 active targets and their manifest cadences: two 12-hour, 75 daily, seven
weekly targets. No missing/unexpected targets, past-due targets, failures,
open circuits or leases. Asset Transformer refreshed successfully today at
06:17 UTC, satisfying its weekly due date. The remaining weekly targets are
due November 10 or 13. Four retired targets remain excluded (Tencent iOS,
VK iOS/Android mediation, and the legacy VPC AWS `aws` target; the four
version-specific VPC AWS targets remain active).
[Coverage](coverage.json), [full freshness snapshot](freshness.json).

[Stats](https://unityreleases.com/stats): 529 Editors, 197 packages / 7,392
versions, 816 resources (+1), 18,108 staff posts (+7), 3,439 product updates
(+6), 13,715 update items (+10). This demonstrates fresh records since November 8
without requiring an upstream release every day. News remains 847 posts and
GitHub 818 repositories. Latest job success, rather than publication age, is
the collection freshness measure.

## Official upstream comparison

Fresh official fetches match production:

| Source | Latest sampled version |
| --- | --- |
| [Editor stable](https://unity.com/releases/editor/latest) | 6000.3.28f1 / 8f082d2fe476 |
| [Editor beta](https://unity.com/releases/editor/beta) | 6000.7.0b8 / 0bc2e945afca |
| [Editor alpha](https://unity.com/releases/editor/alpha) | 7000.0.0a16 / 0745a91df592 |
| [Hub](https://unity.com/unity-hub/release-notes) | 3.22.6 and 4.0.0-beta.5 |
| [CLI](https://docs.unity.com/en-us/unity-cli/release-notes) | 1.0.0-beta.17 |
| [Version Control](https://docs.unity.com/en-us/unity-version-control/release-notes/11) | 11.0.16.10616 |
| [Input System](https://packages.unity.com/com.unity.inputsystem) | 1.20.1 |
| [Entities registry](https://packages.unity.com/com.unity.entities) | 1.5.0 |
| [Entities aligned docs](https://docs.unity3d.com/Packages/com.unity.entities@6.6/changelog/CHANGELOG.html) | 6.6.0, separately modeled from registry |

[Machine-readable comparison](upstream-comparison.json). Editor revisions and
Hub/CLI publication dates match as well. These are representative samples,
not a comprehensive comparison of every upstream item.

## Known link findings and coverage limits

No newer link workflow was visible during this audit. The latest remains the
[November 8 run](https://github.com/mechaghost/unity-releases/actions/runs/42498463331):
25 cached external failures, 33,940 unverified destinations, incomplete crawl
begun November 4. Its failure records were already proven identical to November 7;
they are not a new alert today. Do not claim the full crawl is green.

Live browser checks still show zero obsolete GUID links in Localization and
AI Navigation dialogs, working ID-search fallbacks for LOC-725/NAVB-144, and
zero particle-source anchors with one unavailable label on 2022.3.13f1.
Search fallbacks do not restore missing upstream issue content.
Historical Search Console examples 6000.7.0b7, 6000.5.0b11 and 6000.6.0a7 also
return 200 with the correct version headings in today's browser check.
[Browser evidence](production-browser.json). No global indexing or noindex
change is justified. Full active-target health coverage and sampled content/link
checks do not constitute an exhaustive site crawl.
