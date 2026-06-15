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

/** "6000.4.11f1" -> "6.4" (the Unity marketing minor used in docs URLs). */
export function docsMinorOfEditor(editorVersion: string): string | null {
  const match = editorVersion.match(/^6000\.(\d+)\./);
  return match ? `6.${match[1]}` : null;
}
