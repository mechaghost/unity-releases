# Site audit repair plan

Goal: address the confirmed audit findings and add repeatable checks. Preserve concurrent Sentinel branding edits and existing historical content.

## Proposed implementation

1. Link integrity: centralize Unity tracker normalization for ID/search/source-slug links across page renderers, imports and exports. Verify current upstream behavior before choosing replacements. Handle confirmed removed external URLs without silently inventing replacements or rewriting historical text. Add a bounded, rate-limit-aware link checker that detects soft 404s, separates blocked/unknown from failures, writes evidence and exits nonzero for confirmed failures. Protect the existing indexed-version guard with regression tests.
2. Complete UI data: fetch complete issue history for status/count/scope calculations; page visible rows. Add visible paging to search/resources and package histories while retaining filters. Normalize repeated package query parameters. Make package dialogs recover from interrupted loads, and distinguish DB errors from empty content. Cover these with unit and desktop/mobile browser regressions using isolated fixtures.
3. Import reliability: validate HTTP and feed structure, persist failures and fail incomplete batches, preserve valid historical data. Track expected independently scheduled core jobs including legacy and package docs; report never-run, recent failure and stale states using cadence-based limits. Make the health CLI perform a real check. Retire confirmed deleted resources without treating transient failures or sitemap absence as deletion.
4. Integration: refresh stale README/LLM guidance; map every audit finding to a fix/check or an explicit remaining live verification boundary. Run focused tests, full unit suite, typecheck, isolated DB/browser checks and production build. Review changes, commit only owned files on main, push main. Deployment uses the separate release workflow; source fixes alone do not count as live acceptance.

## Plan review

Reviewed from link correctness, UI data/state, and ingestion/operations perspectives. Resolved requirements:

- Validate tracker search and known slugs in browser; normalize persisted links at rendering as well as newly imported links. Blocked responses are unknown.
- Issue status/count/scope use complete history before display pagination. Preserve repeated filters; use stable ordering. Package metadata always compares against actual latest, independent of page.
- Track whole scheduled-job outcomes independently of per-item transactions. Keep Railway readiness HTTP 200 when DB works even if data is stale; freshness CLI must fail. Include migration/recovery tests. Recheck resources on a bounded age schedule and recover after a later valid response.

## Execution checklist

- [x] Tracker normalization, removed-link handling, release-link checks (link reviewer).
- [x] UI pagination, complete issue data, repeated params, dialog recovery, error states (UI reviewer).
- [x] Import failure contracts, whole-job health, resource retirement/recovery and migrations (operations reviewer).
- [x] Bounded live checker, scheduled CI checks, docs refresh and audit closure (root).
- [x] Integrated unit, type, DB, browser and build verification; review; scoped commit/push.
- [x] Record live deployment acceptance separately from source verification.

Implementation and verification are recorded in [repair-results.md](repair-results.md). Live deployment remains a separate acceptance step.
