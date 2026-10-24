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

export class InvalidQueryError extends Error {}

export function filtersFromSearchParams(
  params: URLSearchParams,
  { strictPagination = false } = {}
): ReleaseNoteSearchFilters {
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
    limit: numberParam(params, "limit", 100, 1, 1000, strictPagination),
    offset: numberParam(params, "offset", 0, 0, 2_147_483_647, strictPagination)
  };
}

export function jsonError(error: unknown) {
  return {
    error: error instanceof InvalidQueryError ? error.message : "Unable to complete the request."
  };
}

function collectMulti(params: URLSearchParams, key: string): string | string[] | undefined {
  const all = params.getAll(key);
  if (all.length === 0) return undefined;
  if (all.length === 1) return all[0];
  return all;
}

function numberParam(params: URLSearchParams, key: string, fallback: number, min: number, max: number, strict: boolean): number {
  const value = params.get(key);
  if (value === null) return fallback;
  const parsed = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    if (strict) throw new InvalidQueryError(`${key} must be an integer between ${min} and ${max}.`);
    return fallback;
  }
  return parsed;
}
