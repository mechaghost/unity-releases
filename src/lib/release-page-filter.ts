export const RELEASE_FILTERS = [
  { value: "6000.3-lts", label: "6.3 LTS" },
  { value: "6000.0-lts", label: "6.0 LTS" },
  { value: "update", label: "Supported" },
  { value: "beta", label: "Beta" },
  { value: "alpha", label: "Alpha" },
  // Legacy LTS lines, off by default. Each chip only shows the
  // canonical .X LTS minor of its major (2022.3, 2021.3, 2020.3,
  // 2019.4) — non-LTS branches are not indexed.
  { value: "2022.3-lts", label: "2022 LTS" },
  { value: "2021.3-lts", label: "2021 LTS" },
  { value: "2020.3-lts", label: "2020 LTS" },
  { value: "2019.4-lts", label: "2019 LTS" }
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
      case "2022.3-lts":
        return normalizedStream.includes("lts") && release.version.startsWith("2022.3.");
      case "2021.3-lts":
        return normalizedStream.includes("lts") && release.version.startsWith("2021.3.");
      case "2020.3-lts":
        return normalizedStream.includes("lts") && release.version.startsWith("2020.3.");
      case "2019.4-lts":
        return normalizedStream.includes("lts") && release.version.startsWith("2019.4.");
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
