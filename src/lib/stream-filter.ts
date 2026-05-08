export const STREAM_FILTER_COOKIE = "unity-releases-streams";

export const ALL_STREAMS = ["LTS", "Update/Supported", "beta", "alpha"] as const;
export type StreamName = (typeof ALL_STREAMS)[number];

/** Default when no cookie is set: stable streams only. */
export const DEFAULT_STREAMS: StreamName[] = ["LTS", "Update/Supported"];

/**
 * Parse a raw cookie value into a list of allowed streams. Pure and
 * testable.
 *
 * - `undefined`  → first visit, no cookie → fall back to the default.
 * - empty / whitespace → user explicitly unchecked everything.
 * - csv list   → trim, drop unknown values.
 */
export function parseStreamFilterCookie(raw: string | undefined): StreamName[] {
  if (raw === undefined) return DEFAULT_STREAMS;
  if (raw.trim() === "") return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is StreamName => (ALL_STREAMS as readonly string[]).includes(s));
}

/** True when the given release stream is allowed by the current filter. */
export function streamMatches(stream: string | null, allowed: StreamName[]): boolean {
  if (!stream) return false;
  return (allowed as string[]).includes(stream);
}

// ─── /compare page ─────────────────────────────────────────────
//
// /compare uses a stricter default and reads its selection from the URL
// only (no cookie), so a shared link always renders the same scope for
// any reader. Cookies on this page would let two people on the same
// link see different version sets, which defeats the purpose.

/** Default scope for /compare when the URL has no `?stream=` params. */
export const COMPARE_DEFAULT_STREAMS: StreamName[] = ["LTS"];

/**
 * Resolve the stream selection driving /compare from the URL's repeated
 * `?stream=` values. Unknown values are dropped; if nothing valid
 * remains we fall back to {@link COMPARE_DEFAULT_STREAMS} so the page
 * never renders an empty version set.
 */
export function parseCompareStreamSelection(
  rawValues: readonly string[] | undefined
): StreamName[] {
  if (!rawValues || rawValues.length === 0) return [...COMPARE_DEFAULT_STREAMS];
  const valid = rawValues.filter((s): s is StreamName =>
    (ALL_STREAMS as readonly string[]).includes(s)
  );
  if (valid.length === 0) return [...COMPARE_DEFAULT_STREAMS];
  // De-dupe while preserving order so the URL `?stream=LTS&stream=beta`
  // and `?stream=LTS&stream=LTS&stream=beta` produce the same set.
  return [...new Set(valid)];
}

type StreamFilterableRelease = {
  version: string;
  stream: string | null;
};

/**
 * Narrow a release list to entries whose stream is in `allowed`, but
 * always keep the user's currently selected `from` / `to` so they're
 * never trapped out of editing a URL-supplied selection.
 */
export function applyCompareStreamFilter<T extends StreamFilterableRelease>(
  releases: T[],
  allowed: StreamName[],
  fromVersion: string,
  toVersion: string
): T[] {
  return releases.filter(
    (r) =>
      streamMatches(r.stream, allowed) ||
      r.version === fromVersion ||
      r.version === toVersion
  );
}
