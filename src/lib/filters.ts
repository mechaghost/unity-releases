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

export const PIPELINES = ["urp", "hdrp", "birp", "agnostic"] as const;
export type PipelineId = (typeof PIPELINES)[number];
export const PIPELINE_LABELS: Record<PipelineId, string> = {
  urp: "URP",
  hdrp: "HDRP",
  birp: "Built-in RP",
  agnostic: "Pipeline-agnostic"
};

export const PERSONA_PRESETS = ["director", "balanced", "indie"] as const;
export type PersonaPreset = (typeof PERSONA_PRESETS)[number];

export const DEFAULT_PERSONA: PersonaPreset = "balanced";

export const EDITOR_SCOPES = ["any", "editor", "runtime"] as const;
export type EditorScope = (typeof EDITOR_SCOPES)[number];
export const EDITOR_SCOPE_LABELS: Record<EditorScope, string> = {
  any: "Both",
  editor: "Editor only",
  runtime: "Runtime only"
};

export type FilterState = {
  q: string;
  lanes: LaneId[];
  risks: RiskLevel[];
  platforms: string[];
  packages: string[];
  areas: string[];
  pipelines: PipelineId[];
  issueId: string;
  manifestOnly: boolean;
  hasTracker: boolean;
  hideNoise: boolean;
  editorScope: EditorScope;
  /** Sub-range narrowing inside `/compare`. Both values must match
   *  versions that exist in the resolved range; otherwise they're ignored. */
  subFromVersion: string;
  subToVersion: string;
  /** Show only issues introduced in the current range, not carried-forward
   *  from earlier releases. Page resolves the boundary date. */
  regressionsOnly: boolean;
  preset: PersonaPreset;
};

export const EMPTY_FILTERS: FilterState = {
  q: "",
  lanes: [],
  risks: [],
  platforms: [],
  packages: [],
  areas: [],
  pipelines: [],
  issueId: "",
  manifestOnly: false,
  hasTracker: false,
  hideNoise: false,
  editorScope: "any",
  subFromVersion: "",
  subToVersion: "",
  regressionsOnly: false,
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
  const areas = parseList(params.get("areas"));
  const pipelines = parseList(params.get("pipelines"))
    .filter((id): id is PipelineId => (PIPELINES as readonly string[]).includes(id));

  const scopeRaw = params.get("scope") ?? "any";
  const editorScope = (EDITOR_SCOPES as readonly string[]).includes(scopeRaw)
    ? (scopeRaw as EditorScope)
    : "any";

  return {
    q: (params.get("q") ?? "").trim(),
    lanes,
    risks,
    platforms,
    packages,
    areas,
    pipelines,
    issueId: (params.get("issue") ?? "").trim().toUpperCase(),
    manifestOnly: params.get("manifest") === "1",
    hasTracker: params.get("tracker") === "1",
    hideNoise: params.get("hide_noise") === "1",
    editorScope,
    subFromVersion: (params.get("sub_from") ?? "").trim(),
    subToVersion: (params.get("sub_to") ?? "").trim(),
    regressionsOnly: params.get("regressions") === "1",
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
  if (state.areas.length) into.set("areas", state.areas.join(","));
  if (state.pipelines.length) into.set("pipelines", state.pipelines.join(","));
  if (state.issueId) into.set("issue", state.issueId);
  if (state.manifestOnly) into.set("manifest", "1");
  if (state.hasTracker) into.set("tracker", "1");
  if (state.hideNoise) into.set("hide_noise", "1");
  if (state.editorScope && state.editorScope !== "any") into.set("scope", state.editorScope);
  if (state.subFromVersion) into.set("sub_from", state.subFromVersion);
  if (state.subToVersion) into.set("sub_to", state.subToVersion);
  if (state.regressionsOnly) into.set("regressions", "1");
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
    state.areas.length > 0 ||
    state.pipelines.length > 0 ||
    state.issueId !== "" ||
    state.manifestOnly ||
    state.hasTracker ||
    state.hideNoise ||
    state.editorScope !== "any" ||
    state.subFromVersion !== "" ||
    state.subToVersion !== "" ||
    state.regressionsOnly
  );
}

/** Count of filter chips to display on the Filter button badge. */
export function activeFilterCount(state: FilterState): number {
  let n = 0;
  if (state.q) n += 1;
  if (state.issueId) n += 1;
  if (state.manifestOnly) n += 1;
  if (state.hasTracker) n += 1;
  if (state.hideNoise) n += 1;
  if (state.editorScope !== "any") n += 1;
  if (state.subFromVersion || state.subToVersion) n += 1;
  if (state.regressionsOnly) n += 1;
  n += state.lanes.length;
  n += state.risks.length;
  n += state.platforms.length;
  n += state.packages.length;
  n += state.areas.length;
  n += state.pipelines.length;
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
  manifestPackages: readonly string[] = [],
  /** Page-supplied boundary for the regressions-only filter — earliest
   *  release_date in the visible scope. The toggle does nothing without it. */
  regressionsBoundary?: string | Date | null
): Pick<
  ReleaseNoteSearchFilters,
  | "q"
  | "impactKind"
  | "riskLevel"
  | "platform"
  | "packageName"
  | "issueId"
  | "hasTracker"
  | "area"
  | "pipelines"
  | "hideNoise"
  | "editorScope"
  | "regressionsBefore"
> {
  const out: Pick<
    ReleaseNoteSearchFilters,
    | "q"
    | "impactKind"
    | "riskLevel"
    | "platform"
    | "packageName"
    | "issueId"
    | "hasTracker"
    | "area"
    | "pipelines"
    | "hideNoise"
    | "editorScope"
    | "regressionsBefore"
  > = {};

  if (state.q) out.q = state.q;
  if (state.issueId) out.issueId = state.issueId;
  if (state.hasTracker) out.hasTracker = true;
  if (state.hideNoise) out.hideNoise = true;
  if (state.editorScope === "editor" || state.editorScope === "runtime") {
    out.editorScope = state.editorScope;
  }
  if (state.regressionsOnly && regressionsBoundary) {
    const iso =
      typeof regressionsBoundary === "string"
        ? regressionsBoundary
        : regressionsBoundary.toISOString();
    out.regressionsBefore = iso;
  }
  if (state.platforms.length) out.platform = state.platforms;
  if (state.risks.length) out.riskLevel = state.risks;
  if (state.areas.length) out.area = state.areas;
  if (state.pipelines.length) out.pipelines = state.pipelines;

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

export const PERSONA_COOKIE_PREFIX = "unity-releases-filter-preset-";

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

// ─── saved presets cookie ────────────────────────────────────────────────

export const SAVED_PRESETS_COOKIE_PREFIX = "unity-releases-filter-saved-";
export const MAX_SAVED_PRESETS = 10;
export const MAX_PRESET_NAME_LENGTH = 40;

/** A user-named filter combo. The state is stored as the same URL-encoded
 *  query string the page already uses, so apply = parse with
 *  `parseFiltersFromParams`. Keeps the cookie small. */
export type SavedPreset = {
  name: string;
  qs: string;
};

export function savedPresetsCookieName(view: "compare" | "release"): string {
  return `${SAVED_PRESETS_COOKIE_PREFIX}${view}`;
}

/** Tolerant parser: bad cookies return []. The cookies API decodes the
 *  cookie value once on read, so we only need JSON.parse here. */
export function parseSavedPresetsCookie(raw: string | undefined | null): SavedPreset[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (p): p is SavedPreset =>
          p &&
          typeof p.name === "string" &&
          typeof p.qs === "string" &&
          p.name.length > 0 &&
          p.name.length <= MAX_PRESET_NAME_LENGTH
      )
      .slice(0, MAX_SAVED_PRESETS);
  } catch {
    return [];
  }
}

/** Inverse: a JSON blob. Cookie API handles URL-encoding on set. */
export function serializeSavedPresetsCookie(presets: SavedPreset[]): string {
  const trimmed = presets.slice(0, MAX_SAVED_PRESETS).map((p) => ({
    name: p.name.slice(0, MAX_PRESET_NAME_LENGTH),
    qs: p.qs
  }));
  return JSON.stringify(trimmed);
}

/** Apply a saved preset on the page: parse its `qs` back into FilterState.
 *  Defaults that aren't in the qs come from EMPTY_FILTERS. */
export function savedPresetToState(preset: SavedPreset): FilterState {
  const params = new URLSearchParams(preset.qs);
  return parseFiltersFromParams(params);
}

/** Build a SavedPreset from the current FilterState — strips the preset
 *  field (saved presets are persona-agnostic) and re-uses the standard
 *  serializer so the qs round-trips cleanly. */
export function stateToSavedPreset(name: string, state: FilterState): SavedPreset {
  const params = new URLSearchParams();
  serializeFiltersToParams({ ...state, preset: DEFAULT_PERSONA }, params);
  return { name: name.slice(0, MAX_PRESET_NAME_LENGTH), qs: params.toString() };
}

/** Convenience: every known lane id, in catalog order. Re-exported so the
 *  drawer doesn't import lane-catalog directly. */
export const ALL_LANE_IDS: readonly LaneId[] = LANE_IDS;
