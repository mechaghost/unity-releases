import type { ReleaseNoteSearchFilters } from "./search";

const ALLOWED_ORDERS: ReadonlyArray<NonNullable<ReleaseNoteSearchFilters["order"]>> = [
  "newest",
  "section",
  "risk",
  "source",
  "area",
  "issue",
  "version",
  "rank"
];

export function filtersFromSearchParams(params: URLSearchParams): ReleaseNoteSearchFilters {
  const rawOrder = params.get("order");
  const order = (ALLOWED_ORDERS as readonly string[]).includes(rawOrder ?? "")
    ? (rawOrder as ReleaseNoteSearchFilters["order"])
    : undefined;
  return {
    q: params.get("q") ?? undefined,
    version: params.get("version") ?? undefined,
    minorLine: params.get("minorLine") ?? undefined,
    stream: params.get("stream") ?? undefined,
    section: params.get("section") ?? undefined,
    area: params.get("area") ?? undefined,
    platform: collectMulti(params, "platform"),
    impactKind: collectMulti(params, "impact") ?? (params.get("type") ?? undefined),
    riskLevel: collectMulti(params, "risk"),
    packageName: collectMulti(params, "package"),
    issueId: collectMulti(params, "issue"),
    order,
    limit: numberParam(params.get("limit"), 100),
    offset: numberParam(params.get("offset"), 0)
  };
}

export function jsonError(error: unknown) {
  return {
    error: error instanceof Error ? error.message : "Unknown error"
  };
}

function collectMulti(params: URLSearchParams, key: string): string | string[] | undefined {
  const all = params.getAll(key);
  if (all.length === 0) return undefined;
  if (all.length === 1) return all[0];
  return all;
}

function numberParam(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
