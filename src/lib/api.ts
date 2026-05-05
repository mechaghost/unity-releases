import type { ReleaseNoteSearchFilters } from "./search";
import { parseWatchQuery } from "./watch";

export function filtersFromSearchParams(params: URLSearchParams): ReleaseNoteSearchFilters {
  const watch = parseWatchQuery(params);
  return {
    q: params.get("q") ?? watch.q,
    version: params.get("version") ?? undefined,
    minorLine: params.get("minorLine") ?? watch.minorLine,
    stream: params.get("stream") ?? undefined,
    section: params.get("section") ?? undefined,
    area: params.get("area") ?? undefined,
    platform: params.get("platform") ?? watch.platforms?.[0],
    impactKind: params.get("type") ?? params.get("impact") ?? watch.impacts?.[0],
    riskLevel: params.get("risk") ?? watch.risks?.[0],
    packageName: params.get("package") ?? watch.packages?.[0],
    issueId: params.get("issue") ?? undefined,
    limit: numberParam(params.get("limit"), 100),
    offset: numberParam(params.get("offset"), 0)
  };
}

export function jsonError(error: unknown) {
  return {
    error: error instanceof Error ? error.message : "Unknown error"
  };
}

function numberParam(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
