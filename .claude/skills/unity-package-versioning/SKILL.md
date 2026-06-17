---
name: unity-package-versioning
description: >-
  Understand how unity-releases models Unity 6 package versions before changing
  /packages, the package dialog, or package ingestion. Covers why
  packages.unity.com is stale for Unity 6 (frozen / Bundled-with-Editor), the
  editor "Package changes" reconciliation, exact "first shipped with" editor
  builds, and Unity 6.4 unified versioning (entities 6.4.0 vs registry 1.4.x).
---

# Unity 6 package versioning model

`packages.unity.com` (the npm-style registry the poller hits) is **only a
reliable source of truth for pre-Unity-6 packages**. Unity 6 introduced three
wrinkles the site reconciles. Read this before touching package version display
or ingestion; the full detail lives in `CLAUDE.md` ("Data And Ingestion").

## The three cases

1. **Frozen / Editor-bound** — Unity absorbed packages (URP/HDRP family, ugui,
   ui.builder, …) into the Editor and stopped publishing them; the registry
   serves a frozen `latest` (URP shows `10.10.1` from 2022, Unity 6 ships
   `17.x`). `isRegistryFrozen()` flags these; we reconcile the real version from
   each editor's **"Package changes"** notes block into `editor_package_versions`
   and show a **"Bundled with Editor"** badge.

2. **Per-version "first shipped with"** — for every package version, the dialog
   shows the exact editor build that first bundled it (ProBuilder `6.0.4` →
   `6000.0.23f1`), reconciled from the same notes. The query **prefers a stable
   (f/p) editor** over a beta/alpha; remaining preview-only builds are labeled
   `BETA` (see `editorPrereleaseLabel`).

3. **Unity 6.4+ unified versioning** — a few core packages are renumbered to
   match the Editor: `com.unity.entities` ships as `6.4.0` in Unity 6.4 while the
   registry keeps the `1.4.x` line for 6.0–6.3. The `6.4.0` build exists **only
   in the docs**. `ingest:package-docs` probes
   `docs.unity3d.com/Packages/<pkg>@<minor>` and records aligned versions in
   `package_unified_versions`. Only surfaced when the docs version is **strictly
   newer** than the registry latest (so AR Foundation, already 6.x on the
   registry, isn't mislabeled). Today: entities, entities.graphics, collections.

## Key invariants (don't regress these)

- The registry's `unity` field is **minor-line minimum** ("6000.0"), not exact;
  join `unity` + `unityRelease` for the precise minimum.
- `getEditorBundledVersions()` (the /packages badge) counts **only Unity 6
  (`6000.%`) editors** — a recent legacy-LTS patch must not masquerade as the
  bundled version.
- The unified note shows only when `isNewerVersion(docs, registry)` — never on a
  mere major.minor difference (that caused false positives on AR Foundation and
  packages with their own historical 6.x).
- `editor_package_versions` is populated by the **full backfill**
  (`ingest:backfill`, incremental/resumable, runs inside the cron); the regular
  `ingest:editor` only covers the 3 newest releases.

## Where things live

- `src/lib/ingest/unity-packages.ts` — curated allowlist, `isRegistryFrozen()`,
  `UNITY_6_REGISTRY_CUTOFF_ISO`.
- `src/lib/parsers/release-notes.ts` — `parseReleaseNotes` → `packageChanges`.
- `src/lib/parsers/package-docs.ts` — docs changelog parser.
- `src/lib/version-compare.ts` — `isNewerVersion`, `earlierUnityRange`,
  `editorPrereleaseLabel`.
- `src/lib/db/repositories.ts` — `getEditorBundledVersions()`, `getPackage()`
  (attaches `bundled_in_editor` + `unified`).
- `src/jobs/{poll-package-docs,backfill-unity6}.ts` — the ingest jobs.
- `src/app/packages/page.tsx`, `src/app/_components/PackageVersionDialog.tsx` —
  the two display surfaces.
- DB tables: `editor_package_versions`, `package_unified_versions`.

After any change here, run `npm run check:packages` and verify `/packages` +
the dialog API on prod once the cron has populated the data.
