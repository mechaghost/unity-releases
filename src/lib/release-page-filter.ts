import { isModernMajor, marketingMinor, unityGeneration } from "./unity-generation";

/**
 * A chip value on /releases: either a fixed stream key ("update" / "beta" /
 * "alpha") or a per-line LTS key shaped `<minorLine>-lts` (e.g. "6000.7-lts").
 *
 * Not a literal union any more - the LTS chips are derived from whatever
 * lines are actually indexed, so the set isn't knowable at compile time.
 */
export type ReleaseFilterValue = string;

export type ReleaseFilterOption = { value: ReleaseFilterValue; label: string };

export type FilterableRelease = {
  version: string;
  stream: string | null;
};

/** Stream chips that exist regardless of which lines are indexed. */
const STREAM_FILTERS: ReleaseFilterOption[] = [
  { value: "update", label: "Supported" },
  { value: "beta", label: "Beta" },
  { value: "alpha", label: "Alpha" }
];

const LTS_SUFFIX = "-lts";

/**
 * "6000.7-lts" -> "6000.7"; null for a non-LTS chip value.
 *
 * Defensive `typeof` check because `ReleaseFilterValue` is now a bare `string`
 * rather than a literal union, so TypeScript no longer proves what reaches
 * here (and `noUncheckedIndexedAccess` is off).
 */
function minorLineOfLtsFilter(value: ReleaseFilterValue): string | null {
  if (typeof value !== "string" || !value.endsWith(LTS_SUFFIX)) return null;
  const minorLine = value.slice(0, -LTS_SUFFIX.length);
  return /^\d+\.\d+$/.test(minorLine) ? minorLine : null;
}

/** Chip label for an LTS line: "6000.7" -> "6.7 LTS", "2022.3" -> "2022 LTS". */
function ltsFilterLabel(major: number, minor: number): string {
  const marketing = marketingMinor(major, minor);
  // Legacy lines are named by year alone - there has only ever been one
  // indexed LTS branch per legacy major, so "2022 LTS" is unambiguous.
  return marketing ? `${marketing} LTS` : `${major} LTS`;
}

/**
 * Build the chip row from the releases actually indexed.
 *
 * Previously a hardcoded list naming 6000.3 and 6000.0. That had to be edited
 * for every new LTS line, and until it was, releases on the new line were
 * *unreachable*: no `-lts` chip matched them and they aren't "update"/"beta"/
 * "alpha" either, so 6000.7.0f1 would have been invisible on /releases the
 * day it shipped. Deriving the chips removes both problems at once.
 *
 * Order: modern LTS lines newest-first, then the stream chips, then legacy
 * LTS lines newest-first - the same reading order as before.
 */
export function buildReleaseFilters(
  releases: readonly FilterableRelease[]
): ReleaseFilterOption[] {
  const ltsLines = new Map<string, { major: number; minor: number }>();

  for (const release of releases) {
    if (!(release.stream ?? "").toLowerCase().includes("lts")) continue;
    const match = release.version.match(/^(\d+)\.(\d+)\./);
    if (!match) continue;
    const major = Number(match[1]);
    const minor = Number(match[2]);
    ltsLines.set(`${major}.${minor}`, { major, minor });
  }

  const sorted = [...ltsLines.entries()].sort(
    ([, a], [, b]) => b.major - a.major || b.minor - a.minor
  );
  const toOption = ([minorLine, { major, minor }]: (typeof sorted)[number]) => ({
    value: `${minorLine}${LTS_SUFFIX}`,
    label: ltsFilterLabel(major, minor)
  });

  return [
    ...sorted.filter(([, l]) => isModernMajor(l.major)).map(toOption),
    ...STREAM_FILTERS,
    ...sorted.filter(([, l]) => !isModernMajor(l.major)).map(toOption)
  ];
}

/**
 * Default selection: every modern-generation LTS line, matching the previous
 * hardcoded default of 6000.3 + 6000.0. Legacy lines stay off until ticked.
 *
 * Falls back to the stream chips if nothing is indexed yet, so a fresh
 * install doesn't render an empty page with no way to select anything.
 */
export function defaultReleaseFilters(
  available: readonly ReleaseFilterOption[]
): ReleaseFilterValue[] {
  const modernLts = available
    .map((option) => ({ option, minorLine: minorLineOfLtsFilter(option.value) }))
    .filter(({ minorLine }) => {
      if (!minorLine) return false;
      return isModernMajor(Number(minorLine.split(".")[0]));
    })
    .map(({ option }) => option.value);

  return modernLts.length > 0 ? modernLts : STREAM_FILTERS.map((f) => f.value);
}

export function parseSelectedReleaseFilters(
  raw: string | string[] | undefined,
  available: readonly ReleaseFilterOption[]
): ReleaseFilterValue[] {
  const defaults = defaultReleaseFilters(available);
  const availableValues = new Set(available.map((option) => option.value));
  // A Map, not an object literal: `?stream=constructor` and `?stream=__proto__`
  // hit Object.prototype on a plain object, so the lookup returned a function
  // instead of an array and flatMap spliced it into the result - which then
  // threw in minorLineOfLtsFilter and 500'd the page (there is no error.tsx).
  const aliases = new Map([
    ["lts", defaults],
    // The chip's label says "Supported" but its value is "update" - accept the
    // label as an alias so hand-built share URLs (?stream=supported) select the
    // stream the author meant instead of silently falling back to the defaults.
    ["supported", ["update"]]
  ]);

  const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const selected = values.flatMap((value) => {
    if (typeof value !== "string") return [];
    const normalized = value.toLowerCase();
    const alias = aliases.get(normalized);
    if (alias) return alias;
    return availableValues.has(normalized) ? [normalized] : [];
  });

  return selected.length > 0 ? Array.from(new Set(selected)) : defaults;
}

export function releaseMatchesSelectedFilters(
  release: FilterableRelease,
  selected: readonly ReleaseFilterValue[]
) {
  const normalizedStream = (release.stream ?? "").toLowerCase();
  if (!normalizedStream) return false;

  return selected.some((value) => {
    const minorLine = minorLineOfLtsFilter(value);
    if (minorLine) {
      // Generic per-line match - no case per version, so a line Unity adds
      // is filterable as soon as it's indexed.
      return normalizedStream.includes("lts") && release.version.startsWith(`${minorLine}.`);
    }
    if (value === "update") {
      return normalizedStream.includes("update") || normalizedStream.includes("supported");
    }
    if (value === "beta" || value === "alpha") {
      return normalizedStream.includes(value);
    }
    return false;
  });
}

/**
 * Describes the DEFAULT VIEW for the page intro, not merely what is indexed.
 *
 * Derived from the default chip selection rather than from every indexed
 * release, because the two diverge: a generation whose only builds so far are
 * alphas gets no `-lts` chip and contributes nothing to the default view, so
 * naming it in "… LTS lines are shown by default" states something false. That
 * is exactly the state the index enters the day the first 7000.x alpha lands.
 *
 * Returns null when the default selection has no LTS lines at all (the
 * stream-chip fallback fired) - callers must then use different wording,
 * since there is no "LTS lines are shown by default" to describe.
 */
export function defaultViewGenerationsLabel(
  defaults: readonly ReleaseFilterValue[]
): string | null {
  const generations = new Set<number>();
  for (const value of defaults) {
    const minorLine = minorLineOfLtsFilter(value);
    if (!minorLine) continue;
    const generation = unityGeneration(Number(minorLine.split(".")[0]));
    if (generation !== null) generations.add(generation);
  }
  const sorted = [...generations].sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return `Unity ${sorted[0]}`;
  return `Unity ${sorted.slice(0, -1).join(", ")} and ${sorted[sorted.length - 1]}`;
}

/** Supported sort keys on /releases. Only build-score sort is wired in
 *  v1 — adding more would require parallel server-side sort logic per
 *  column. */
export type ReleaseSortKey = "score-desc" | "score-asc";

export function parseReleaseSortKey(
  raw: string | string[] | undefined
): ReleaseSortKey | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === "score-desc" || v === "score-asc") return v;
  return null;
}

/**
 * Sort releases by their composite score. Releases with no score
 * (insufficient data) always land LAST regardless of direction so they
 * don't clog the top of an ascending view.
 *
 * Generic over the release shape — only requires a `version` string —
 * so the helper is independent of the page's local `Release` type.
 */
export function sortReleasesByScore<T extends { version: string }>(
  releases: T[],
  scoreByVersion: Map<string, { composite: number | null }>,
  direction: ReleaseSortKey
): T[] {
  const desc = direction === "score-desc";
  return [...releases].sort((a, b) => {
    const aScore = scoreByVersion.get(a.version)?.composite;
    const bScore = scoreByVersion.get(b.version)?.composite;
    if (aScore == null && bScore == null) return 0;
    if (aScore == null) return 1;
    if (bScore == null) return -1;
    return desc ? bScore - aScore : aScore - bScore;
  });
}

export function releasePageHref(
  page: number,
  selectedFilters: ReleaseFilterValue[],
  sort: ReleaseSortKey | null = null,
  defaults: readonly ReleaseFilterValue[] = []
): string {
  const params = new URLSearchParams();
  if (!selectedFiltersAreDefault(selectedFilters, defaults)) {
    for (const filter of selectedFilters) {
      params.append("stream", filter);
    }
  }
  if (page > 1) params.set("page", String(page));
  if (sort) params.set("sort", sort);
  const qs = params.toString();
  return qs ? `/releases?${qs}` : "/releases";
}

/** Default selections are omitted from the URL so /releases stays clean. */
function selectedFiltersAreDefault(
  selectedFilters: readonly ReleaseFilterValue[],
  defaults: readonly ReleaseFilterValue[]
) {
  return (
    defaults.length > 0 &&
    selectedFilters.length === defaults.length &&
    defaults.every((filter) => selectedFilters.includes(filter))
  );
}
