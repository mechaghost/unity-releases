/**
 * Lane configuration shared between the on-screen `/compare` view and
 * the LLM-facing `/compare.md` export. Centralising it here keeps the
 * markdown export and the rendered page reading from the exact same set
 * of lane definitions — when a new lane is added, it shows up in both
 * surfaces automatically.
 */
import { searchReleaseNotesInRange } from "@/lib/db/repositories";
import { LANE_CATALOG, type LaneId } from "@/lib/lane-catalog";
import type { ReleaseNoteSearchFilters } from "@/lib/search";

export type LaneMode = "by-release" | "by-issue" | "by-package";

export type ReleaseNoteRow = {
  id: number;
  version: string;
  section: string;
  area: string | null;
  platforms: string[];
  package_names: string[];
  impact_kind: string;
  risk_level: string;
  body: string;
  issue_ids: string[];
  issue_links_json: unknown;
  // pg returns TIMESTAMPTZ as Date by default; some code paths feed strings.
  release_date: string | Date | null;
};

export type LaneDef = (typeof LANE_CATALOG)[LaneId] & {
  mode: LaneMode;
  searchFilter: Partial<Pick<ReleaseNoteSearchFilters, "impactKind" | "riskLevel">>;
  postFilter?: (row: ReleaseNoteRow) => boolean;
  countFrom: (counts: { byImpact: Record<string, number>; blockerKnownIssues: number }) => number;
  emptyMessage: string;
};

type LaneSpec = Omit<LaneDef, keyof (typeof LANE_CATALOG)[LaneId]>;

// Per-lane cap for the markdown download — fetched independently of the
// on-screen pagination so the file an LLM consumes is the full dataset,
// not just the current page. Bounded so a pathological range can't OOM
// the request.
export const EXPORT_ROW_LIMIT = 5000;

// Lane order is intentional: it reads as a top-down "should I upgrade?"
// triage. Decision-driving lanes (blockers / breaking / known / security
// / package) come first; the long-tail lanes (api / fix / improvement /
// feature / change) follow as supporting material.
export const COMPARE_LANE_SPECS: Partial<Record<LaneId, LaneSpec>> = {
  blockers: {
    mode: "by-issue",
    searchFilter: { impactKind: "known_issue", riskLevel: "blocker" },
    countFrom: (c) => c.blockerKnownIssues,
    emptyMessage: "No known blockers in this range."
  },
  breaking: {
    mode: "by-release",
    searchFilter: { impactKind: "breaking_change" },
    countFrom: (c) => c.byImpact.breaking_change ?? 0,
    emptyMessage: "No breaking changes in this range."
  },
  known: {
    mode: "by-issue",
    searchFilter: { impactKind: "known_issue" },
    postFilter: (r) => r.risk_level !== "blocker",
    countFrom: (c) => Math.max((c.byImpact.known_issue ?? 0) - c.blockerKnownIssues, 0),
    emptyMessage: "No outstanding known issues."
  },
  security: {
    mode: "by-release",
    searchFilter: { impactKind: ["security_related_fix", "install_risk"] },
    countFrom: (c) => (c.byImpact.security_related_fix ?? 0) + (c.byImpact.install_risk ?? 0),
    emptyMessage: "No security or install-impact notes."
  },
  package: {
    mode: "by-package",
    searchFilter: { impactKind: "package_change" },
    countFrom: (c) => c.byImpact.package_change ?? 0,
    emptyMessage: "No package updates."
  },
  api: {
    mode: "by-release",
    searchFilter: { impactKind: "api_change" },
    countFrom: (c) => c.byImpact.api_change ?? 0,
    emptyMessage: "No API changes in this range."
  },
  fix: {
    mode: "by-release",
    searchFilter: { impactKind: "fix" },
    countFrom: (c) => c.byImpact.fix ?? 0,
    emptyMessage: "No fixes."
  },
  improvement: {
    mode: "by-release",
    searchFilter: { impactKind: "improvement" },
    countFrom: (c) => c.byImpact.improvement ?? 0,
    emptyMessage: "No improvements."
  },
  feature: {
    mode: "by-release",
    searchFilter: { impactKind: "feature" },
    countFrom: (c) => c.byImpact.feature ?? 0,
    emptyMessage: "No new features."
  },
  change: {
    mode: "by-release",
    searchFilter: { impactKind: "change" },
    countFrom: (c) => c.byImpact.change ?? 0,
    emptyMessage: "No miscellaneous changes."
  }
};

export const LANES: LaneDef[] = (
  Object.entries(COMPARE_LANE_SPECS) as [LaneId, LaneSpec][]
).map(([id, spec]) => ({ ...LANE_CATALOG[id], ...spec }));

// Lanes that start collapsed on /compare. The first five lanes (blockers,
// breaking, known, security, package) carry upgrade-decision signal and
// stay open by default; the rest are supporting material.
export const COMPARE_DEFAULT_COLLAPSED: LaneId[] = [
  "known",
  "api",
  "fix",
  "improvement",
  "feature",
  "change"
];

/** Fetch one lane's rows in scope with no UI-side pagination, swallowing
 *  query errors so a single broken lane doesn't blank the whole export. */
export async function safeSearchInRange(
  versions: string[],
  def: LaneDef,
  userSlice: ReleaseNoteSearchFilters,
  limit: number
): Promise<ReleaseNoteRow[]> {
  try {
    return (await searchReleaseNotesInRange(
      versions,
      { ...def.searchFilter, ...userSlice },
      limit,
      0
    )) as ReleaseNoteRow[];
  } catch {
    return [];
  }
}
