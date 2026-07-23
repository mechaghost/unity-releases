import { isModernMajor } from "../unity-generation";

export type UnityStream = "LTS" | "Update/Supported" | "beta" | "alpha" | "patch";

/** `stream` as Unity's release API reports it, verbatim. */
export type UnityApiStream = "LTS" | "SUPPORTED" | "BETA" | "ALPHA";

export type ParseUnityVersionOptions = {
  /**
   * Unity's own `stream` value for this release, when the caller has it
   * (the release API returns one per release). Authoritative for final
   * builds - see {@link resolveStream}.
   */
  apiStream?: string | null;
};

export type ParsedUnityVersion = {
  raw: string;
  major: number;
  minor: number;
  patch: number;
  suffixChannel: string;
  suffixNumber: number;
  majorLine: string;
  minorLine: string;
  stream: UnityStream;
  isPrerelease: boolean;
};

const UNITY_VERSION_RE = /^(\d+)\.(\d+)\.(\d+)([abfp])(\d+)$/;

const CHANNEL_SORT_WEIGHT: Record<string, number> = {
  a: 0,
  b: 1,
  f: 2,
  p: 3
};

export function parseUnityVersion(
  version: string,
  options: ParseUnityVersionOptions = {}
): ParsedUnityVersion {
  const match = version.trim().match(UNITY_VERSION_RE);

  if (!match) {
    throw new Error(`Invalid Unity version: ${version}`);
  }

  const [, majorRaw, minorRaw, patchRaw, suffixChannel, suffixNumberRaw] = match;
  const major = Number(majorRaw);
  const minor = Number(minorRaw);
  const patch = Number(patchRaw);
  const suffixNumber = Number(suffixNumberRaw);

  return {
    raw: version.trim(),
    major,
    minor,
    patch,
    suffixChannel,
    suffixNumber,
    majorLine: String(major),
    minorLine: `${major}.${minor}`,
    stream: resolveStream(suffixChannel, major, minor, options.apiStream),
    isPrerelease: suffixChannel === "a" || suffixChannel === "b"
  };
}

/**
 * Offline fallback for which minor lines are LTS.
 *
 * This is *not* the primary source of truth any more - Unity's release API
 * reports a `stream` per release and {@link resolveStream} prefers it, so a
 * newly-announced LTS line is classified correctly without touching this map.
 * The map still covers three cases the API can't:
 *
 * - the release-page scrape path when the API lookup fails,
 * - `poll-legacy-lts`, which selects which legacy lines to crawl at all,
 * - pure/sync callers with no network (client components, unit tests).
 *
 * Unity 6: 6000.0, 6000.3, and 6000.7 are LTS; the lines in between are
 * Update/Supported. Pre-Unity-6: only the LTS branch of each major (2022.3,
 * 2021.3, 2020.3, 2019.4) is in scope - the other lines are long-EOL and
 * produce no upgrade-decision signal.
 *
 * `npm run check:lts` reports drift between this map and Unity's API.
 */
const LTS_MINOR_LINES_BY_MAJOR: Record<number, ReadonlySet<number>> = {
  2019: new Set([4]),
  2020: new Set([3]),
  2021: new Set([3]),
  2022: new Set([3]),
  6000: new Set([0, 3, 7])
};

export function isLtsMinorLine(major: number, minor: number): boolean {
  return LTS_MINOR_LINES_BY_MAJOR[major]?.has(minor) ?? false;
}

/**
 * True for Unity 6 and every generation after it (6000.x, 7000.x, …).
 * Named for Unity 6 because that's where the modern scheme starts; the
 * check itself is generation-agnostic.
 */
export function isUnity6OrNewer(version: string): boolean {
  return isModernMajor(parseUnityVersion(version).major);
}

/**
 * Map Unity's release-API `stream` onto our internal stream names.
 * Returns null for anything unrecognised so callers fall back to
 * classifying by version channel.
 */
export function apiStreamToUnityStream(apiStream: string | null | undefined): UnityStream | null {
  switch (apiStream?.trim().toUpperCase()) {
    case "LTS":
      return "LTS";
    case "SUPPORTED":
      return "Update/Supported";
    case "BETA":
      return "beta";
    case "ALPHA":
      return "alpha";
    default:
      return null;
  }
}

export function compareUnityVersions(a: string, b: string): number {
  const left = parseUnityVersion(a);
  const right = parseUnityVersion(b);

  return (
    left.major - right.major ||
    left.minor - right.minor ||
    left.patch - right.patch ||
    CHANNEL_SORT_WEIGHT[left.suffixChannel] - CHANNEL_SORT_WEIGHT[right.suffixChannel] ||
    left.suffixNumber - right.suffixNumber
  );
}

/**
 * Decide a release's stream.
 *
 * Alpha/beta/patch are read straight off the version channel - the version
 * string already says it, and Unity's API vocabulary doesn't distinguish a
 * `p` patch build from its LTS line, so delegating those would silently
 * reclassify existing rows.
 *
 * Final (`f`) builds are the only ambiguous case: whether `6000.7.0f1` is
 * LTS or Update/Supported isn't derivable from the number. Unity's release
 * API knows, so prefer it when the caller supplies it - that's what lets a
 * brand-new LTS line (6000.7, or Unity 7's first) classify correctly with
 * no code change. A prerelease `apiStream` on an `f` build is ignored as
 * inconsistent, falling through to the curated map.
 */
function resolveStream(
  channel: string,
  major: number,
  minor: number,
  apiStream?: string | null
): UnityStream {
  if (channel === "a") {
    return "alpha";
  }

  if (channel === "b") {
    return "beta";
  }

  if (channel === "p") {
    return "patch";
  }

  const fromApi = apiStreamToUnityStream(apiStream);
  if (fromApi === "LTS" || fromApi === "Update/Supported") {
    return fromApi;
  }

  return isLtsMinorLine(major, minor) ? "LTS" : "Update/Supported";
}
