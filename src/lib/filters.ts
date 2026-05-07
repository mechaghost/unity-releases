import type { LaneId } from "@/lib/lane-catalog";
import { isLaneId, LANE_IDS } from "@/lib/lane-catalog";
import type { ReleaseNoteSearchFilters } from "@/lib/search";

/**
 * Filter state shared by /compare and /releases/[version]. The state is
 * encoded into the URL (so it's shareable/bookmarkable) and a sticky cookie
 * holds the per-view preset selection.
 *
 * Phase 1 ships a subset of the dimensions in docs/filter-plan.md:
 * lane, risk, platform, package, search, issue ID, manifest-only,
 * has-tracker-link, persona preset.
 */

export const RISK_LEVELS = ["blocker", "caution", "review", "info"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const PERSONA_PRESETS = ["director", "balanced", "indie"] as const;
export type PersonaPreset = (typeof PERSONA_PRESETS)[number];

export const DEFAULT_PERSONA: PersonaPreset = "balanced";

export type FilterState = {
  q: string;
  lanes: LaneId[];
  risks: RiskLevel[];
  platforms: string[];
  packages: string[];
  issueId: string;
  manifestOnly: boolean;
  hasTracker: boolean;
  preset: PersonaPreset;
};

export const EMPTY_FILTERS: FilterState = {
  q: "",
  lanes: [],
  risks: [],
  platforms: [],
  packages: [],
  issueId: "",
  manifestOnly: false,
  hasTracker: false,
  preset: DEFAULT_PERSONA
};

// ─── persona defaults ─────────────────────────────────────────────────────

/**
 * Each preset seeds the drawer on first open. The user's later overrides win
 * and get saved to the sticky cookie; the preset is purely a starting point.
 */
export const PRESET_DEFAULTS: Record<PersonaPreset, Partial<FilterState>> = {
  director: {
    lanes: ["blockers", "breaking", "api", "security"],
    risks: ["blocker"],
    manifestOnly: true
  },
  balanced: {
    lanes: ["blockers", "breaking", "api", "known", "security", "package"]
  },
  indie: {
    lanes: ["blockers", "breaking", "security"],
    platforms: ["iOS", "Android", "WebGL"],
    manifestOnly: true
  }
};

export function presetState(preset: PersonaPreset): FilterState {
  return { ...EMPTY_FILTERS, ...PRESET_DEFAULTS[preset], preset };
}

// ─── lane → impact_kind mapping ──────────────────────────────────────────

/**
 * Lanes are user-facing buckets; the database column is `impact_kind`. Map
 * each lane to the impact_kinds it shows. The `risk_level` axis stays a
 * separate filter (Director wants "Blocker" risk regardless of lane).
 */
export const LANE_TO_IMPACT_KINDS: Record<LaneId, string[]> = {
  blockers: ["known_issue"],
  breaking: ["breaking_change"],
  api: ["api_change"],
  known: ["known_issue"],
  security: ["security_related_fix", "install_risk"],
  package: ["package_change"],
  feature: ["feature"],
  improvement: ["improvement"],
  fix: ["fix"],
  change: ["change"],
  docs: ["documentation"]
};

// ─── URL <-> state ───────────────────────────────────────────────────────

/**
 * Read all filter dimensions out of a URLSearchParams. Tolerant: bad values
 * are dropped silently rather than throwing. The persona param defaults to
 * `DEFAULT_PERSONA`; pass the cookie-stored preference as the `defaultPreset`
 * so the URL can still override it.
 */
export function parseFiltersFromParams(
  params: URLSearchParams,
  defaultPreset: PersonaPreset = DEFAULT_PERSONA
): FilterState {
  const presetRaw = params.get("preset") ?? defaultPreset;
  const preset = (PERSONA_PRESETS as readonly string[]).includes(presetRaw)
    ? (presetRaw as PersonaPreset)
    : defaultPreset;

  const lanes = parseList(params.get("lanes"))
    .filter((id): id is LaneId => isLaneId(id));
  const risks = parseList(params.get("risks"))
    .filter((id): id is RiskLevel => (RISK_LEVELS as readonly string[]).includes(id));
  const platforms = parseList(params.get("platforms"));
  const packages = parseList(params.get("packages"));

  return {
    q: (params.get("q") ?? "").trim(),
    lanes,
    risks,
    platforms,
    packages,
    issueId: (params.get("issue") ?? "").trim().toUpperCase(),
    manifestOnly: params.get("manifest") === "1",
    hasTracker: params.get("tracker") === "1",
    preset
  };
}

/** Serialize filter state into URLSearchParams entries. Only sets keys that
 *  diverge from EMPTY_FILTERS so URLs stay short. */
export function serializeFiltersToParams(state: FilterState, into: URLSearchParams) {
  if (state.q) into.set("q", state.q);
  if (state.lanes.length) into.set("lanes", state.lanes.join(","));
  if (state.risks.length) into.set("risks", state.risks.join(","));
  if (state.platforms.length) into.set("platforms", state.platforms.join(","));
  if (state.packages.length) into.set("packages", state.packages.join(","));
  if (state.issueId) into.set("issue", state.issueId);
  if (state.manifestOnly) into.set("manifest", "1");
  if (state.hasTracker) into.set("tracker", "1");
  if (state.preset && state.preset !== DEFAULT_PERSONA) into.set("preset", state.preset);
}

function parseList(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

// ─── helpers ─────────────────────────────────────────────────────────────

/** True if the user has set anything beyond their preset's defaults. */
export function hasActiveFilters(state: FilterState): boolean {
  return (
    state.q !== "" ||
    state.lanes.length > 0 ||
    state.risks.length > 0 ||
    state.platforms.length > 0 ||
    state.packages.length > 0 ||
    state.issueId !== "" ||
    state.manifestOnly ||
    state.hasTracker
  );
}

/** Count of filter chips to display on the Filter button badge. */
export function activeFilterCount(state: FilterState): number {
  let n = 0;
  if (state.q) n += 1;
  if (state.issueId) n += 1;
  if (state.manifestOnly) n += 1;
  if (state.hasTracker) n += 1;
  n += state.lanes.length;
  n += state.risks.length;
  n += state.platforms.length;
  n += state.packages.length;
  return n;
}

/** Project the filter state into the SQL filter shape consumed by
 *  buildReleaseNoteWhere / searchReleaseNotesInRange.
 *
 *  `manifestPackages` comes from the user's saved manifest cookie (see
 *  getUserPackages). When `manifestOnly` is on, we intersect the explicit
 *  package selection with the manifest list — or, if no explicit selection
 *  was made, fall back to "every package in the manifest".
 */
export function filtersToSearchFilters(
  state: FilterState,
  manifestPackages: readonly string[] = []
): Pick<
  ReleaseNoteSearchFilters,
  "q" | "impactKind" | "riskLevel" | "platform" | "packageName" | "issueId" | "hasTracker"
> {
  const out: Pick<
    ReleaseNoteSearchFilters,
    "q" | "impactKind" | "riskLevel" | "platform" | "packageName" | "issueId" | "hasTracker"
  > = {};

  if (state.q) out.q = state.q;
  if (state.issueId) out.issueId = state.issueId;
  if (state.hasTracker) out.hasTracker = true;
  if (state.platforms.length) out.platform = state.platforms;
  if (state.risks.length) out.riskLevel = state.risks;

  if (state.lanes.length) {
    const kinds = new Set<string>();
    for (const lane of state.lanes) {
      for (const kind of LANE_TO_IMPACT_KINDS[lane] ?? []) kinds.add(kind);
    }
    if (kinds.size > 0) out.impactKind = Array.from(kinds);
  }

  let pkgs = state.packages;
  if (state.manifestOnly && manifestPackages.length > 0) {
    pkgs = pkgs.length === 0
      ? Array.from(manifestPackages)
      : pkgs.filter((p) => manifestPackages.includes(p));
    // If the intersection is empty, the user asked for packages they don't
    // have in their manifest — fall back to manifest only so the result set
    // doesn't accidentally include everything.
    if (pkgs.length === 0) pkgs = Array.from(manifestPackages);
  }
  if (pkgs.length) out.packageName = pkgs;

  return out;
}

// ─── persona-preset cookie ───────────────────────────────────────────────

export const PERSONA_COOKIE_PREFIX = "unity-alerts-filter-preset-";

/** View-scoped cookie name for the persona preset. */
export function personaCookieName(view: "compare" | "release"): string {
  return `${PERSONA_COOKIE_PREFIX}${view}`;
}

/** Validate a raw cookie value against the known preset list. */
export function parsePersonaCookie(raw: string | undefined | null): PersonaPreset | null {
  if (!raw) return null;
  return (PERSONA_PRESETS as readonly string[]).includes(raw)
    ? (raw as PersonaPreset)
    : null;
}

/** Convenience: every known lane id, in catalog order. Re-exported so the
 *  drawer doesn't import lane-catalog directly. */
export const ALL_LANE_IDS: readonly LaneId[] = LANE_IDS;
