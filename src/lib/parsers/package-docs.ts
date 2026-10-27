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
import * as cheerio from "cheerio";

/** Unity's @latest landing page redirects with JS and an equivalent HTML link.
 * Read the link as data; never execute the script or infer absence from a bare 200.
 */
export function parseDocsLatestRedirectMinor(html: string, finalUrl: string, pkg: string): string | null {
  let base: URL;
  try { base = new URL(finalUrl); } catch { return null; }
  if (base.origin !== "https://docs.unity3d.com" || base.pathname !== `/Packages/${pkg}@latest/`) return null;
  const $ = cheerio.load(html);
  if ($("title").text().trim() !== `Redirecting to latest version of ${pkg}`) return null;
  const link = $("body a").filter((_, node) => $(node).text().trim() === "follow this link");
  if (link.length !== 1) return null;
  let target: URL;
  try { target = new URL(link.attr("href")!, base); } catch { return null; }
  const prefix = `/Packages/${pkg}@`;
  if (target.origin !== base.origin || !target.pathname.startsWith(prefix)) return null;
  const match = /^(\d+\.\d+)\/index\.html$/.exec(target.pathname.slice(prefix.length));
  return match?.[1] ?? null;
}

/** Package Manager UI was folded into the Editor manual, not a versioned changelog. */
export function isPackageManagerManualRedirect(html: string, finalUrl: string, pkg: string): boolean {
  if (pkg !== "com.unity.package-manager-ui") return false;
  let destination: URL;
  try { destination = new URL(finalUrl); } catch { return false; }
  const $ = cheerio.load(html);
  // The migrated manual is a reference page, never a package changelog.
  // Require its official route AND rendered article identity; a bare 200,
  // client-only shell, or unrelated Unity page must remain uncertain.
  const migrated = /^https:\/\/docs\.unity\.com\/en-us\/engine\/(\d+\.\d+)\/manual\/packages-list\/upm-ui-window\/upm-ui$/.exec(destination.href);
  if (migrated) {
    const content = $("#page-content-container");
    return $("title").text().trim() === `Package Manager window reference • Package Manager window • ${migrated[1]} • Unity Editor • Unity Docs`
      && $('link[rel="alternate"][type="text/markdown"]').attr("href") === `${destination.href}.md`
      && content.find("h1").text().trim() === "Package Manager window reference"
      && content.find("h2#advanced-settings").text().trim() === "Advanced settings"
      && content.find("h2#status-bar").text().trim() === "Status bar"
      && content.text().length > 500;
  }
  if (destination.href !== "https://docs.unity3d.com/Manual/upm-ui.html") return false;
  const canonical = $('link[rel="canonical"]').attr("href") ?? "";
  return /^https:\/\/docs\.unity3d\.com\/\d+\.\d+\/Documentation\/Manual\/upm-ui\.html$/.test(canonical)
    && $("title").text().trim() === "Unity - Manual: Package Manager window reference"
    && $("#content-wrap h1").text().trim() === "Package Manager window reference"
    && $("#content-wrap p").text().length > 500;
}

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
