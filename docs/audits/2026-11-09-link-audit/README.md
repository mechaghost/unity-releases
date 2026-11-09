# November 9 live-link audit comparison

Compared both complete JSON artifacts, rather than the first 20 console failures:

- [November 8 run](https://github.com/mechaghost/unity-releases/actions/runs/42498463331),
  [artifact 13624589402](https://github.com/mechaghost/unity-releases/actions/runs/42498463331/artifacts/13624589402):
  45,169 destinations, 25 broken, 33,940 unverified, 2,230 requests that run.
- [November 9 run](https://github.com/mechaghost/unity-releases/actions/runs/42688210156),
  [artifact 13706269012](https://github.com/mechaghost/unity-releases/actions/runs/42688210156/artifacts/13706269012):
  47,098 destinations, 27 broken, 33,619 unverified, 2,250 requests that run.

Both are slices of the incomplete crawl begun November 4 at 18:26:15 UTC.
All 25 old failure records are unchanged. All 27 failures are external Unity
Issue Tracker URLs returning HTTP 200 after redirecting to `/not-found`.
No previously reachable link became broken between these artifacts, and no
internal failure was recorded. This is not proof that unchecked routes pass.

## Two newly checked missing sources

These URLs were already known to the November 8 crawl but were unverified,
with reason `Outside this run’s rotating external sample`. November 9 checked
them for the first time. Fresh November 9 checks confirmed both still redirect
to Unity's Page Not Found response, while production still rendered active links.

1. **UUM-67108**, Hub crash with a non-compliant user, from
   [6000.0.0b12](https://unityreleases.com/releases/6000.0.0b12).
   [Official beta notes](https://unity.com/releases/editor/beta/6000.0.0b12)
   retain the same ID and
   [original missing source](https://issuetracker.unity3d.com/issues/hub-crashes-if-the-user-is-marked-as-non-compliant-in-the-genesis-backend).
2. **UUM-37468**, incompatible shader keyword state, from
   [2022.3.3f1](https://unityreleases.com/releases/2022.3.3f1).
   [Official release notes](https://unity.com/releases/editor/whats-new/2022.3.3f1)
   retain the same ID and
   [original missing source](https://issuetracker.unity3d.com/issues/incompatible-keyword-states-error).

No replacement issue page has been verified. The narrow repair uses the existing
reviewed-unavailable mechanism, retaining note text, issue IDs, original URLs in
provenance tooltips, and internal issue-history navigation. It changes no stored
source data, collection policy, audit classifications, or checkpoint evidence.

## Carried findings already addressed

- One particle slug, UUM-54561, was handled by `18a00aa` and deployed with
  `a800908`. A fresh check of [2022.3.13f1](https://unityreleases.com/releases/2022.3.13f1)
  shows `Source unavailable`, preserved issue history, and no dead source anchor.
- The remaining 24 are retired product GUID routes: 16 LOC, five NAVB and three
  UUM identifiers. Commit `a800908` normalizes these to explicit tracker ID
  search URLs without inventing issue replacements. The
  [earlier November 9 production check](../2026-11-09-health/README.md)
  verified no obsolete GUID anchors in Localization and AI Navigation dialogs.
  That is sampled rendered-page evidence, not a fresh check of all 24 targets.

Cached failures remain in resumed audit evidence until a subsequent fresh crawl
rediscovers current rendered links. The historical run is still failed, and its
33,619 unverified destinations must not be described as checked or passing.

## Local verification and publication state

Based on clean main `142d4dfe35dbc4fe62e0e87234f13ed349f272e6`.
Both new NoteRow regressions failed before the repair. After it, the focused
66-test suite, full 1,162-test suite (six skipped), typecheck, and production
build passed. The build used the documented dummy database URL and disabled
optional Next.js telemetry without making a telemetry request.
The regressions verify preserved note text, issue ID, original URL tooltip,
internal history link, and unchanged input data, while rejecting the dead anchor.

Publication remains blocked by the execution environment's network policy for
`https://github.com:443`; no push, deployment, or post-deployment verification
has occurred. Existing CI is not verification of this unpublished patch.
