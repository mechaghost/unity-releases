export const RELEASE_FILTERS = [
  { value: "6000.3-lts", label: "6.3 LTS" },
  { value: "6000.0-lts", label: "6.0 LTS" },
  { value: "update", label: "Supported" },
  { value: "beta", label: "Beta" },
  { value: "alpha", label: "Alpha" }
] as const;

export type ReleaseFilterValue = (typeof RELEASE_FILTERS)[number]["value"];

export type FilterableRelease = {
  version: string;
  stream: string | null;
};

const RELEASE_FILTER_VALUES = RELEASE_FILTERS.map((filter) => filter.value);
const DEFAULT_RELEASE_FILTERS: ReleaseFilterValue[] = ["6000.3-lts", "6000.0-lts"];
const LEGACY_ALIASES: Record<string, ReleaseFilterValue[]> = {
  lts: DEFAULT_RELEASE_FILTERS
};

export function parseSelectedReleaseFilters(
  raw: string | string[] | undefined
): ReleaseFilterValue[] {
  const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const selected = values.flatMap((value) => {
    const normalized = value.toLowerCase();
    if (LEGACY_ALIASES[normalized]) return LEGACY_ALIASES[normalized];
    return RELEASE_FILTER_VALUES.includes(normalized as ReleaseFilterValue)
      ? [normalized as ReleaseFilterValue]
      : [];
  });

  return selected.length > 0 ? Array.from(new Set(selected)) : DEFAULT_RELEASE_FILTERS;
}

export function releaseMatchesSelectedFilters(
  release: FilterableRelease,
  selected: ReleaseFilterValue[]
) {
  const normalizedStream = (release.stream ?? "").toLowerCase();
  if (!normalizedStream) return false;

  return selected.some((value) => {
    switch (value) {
      case "6000.0-lts":
        return normalizedStream.includes("lts") && release.version.startsWith("6000.0.");
      case "6000.3-lts":
        return normalizedStream.includes("lts") && release.version.startsWith("6000.3.");
      case "update":
        return normalizedStream.includes("update") || normalizedStream.includes("supported");
      case "beta":
      case "alpha":
        return normalizedStream.includes(value);
    }
  });
}

export function releasePageHref(page: number, selectedFilters: ReleaseFilterValue[]): string {
  const params = new URLSearchParams();
  if (!selectedFiltersAreDefault(selectedFilters)) {
    for (const filter of selectedFilters) {
      params.append("stream", filter);
    }
  }
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/releases?${qs}` : "/releases";
}

function selectedFiltersAreDefault(selectedFilters: ReleaseFilterValue[]) {
  return (
    selectedFilters.length === DEFAULT_RELEASE_FILTERS.length &&
    DEFAULT_RELEASE_FILTERS.every((filter) => selectedFilters.includes(filter))
  );
}
