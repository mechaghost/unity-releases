export type WatchQuery = {
  q?: string;
  minorLine?: string;
  packages?: string[];
  platforms?: string[];
  impacts?: string[];
  risks?: string[];
};

const MULTI_KEYS = ["impact", "package", "platform", "risk"] as const;

export function serializeWatchQuery(query: WatchQuery): string {
  const params = new URLSearchParams();

  for (const impact of [...(query.impacts ?? [])].sort()) {
    params.append("impact", impact);
  }
  if (query.minorLine) {
    params.set("minorLine", query.minorLine);
  }
  for (const packageName of [...(query.packages ?? [])].sort()) {
    params.append("package", packageName);
  }
  for (const platform of [...(query.platforms ?? [])].sort()) {
    params.append("platform", platform);
  }
  if (query.q) {
    params.set("q", query.q);
  }
  for (const risk of [...(query.risks ?? [])].sort()) {
    params.append("risk", risk);
  }

  return params.toString();
}

export function parseWatchQuery(query: string | URLSearchParams): WatchQuery {
  const params = typeof query === "string" ? new URLSearchParams(query) : query;
  const result: WatchQuery = {};

  const q = params.get("q");
  const minorLine = params.get("minorLine");
  if (q) {
    result.q = q;
  }
  if (minorLine) {
    result.minorLine = minorLine;
  }

  const packages = params.getAll("package");
  const platforms = params.getAll("platform");
  const impacts = params.getAll("impact");
  const risks = params.getAll("risk");

  if (packages.length) result.packages = packages;
  if (platforms.length) result.platforms = platforms;
  if (impacts.length) result.impacts = impacts;
  if (risks.length) result.risks = risks;

  for (const key of MULTI_KEYS) {
    params.getAll(key).sort();
  }

  return result;
}
