# November 7, 2026 health baseline

Checked starting 16:11 UTC; production verified 16:17 UTC and both CI runs
subsequently passed. Collection is healthy. Repaired the existing tracker
GUID-link defect and deployed the previously committed unavailable-source fix.

## Production identity and repair

- Before: `release` and Railway web deployment
  `a0b285f9-154d-470c-ac38-7d84a12176a5` served
  `bc4aba469dea85e2ca4227a5c5314462c5cbd157`; `main` was one commit ahead.
- After: remote `release` verified at
  [`a800908258353f131d5c87016c88862274694190`](https://github.com/mechaghost/unity-releases/commit/a800908258353f131d5c87016c88862274694190).
  Railway deployment `535259b9-309e-4fe7-8b06-2aade0bc0192` reports SUCCESS,
  branch `release`, that exact commit, ready at 16:17 UTC.
  [Railway service](https://railway.com/project/7ba363a4-6f53-404b-8661-899df329ce42/service/aece26a1-22f2-4b7b-b66d-687103719b88?environmentId=3bbb9971-68d9-400e-8ccd-2a0dcf8cf432).
- Retired `/product/unity/issues/guid/ID` links now use the existing official
  tracker `?q=ID` search fallback. No historical text or stored source URL was
  removed. This is a search fallback, not a claim that Unity restored each issue.
  Browser checks confirm Unity applies LOC-725 and NAVB-144 in its search field;
  both currently return zero results under the default public filters.
- Release also includes `18a00aa`, the November 4 fix marking the confirmed
  missing particle issue source unavailable. Its original link was still live
  before this release.
- Production browser verification: Localization had 87 tracker links, 79 search
  fallbacks and zero obsolete GUID links; AI Navigation had 14 tracker links,
  12 search fallbacks and zero obsolete GUID links. LOC-725 and NAVB-144 retain
  their IDs. `/releases/2022.3.13f1` has zero particle-source anchors and one
  “Source unavailable” label. See [browser evidence](production-browser.json).
- Local typecheck, 1,158 tests and production build passed (6 tests skipped).
  [Release CI](https://github.com/mechaghost/unity-releases/actions/runs/42390365105)
  and [main CI](https://github.com/mechaghost/unity-releases/actions/runs/42390361739)
  both completed successfully for this exact code commit, including database
  contracts and desktop/mobile end-to-end tests. The baseline documentation
  commit on `main` is deliberately separate from the deployed code commit.

## Freshness and coverage

Post-deploy `/`, `/releases`, `/stats`, `/api/releases`, `/api/packages`,
`/api/updates`, `/api/health` and `/api/updates/health` returned HTTP 200 with
meaningful content/data. Both health endpoints report `ok`.

- [Core health](https://unityreleases.com/api/health): all nine configured jobs
  present and successful. Editor, legacy LTS, registry packages, package docs,
  news, resources, GitHub and discussions last succeeded 12:02–12:10 UTC,
  roughly 4.2 hours old. Issue reports succeeded at 16:05 UTC, with zero failed,
  pending, due or overdue reports. Four intentionally unavailable reports remain.
- Applied the operational thresholds: investigate core success age over 18 hours,
  escalate over 30 hours. None cross either threshold. Do not use a 30-day
  content-age flag for collection freshness; the code's wider health expiry
  does not replace these audit thresholds.
- [Product health](https://unityreleases.com/api/updates/health): exact manifest
  match, 71 configured sources and 84 active targets; zero missing/unexpected active targets,
  failures, open circuits, leases or overdue targets. Cadences: two 12-hour,
  75 daily and seven weekly targets. Oldest success November 2 is a weekly
  target due November 9, not stale.
- Four retired targets excluded: Tencent iOS mediation, VK iOS mediation,
  VK Android mediation, and VPC AWS. [Full snapshot](freshness.json).
- Railway schedules confirmed: core `0 0,12 * * *`, combined products
  `15 */6 * * *`, issues `5,35 * * * *`. Three former family workers have
  no source/schedule and use `cron-retired.json`; they are intentionally retired.
- [Stats](https://unityreleases.com/stats): 529 Editor releases, 197 packages /
  7,392 versions, 3,433 product updates, 88 total / 84 active healthy targets.

## Official upstream samples

All samples matched stored production data; Editor revisions also matched.

| Official source | Verified version |
| --- | --- |
| [Editor latest stable](https://unity.com/releases/editor/latest) | 6000.3.28f1 / 8f082d2fe476 |
| [Editor beta](https://unity.com/releases/editor/beta) | 6000.7.0b8 / 0bc2e945afca |
| [Editor alpha](https://unity.com/releases/editor/alpha) | 7000.0.0a16 / 0745a91df592 |
| [Hub](https://unity.com/unity-hub/release-notes) | 3.22.6 and 4.0.0-beta.5, November 6 |
| [Unity CLI](https://docs.unity.com/en-us/unity-cli/release-notes) | 1.0.0-beta.17, November 5 |
| [Version Control](https://docs.unity.com/en-us/unity-version-control/release-notes/11) | 11.0.16.10616; no invented release date |
| [Input System registry](https://packages.unity.com/com.unity.inputsystem) | 1.20.1 |
| [Entities registry](https://packages.unity.com/com.unity.entities) | 1.5.0 |
| [Entities aligned docs](https://docs.unity3d.com/Packages/com.unity.entities@6.6/changelog/CHANGELOG.html) | 6.6.0; distinct from registry version |

## Link baseline and limits

[November 7 link run](https://github.com/mechaghost/unity-releases/actions/runs/42388228053)
failed on 25 external tracker soft 404s: 24 GUID routes and the old particle
source. LOC-725, NAVB-144 and the particle source were rechecked and redirected
to Unity's `/not-found` with HTTP 200. The
[November 6 log](https://github.com/mechaghost/unity-releases/actions/runs/42256318122)
already reports 25 failures and the same printed representative URLs. These are
not 25 newly discovered November 7 regressions.

The [November 7 artifact](https://github.com/mechaghost/unity-releases/actions/runs/42388228053/artifacts/13581161319)
is a cumulative, incomplete crawl begun November 4: 43,657 destinations recorded,
34,658 unverified. Cached failures can persist until a fresh crawl reaches those
pages; this audit does not claim the old workflow/artifact is green. All active
target health records were compared, but upstream content was sampled, not fully
recrawled. Railway's overview separately reports one unspecified Postgres warning
while the database is online and application queries succeed; no database or
security settings were changed.
