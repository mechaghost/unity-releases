# Filter popup — plan for review

A single Filter affordance on `/compare` and `/releases/[version]`, top-right under
the Diff facts strip. Scoped to the current view's range. Shareable via URL.
This doc consolidates input from three customer personas (Director, Game Dev,
Indie) into a buildable plan you can mark up.

> **Status:** decisions locked (see §6 below). Phase 1 ready to build on
> approval.

---

## 1. UI & interaction

### Trigger
- **Filter** button, top-right of the page, immediately under `Diff facts`
  (compare) or under the release header strip (release detail).
- Button shows the **active filter count** as a small badge: `Filter (3)`.
- Same component on both pages.

### Surface
- **Desktop (>1024px):** right-edge **drawer**, ~420px wide. Lane list stays
  visible and reflows on Apply.
- **Mobile (≤1024px):** **full-screen modal** with a back chevron in the top
  bar. Drawer at this width feels cramped.
- Header: title + close X (or back chevron on mobile).
- Footer (sticky): `Reset` · `Save as preset` · `Apply`.
  - Reset: clears every filter back to the persona default.
  - Apply: closes the surface, pushes URL state, triggers re-fetch.
  - **Apply on click** (not live) — clearer intent, cheaper on the database.

### Active filter chips
- Above the lane sections, render a row of chips for every active filter
  (`iOS ×`, `URP ×`, `risk: blocker ×`, etc).
- Click X on a chip → remove that single filter.
- "Clear all" link at the end of the chip row.

### URL state
- Every filter is encoded into the URL (`?platform=iOS,Android&area=URP&risk=blocker`)
  so a director can paste a filtered view into Slack. This is the single highest-
  scored "must" across all three personas.

### Sticky preferences (cookie)
- Per-view default state survives reload: "my `/releases/*` defaults differ from
  my `/compare` defaults" — Director.
- Indie pinned packages list and "Hide noise" toggle are particularly sticky.

---

## 2. Filter inventory

| # | Filter | Director | Dev | Indie | Data today? | Phase |
|---|---|---|---|---|---|---|
| 1 | Impact / lane (multi-select: Blocker, Breaking, Known issue, API change, Security, Package change, Feature, Improvement, Fix, Other) | ✅ | ✅ | ✅ | yes (`impact_kind`) | **1** |
| 2 | Risk severity (Blocker / Caution / Review / Info) | ✅ | ✅ | — | yes (`risk_level`) | **1** |
| 3 | Platform / build target (multi-select with "Untagged" bucket) | ✅ | ✅ | ✅ ship-platforms only | yes (`platforms[]`) | **1** |
| 4 | Package (multi-select, with "Used by us" pinned to top) | ✅ | ✅ | ✅ | yes (`package_names[]`) | **1** |
| 5 | Unity feature area (URP, HDRP, Built-in, Physics, XR, Animation, Input, UI Toolkit, Addressables, Burst, ECS, Build, Editor, …) | ✅ | ✅ | ✅ coarse | partial (`area` text — needs taxonomy) | **2** |
| 6 | Free-text search (body + title) | ✅ | ✅ | ✅ | yes (`search_vector`) | **1** |
| 7 | Issue ID lookup (`UUM-xxxxx`, `IN-xxxxx`) | ✅ | ✅ | — | yes (`issue_ids[]`) | **1** |
| 8 | "Affects my team" — manifest-aware (only my packages) | ✅ | — | ✅ (their pinned list) | yes (cookie `unity-releases-packages`) | **1** |
| 9 | ~~"Should I upgrade?" preset~~ — **dropped** (covered by persona presets + manifest filter) | — | — | ✅ | — | **❌ cut** |
| 10 | Sub-range slider inside `/compare` (narrow `from→to` further) | ✅ | — | — | yes (`version`) | **2** |
| 11 | Has Issue Tracker link (toggle) | ✅ | ✅ | — | yes (`issue_links_json`) | **1** |
| 12 | Saved presets ("Switch cert prep", "Rendering team digest", …) — **cookie-backed** | ✅ headline | — | — | new (cookie) | **2** |
| 13 | Regressions only (issues *introduced* in this range, not carried-forward) | — | ✅ | — | derived (needs query change) | **2** |
| 14 | Editor vs Runtime impact | — | ✅ | partial (Indie's "hide internal") | derived from `section` heuristically | **2** |
| 15 | Backport status (native fix vs backport) | — | ✅ | — | not tracked | **3** |
| 16 | "Affects scripting API" toggle | — | ✅ | — | derived from area/keywords | **2** |
| 17 | Render pipeline scope (URP / HDRP / Built-in / Pipeline-agnostic) | — | ✅ | — | derived from area + package | **2** |
| 18 | Note source (Editor changelog / Package changelog / Security bulletin) | — | ✅ | — | partial (separate tables today) | **2** |
| 19 | "Since I last upgraded" preset on `/compare` (prefill `from = userVersion`) | — | — | ✅ | yes (cookie `unity-releases-version`) | **1** |
| 20 | "Hide noise" toggle (docs-only, Editor-only, no-impact-tag) | — | — | ✅ headline | derived (needs section taxonomy) | **2** |

**Personas legend:** ✅ they explicitly named it, — they didn't ask for it.

---

## 3. Default state per persona

Three preset modes available in a **collapsed** "Persona presets" section at
the top of the drawer. Default selection on first visit = **Balanced**. Once
the user picks one, that becomes their sticky default for the view. Section
header shows the active preset; clicking expands the picker.

| Filter | Director default | Balanced default | Indie default |
|---|---|---|---|
| Impact / lane | Blocker, Breaking, Crash | Blocker, Breaking, Known issue, API change, Fix | Blocker, Breaking, Security |
| Risk severity | All | All | (hidden — same as impact) |
| Platform | (cleared) | (cleared) | iOS + Android + WebGL |
| Package | (cleared, "Used by us" expanded) | (cleared) | Pinned-list only |
| Affects my team | **on** if manifest set | **on** if manifest set | **on** (pinned list) |
| Hide noise | off | off | **on** |
| Lane | all on | all on | all on |

Picking a persona on first visit primes the drawer. Users can override and the
override is what gets sticky-saved.

---

## 4. Implementation phases

### Phase 1 — MVP (filters mappable to existing data)
Buildable on the current schema. Ship this first; everything else is iteration.

Filters:
1, 2, 3, 4, 6, 7, 8, 11, 19 (+ persona-preset bar collapsed at top)

Plus the UI shell: drawer (desktop) / full-screen modal (mobile), button,
badge, chips, URL encoding, sticky cookies, the `Since I last upgraded`
prefill on `/compare`, and the persona-preset selector.

Data work:
- Extend `searchReleaseNotesInRange` and `searchReleaseNotes` to accept the
  full filter set (most fields already supported by `buildReleaseNoteWhere`).
- Add `getReleaseRangeFacets(versions)` repository method that returns the
  *available* values for each dimension within the current range — so the
  drawer can render "Platforms (12)" with counts and only offer values that
  actually exist in the visible scope.
- Wire `getUserPackages` and `getUserVersion` into the drawer's defaults.

UI work:
- New client component `FilterDrawer` with internal state + URL push on Apply.
- New `FilterButton` server component that reads URL state, renders the count
  badge, and opens the drawer client-side.
- Active-chip row above the lane sections (replaces nothing — additive).

State:
- URL is the source of truth for the active filter set.
- Sticky cookie holds per-view defaults *and* the chosen persona preset.

### Phase 2 — derived & taxonomy filters
Need query-side logic that doesn't exist yet, but no schema changes.

Filters: 5, 10, 12, 13, 14, 16, 17, 18, 20.

Data work:
- **Area taxonomy — fuzzy grouping** (no handcrafted map). The `area` column
  today is free-text from Unity's notes ("Editor: Inspector framework",
  "Graphics: URP"). Strategy: at query time, expose distinct `area` values as
  facets and let the user multi-select; under the hood, group by case-folded
  prefix-before-colon ("Graphics", "Editor", "Physics", …) and run an
  `ILIKE`/array-contains match. Lossy but ships fast and self-updates as
  Unity adds new areas.
- **Render pipeline scope:** derived from `area ILIKE '%URP%'` /
  `'%HDRP%'` / `package_names` containing `com.unity.render-pipelines.*`.
- **Section taxonomy:** simple denylist for "noise" sections (docs-only,
  Editor-internal) used by the Indie hide-noise toggle. Live in code, not DB.
- **Regressions:** join `release_note_items` by issue_id across the range to
  detect "first appeared in this window".
- **Note source:** already in separate ingest paths; add a `source_kind` view
  on top of the existing tables (no migration).
- **Saved presets:** serialize the active filter state to a cookie
  (`unity-releases-filter-presets`) keyed by view + name. JSON blob, capped at
  ~10 presets per view.

### Phase 3 — schema additions
Filter 15 (backport status) only.

**Status: blocked on missing source data.** A scan of the live database
(147,054 release-note items) found just 48 rows mentioning "backport" in
their body text and zero rows with structured `(backported from X)`
markers. Unity's published release notes don't include backport metadata
in any reliable form — it would need to come from a different source
(Unity's internal QA tooling or Jira), which we don't ingest. Shipping
the filter against the existing data would surface almost nothing.

Reopen if/when:
- Unity exposes backport provenance in their release-notes feed, OR
- We add a side ingest path (Unity Issue Tracker scrape, QA dump) that
  joins backport→origin version onto our items.

---

## 5. Drawer wireframe (text version)

```
┌─────────────────────────────────────────────────┐
│ Filter                                       ×  │
├─────────────────────────────────────────────────┤
│ ▸ Persona preset:  Balanced                     │
├─────────────────────────────────────────────────┤
│ Search                                          │
│ [ memory leak, UUM-12345 …             ] 🔍     │
├─────────────────────────────────────────────────┤
│ Lane                                            │
│ ☑ Blockers (12)   ☑ Breaking (4)                │
│ ☑ Known issue (301) ☑ API (21)                  │
│ ☐ Fix (1,930)     ☐ Feature (57)                │
│ … [ show all ]                                  │
├─────────────────────────────────────────────────┤
│ Platforms                                       │
│ [ iOS ×] [ Android ×] [ +WebGL ] [ +Switch ] …  │
│ ☐ Untagged / cross-platform                     │
├─────────────────────────────────────────────────┤
│ Affects my team                                 │
│ ☑ Only packages in my manifest (6 packages)     │
│   [ edit list ]                                 │
├─────────────────────────────────────────────────┤
│ Packages   ▾                                    │
│ Risk severity   ▾                               │
│ Has Issue Tracker link   [ off ]                │
├─────────────────────────────────────────────────┤
│  Reset    Save preset      [   Apply   ]        │
└─────────────────────────────────────────────────┘
```

Expanded persona-preset row:
```
│ ▾ Persona preset:  Balanced                     │
│   ◉ Director   ◯ Balanced   ◯ Indie             │
│   Sets defaults for Lane / Platform / Hide noise│
```

Above the lanes, after Apply:
```
Filters: [ Lane: Blockers ×] [ Platform: iOS ×] [ My packages ×] [ clear all ]
```

---

## 6. Decisions (locked)

| # | Question | Decision |
|---|---|---|
| 1 | Surface | **Drawer on desktop, full-screen modal on mobile** |
| 2 | Apply timing | **Apply automatically** (debounced ~300ms; no Apply button) |
| 3 | Persona presets | **In, collapsed by default** (Director / Balanced / Indie) |
| 4 | "Should I upgrade?" preset | **Cut** — covered by persona presets + manifest filter |
| 5 | Saved presets storage | **Cookie-only** (per-browser, ~10 cap per view) |
| 6 | Area taxonomy | **Fuzzy grouping** — no handcrafted map; group by prefix-before-colon at query time |
| 7 | Mobile surface | **Full-screen takeover** with back chevron in the top bar |

---

## 7. What this plan does NOT include

To keep scope honest:
- No author/team filtering (no value, no data).
- No language filters.
- No date filtering — version range already encodes time.
- No filter changes to `/explorer` or `/releases` (the editor list); those have
  their own filter conventions and we can revisit separately.
- No editor-side "watch" / alerting on filter matches; that's a future feature.
