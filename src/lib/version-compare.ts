/**
 * Minimal numeric version comparison for Unity package versions.
 * Prerelease suffixes (e.g. `6.6.0-pre.2`) are dropped before comparing.
 */

/** "6.6.0-pre.2" -> [6, 6, 0]. */
export function versionParts(version: string | null | undefined): number[] {
  if (!version) return [];
  return version
    .split("-")[0]
    .split(".")
    .map((n) => parseInt(n, 10))
    .filter((n) => !Number.isNaN(n));
}

/** True when `a` is a strictly higher version than `b` (major → minor → patch). */
export function isNewerVersion(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const pa = versionParts(a);
  const pb = versionParts(b);
  if (!pa.length || !pb.length) return false;
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

/**
 * Prerelease channel of a Unity editor version, or null when stable.
 * "6000.5.0b10" -> "beta", "6000.6.0a7" -> "alpha", "6000.0.23f1" / "...p1" -> null.
 */
export function editorPrereleaseLabel(
  editorVersion: string | null | undefined
): "beta" | "alpha" | null {
  if (!editorVersion) return null;
  const m = editorVersion.match(/([abfp])\d+$/i);
  if (!m) return null;
  const ch = m[1].toLowerCase();
  if (ch === "b") return "beta";
  if (ch === "a") return "alpha";
  return null; // f (final) / p (patch) are stable
}

/**
 * The span of earlier Unity 6 minors a renumbered package's old line still
 * covers: "6.4" -> "6.0–6.3". Falls back to a generic phrase at the boundary.
 */
export function earlierUnityRange(unityMinor: string): string {
  const m = unityMinor.match(/^(\d+)\.(\d+)/);
  if (!m) return "earlier Unity 6";
  const major = m[1];
  const minor = parseInt(m[2], 10);
  if (minor <= 0) return `earlier Unity ${major}`;
  if (minor === 1) return `${major}.0`;
  return `${major}.0–${major}.${minor - 1}`;
}
