/**
 * Parser for Unity package documentation changelogs.
 *
 * Some Unity 6.4+ packages use "unified versioning" - the package version is
 * renumbered to match the Editor version (e.g. com.unity.entities became
 * 6.4.0, continuing from the 1.4.x line). That version-aligned build is only
 * documented at `docs.unity3d.com/Packages/<pkg>@<unity-minor>/...`; the
 * package registry keeps serving the old line (1.4.x) for earlier Unity 6.
 *
 * We read the version from the rendered CHANGELOG.html, whose entries look
 * like `[6.4.0] - 2025-10-16` (newest first).
 */

import { marketingMinorOfEditor } from "../unity-generation";

export type DocsChangelogEntry = {
  version: string;
  date: string | null;
};

// `[6.4.0] - 2025-10-16` (also matches prerelease suffixes like 6.4.0-pre.1).
const CHANGELOG_ENTRY_RE = /\[(\d+\.\d+\.\d+[0-9a-z.\-]*)\]\s*-\s*(\d{4}-\d{2}-\d{2})/i;

/**
 * The newest changelog entry (topmost - Unity lists newest first), or null.
 * Strips HTML tags first so the version heading matches whether it's wrapped
 * in `<h2>` or rendered inline.
 */
export function parseDocsChangelogTopVersion(html: string): DocsChangelogEntry | null {
  const text = html.replace(/<[^>]+>/g, " ");
  const match = text.match(CHANGELOG_ENTRY_RE);
  if (!match) return null;
  return { version: match[1], date: match[2] ?? null };
}

/** "6.4.0" -> "6.4"; null if not a dotted version. */
export function unityMinorOfVersion(version: string): string | null {
  const match = version.match(/^(\d+)\.(\d+)\./);
  return match ? `${match[1]}.${match[2]}` : null;
}

/**
 * Unified versioning arrived with Unity 6.4, which shipped in 2025 - so a
 * changelog whose newest entry predates that cannot be a version-aligned
 * build, no matter what its number says.
 *
 * This matters because some packages had a coincidental x.y line YEARS
 * ago: the SRP family (render-pipelines.core, shadergraph,
 * visualeffectgraph, render-pipelines.lightweight) genuinely released
 * 6.5.3 in **April 2019**, so `@6.5/changelog` returns a real page whose
 * top entry is `[6.5.3] - 2019-04-11`. Matching on major.minor alone
 * accepted it and claimed "Unity 6.5 ships as 6.5.3" for a package the
 * Editor actually bundles at 17.7.0. Same for xr.magicleap (6.4.1, 2021)
 * and cloud.gltfast (6.5.0, 2024).
 *
 * A missing date means we can't confirm the entry is modern, so it's
 * refused too - a false "version-aligned" badge is worse than none.
 */
export const UNIFIED_VERSIONING_EPOCH = "2025-01-01";

export function isPlausibleUnifiedRelease(entry: DocsChangelogEntry): boolean {
  if (!entry.date) return false;
  return entry.date >= UNIFIED_VERSIONING_EPOCH;
}

/**
 * "6000.4.11f1" -> "6.4", "7000.1.0f1" -> "7.1" (the Unity marketing minor
 * used in docs URLs). Null for legacy year versions, which have no
 * separate marketing number and no unified-versioning docs to probe.
 */
export function docsMinorOfEditor(editorVersion: string): string | null {
  return marketingMinorOfEditor(editorVersion);
}
