/**
 * Build-score math. Pure functions; no DB access; Edge-safe.
 *
 * The score is intentionally derivable from a finite set of inputs that
 * any senior engineer can reproduce on a napkin. Every number printed
 * on the page traces back to this file.
 *
 * Methodology summary
 * -------------------
 * For each sub-metric we:
 *   1. Compute the raw value for the release
 *   2. Winsorize at the cohort p95 (cohort = same stream)
 *   3. Apply log1p to compress remaining skew
 *   4. Convert to a percentile rank within the cohort
 *   5. Flip the percentile if the metric is "lower is better"
 *
 * The composite is a weighted arithmetic mean of the six sub-scores.
 * NO blocker cap — Unity's blocker labelling is too inconsistent to use
 * a categorical override; the blocker_rate sub-score already costs 15%.
 *
 * Sparse releases (notes < 20) blend toward the cohort median in
 * proportion to data volume; releases with notes < 5 return null and
 * the UI shows "insufficient data" instead of a score.
 */

export type ScoreStream = "LTS" | "STABLE" | "TECH" | "BETA" | "ALPHA";

/** Input shape — one row per release. */
export type ScoreInput = {
  version: string;
  stream: string;
  minorLine: string;
  releaseDate: string | null;
  notes: number;
  fixes: number;
  knownIssues: number;
  breaking: number;
  apiChanges: number;
  blockers: number;
  mobileBlockers: number;
  /** Net fix on the immediately-prior release on the same minor_line.
   *  Null for the first release on a line. */
  priorNetFix: number | null;
};

export type SubScoreId =
  | "breakingSurface"
  | "blockerRate"
  | "mobileRate"
  | "fixDensity"
  | "netFixDelta"
  | "knownIssueRate";

export type SubScoreGroup = "upgradeRisk" | "netCleanup" | "liveDebt";

export type SubScoreDefinition = {
  id: SubScoreId;
  label: string;
  /** Group the segment belongs to on the stacked bar. */
  group: SubScoreGroup;
  /** Weight in the composite (sums to 1.0 across all sub-scores). */
  weight: number;
  /** true = higher raw value is better; false = higher raw value is worse. */
  higherIsBetter: boolean;
  /** Plain-English single-sentence definition shown on hover. */
  hint: string;
  /** Algebraic formula shown in the expander. */
  formula: string;
};

/**
 * Canonical sub-score definitions. The weights here are LOAD-BEARING:
 * change them and the page recomputes. Document any change in the
 * release-notes for this site.
 *
 * Three groups, summing to 1.0:
 *   - upgradeRisk  = 50% (breaking + blockers + mobile)
 *   - netCleanup   = 30% (fix density + net-fix delta vs prior patch)
 *   - liveDebt     = 20% (known-issue density that users live with)
 */
export const SUB_SCORES: SubScoreDefinition[] = [
  {
    id: "breakingSurface",
    label: "Breaking surface",
    group: "upgradeRisk",
    weight: 0.25,
    higherIsBetter: false,
    hint: "Share of notes that introduce a breaking change or remove/rename an API.",
    formula: "(breaking_change + api_change) / total_notes"
  },
  {
    id: "blockerRate",
    label: "Blocker rate",
    group: "upgradeRisk",
    weight: 0.15,
    higherIsBetter: false,
    hint: "Share of notes Unity itself flagged as blocker-risk known issues.",
    formula: "blockers / total_notes"
  },
  {
    id: "mobileRate",
    label: "Mobile risk",
    group: "upgradeRisk",
    weight: 0.10,
    higherIsBetter: false,
    hint: "Share of notes flagging known issues on Android or iOS.",
    formula: "mobile_known_issues / total_notes"
  },
  {
    id: "fixDensity",
    label: "Fix density",
    group: "netCleanup",
    weight: 0.15,
    higherIsBetter: true,
    hint: "Share of notes that close out a fix.",
    formula: "fixes / total_notes"
  },
  {
    id: "netFixDelta",
    label: "Net-fix delta",
    group: "netCleanup",
    weight: 0.15,
    higherIsBetter: true,
    hint:
      "Improvement in (fixes − known_issues) versus the immediately-prior patch on the same minor line.",
    formula: "((fixes − known_issues) − prior.(fixes − known_issues)) / total_notes"
  },
  {
    id: "knownIssueRate",
    label: "Known-issue debt",
    group: "liveDebt",
    weight: 0.20,
    higherIsBetter: false,
    hint: "Share of notes listing known issues users will live with after upgrading.",
    formula: "known_issues / total_notes"
  }
];

export const GROUP_LABELS: Record<SubScoreGroup, string> = {
  upgradeRisk: "Upgrade risk",
  netCleanup: "Net cleanup",
  liveDebt: "Live debt"
};

/** Stream cohort the score is computed against. Falls back to all-rows
 *  if the stream has too few peers (we still want a number, just less
 *  cohort-specific). */
const MIN_COHORT_SIZE = 8;
/** Below this note-count we blend toward the cohort median. */
const MIN_FULL_CONFIDENCE_NOTES = 20;
/** Below this note-count the score is too noisy to show at all. */
const MIN_SCORABLE_NOTES = 5;

export type SubScoreResult = {
  id: SubScoreId;
  label: string;
  group: SubScoreGroup;
  weight: number;
  /** Raw value (e.g. 0.0211 for 3 breaking out of 142 notes).
   *  NaN when the metric had no input (e.g. netFixDelta on first patch). */
  raw: number;
  /** Raw value after winsorization (capped at cohort p95). */
  clipped: number;
  /** Percentile rank within cohort, 0–100. Higher = "better position in cohort". */
  percentile: number;
  /** 0–100 sub-score after direction flip + confidence blend. */
  score: number;
  /** Weighted contribution to the composite (score * weight). */
  contribution: number;
  /** True if winsorization actually clipped (signals an extreme release). */
  wasClipped: boolean;
};

export type ScoreResult = {
  version: string;
  /** The composite 0–100 score. null = insufficient data. */
  composite: number | null;
  /** Per-sub-score breakdown. Always populated when composite is non-null. */
  sub: SubScoreResult[];
  /** Cohort the score was computed against (stream or "ALL" fallback). */
  cohort: string;
  /** Cohort size at scoring time. */
  cohortSize: number;
  /** notes / MIN_FULL_CONFIDENCE_NOTES, clamped to [0, 1]. */
  confidence: number;
  /** True if the release is below MIN_SCORABLE_NOTES (no score returned). */
  insufficient: boolean;
};

export type CohortStats = {
  // For each metric, the cohort p95 and the sorted log-transformed values
  // we use for percentile-rank lookups.
  perMetric: Record<SubScoreId, { p95: number; sortedLog: number[] }>;
  /** Median per sub-score, for confidence-weighted blend on sparse releases. */
  medianSubScore: Record<SubScoreId, number>;
  size: number;
};

function rawMetricValue(id: SubScoreId, input: ScoreInput): number | null {
  const n = input.notes;
  if (n <= 0) return null;
  switch (id) {
    case "breakingSurface":
      return (input.breaking + input.apiChanges) / n;
    case "blockerRate":
      return input.blockers / n;
    case "mobileRate":
      return input.mobileBlockers / n;
    case "fixDensity":
      return input.fixes / n;
    case "netFixDelta": {
      if (input.priorNetFix == null) return null;
      const cur = input.fixes - input.knownIssues;
      // Per-note delta so a large patch doesn't dominate by sheer size.
      return (cur - input.priorNetFix) / n;
    }
    case "knownIssueRate":
      return input.knownIssues / n;
  }
}

function percentile(sortedValues: number[], value: number): number {
  // Returns the percentile rank of `value` within `sortedValues`.
  // Uses the average of strict-less + less-or-equal counts so ties land
  // mid-rank rather than at the floor (matches scipy.stats.percentileofscore
  // with kind='mean').
  if (sortedValues.length === 0) return 50;
  let lt = 0;
  let le = 0;
  for (const v of sortedValues) {
    if (v < value) lt += 1;
    if (v <= value) le += 1;
  }
  const mid = (lt + le) / 2;
  return (mid / sortedValues.length) * 100;
}

function quantile(sortedValues: number[], q: number): number {
  if (sortedValues.length === 0) return 0;
  const idx = (sortedValues.length - 1) * q;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedValues[lo];
  const w = idx - lo;
  return sortedValues[lo] * (1 - w) + sortedValues[hi] * w;
}

/** Pre-compute cohort statistics so each release scores in O(metrics).
 *  Called once per render with the full population. */
export function buildCohortStats(population: ScoreInput[]): CohortStats {
  const perMetric = {} as CohortStats["perMetric"];
  const medianSubScore = {} as CohortStats["medianSubScore"];

  for (const sub of SUB_SCORES) {
    const raws: number[] = [];
    for (const row of population) {
      const v = rawMetricValue(sub.id, row);
      if (v != null && Number.isFinite(v)) raws.push(v);
    }
    const sortedRaws = [...raws].sort((a, b) => a - b);
    const p95 = quantile(sortedRaws, 0.95);

    // log1p of winsorized values is what we percentile-rank against.
    const sortedLog = sortedRaws
      .map((v) => Math.log1p(Math.min(v, p95)))
      .sort((a, b) => a - b);

    perMetric[sub.id] = { p95, sortedLog };

    // Median sub-score = score the population MEDIAN raw value would
    // receive, used to blend sparse releases toward the middle.
    const med = quantile(sortedRaws, 0.5);
    const medLog = Math.log1p(Math.min(med, p95));
    const pct = percentile(sortedLog, medLog);
    medianSubScore[sub.id] = sub.higherIsBetter ? pct : 100 - pct;
  }

  return { perMetric, medianSubScore, size: population.length };
}

/**
 * Score a single release against pre-computed cohort stats.
 *
 * Pre-condition: `population` already filtered to the cohort
 * (typically same `stream`). If the cohort is too small the caller
 * should fall back to a wider cohort.
 */
export function scoreRelease(
  input: ScoreInput,
  cohortStats: CohortStats,
  cohort: string
): ScoreResult {
  if (input.notes < MIN_SCORABLE_NOTES) {
    return {
      version: input.version,
      composite: null,
      sub: [],
      cohort,
      cohortSize: cohortStats.size,
      confidence: 0,
      insufficient: true
    };
  }

  const confidence = Math.min(1, input.notes / MIN_FULL_CONFIDENCE_NOTES);
  const subResults: SubScoreResult[] = [];
  let composite = 0;

  for (const sub of SUB_SCORES) {
    const raw = rawMetricValue(sub.id, input);
    const { p95, sortedLog } = cohortStats.perMetric[sub.id];
    let scoreValue: number;
    let rawDisplay = raw ?? NaN;
    let clipped = 0;
    let pct = 50;
    let wasClipped = false;

    if (raw == null) {
      // First-release-on-line case for netFixDelta: substitute the
      // cohort median so the composite stays computable. Visible to the
      // user via the "no prior patch" formula note.
      scoreValue = cohortStats.medianSubScore[sub.id];
      rawDisplay = NaN;
    } else {
      const cap = Math.min(raw, p95);
      wasClipped = raw > p95 + 1e-12;
      clipped = cap;
      const logged = Math.log1p(cap);
      pct = percentile(sortedLog, logged);
      const rawScore = sub.higherIsBetter ? pct : 100 - pct;
      // Confidence blend toward median when notes < MIN_FULL_CONFIDENCE_NOTES.
      const median = cohortStats.medianSubScore[sub.id];
      scoreValue = confidence * rawScore + (1 - confidence) * median;
    }

    const contribution = scoreValue * sub.weight;
    composite += contribution;
    subResults.push({
      id: sub.id,
      label: sub.label,
      group: sub.group,
      weight: sub.weight,
      raw: rawDisplay,
      clipped,
      percentile: pct,
      score: scoreValue,
      contribution,
      wasClipped
    });
  }

  return {
    version: input.version,
    composite: Math.round(composite),
    sub: subResults,
    cohort,
    cohortSize: cohortStats.size,
    confidence,
    insufficient: false
  };
}

/**
 * Score every release in the population, using stream-cohort baselines
 * with a fallback to the global population when a stream is too small.
 *
 * Returns a map keyed by version for O(1) lookup from page components.
 */
export function scoreAllReleases(
  population: ScoreInput[]
): {
  results: Map<string, ScoreResult>;
  cohorts: Record<string, number>;
  /** The cohort stats computed against the *entire* population, exposed
   *  so callers that also need to score a one-off "virtual release"
   *  (e.g. a diff aggregate on /compare) can reuse them instead of
   *  triggering a duplicate buildCohortStats call. */
  globalStats: CohortStats;
} {
  // Bucket by stream.
  const byStream = new Map<string, ScoreInput[]>();
  for (const row of population) {
    const list = byStream.get(row.stream) ?? [];
    list.push(row);
    byStream.set(row.stream, list);
  }

  // Compute global stats once for the fallback path AND for caller reuse.
  const globalStats = buildCohortStats(population);

  const streamStats = new Map<string, CohortStats>();
  for (const [stream, rows] of byStream) {
    if (rows.length >= MIN_COHORT_SIZE) {
      streamStats.set(stream, buildCohortStats(rows));
    }
  }

  const results = new Map<string, ScoreResult>();
  const cohorts: Record<string, number> = { ALL: population.length };
  for (const row of population) {
    const stats = streamStats.get(row.stream);
    if (stats) {
      results.set(row.version, scoreRelease(row, stats, row.stream));
      cohorts[row.stream] = stats.size;
    } else {
      results.set(row.version, scoreRelease(row, globalStats, "ALL"));
    }
  }
  return { results, cohorts, globalStats };
}

/** Exported for test-side use of the sparse-data threshold; the other
 *  two constants are module-private. */
export const SCORE_CONSTANTS = {
  MIN_SCORABLE_NOTES
};

/**
 * Build a virtual-release `ScoreInput` representing a diff window for
 * upgrade-score scoring on `/compare`.
 *
 * Methodology (matches the user-approved design):
 *   - Aggregate counts (fixes, known, breaking, …) are SUMMED across
 *     every release in `versions` so the rate sub-scores stay
 *     scale-invariant (rates are per-note, percentile-rank identically
 *     against single-release cohorts).
 *   - `netFixDelta` is reinterpreted as the bookend delta:
 *       (to.netFix − from.netFix) / total_notes_in_window
 *     We embed this into the existing algorithm via algebra on
 *     `priorNetFix`. The scorer computes
 *       (input.fixes − input.knownIssues − priorNetFix) / input.notes
 *     so setting
 *       priorNetFix = aggregate.netFix − to.netFix + from.netFix
 *     yields exactly the bookend delta when the formula expands.
 *   - If `from` or `to` is missing from the population (e.g. a version
 *     we haven't ingested yet), `priorNetFix` falls back to null and the
 *     algorithm substitutes the cohort median — same fallback behavior
 *     as a first-on-line single release.
 *
 * Caller should score this against the global ALL cohort (not a stream
 * cohort) — diffs may cross streams and there is no organic peer set of
 * past diffs to score against.
 */
export function aggregateDiffScoreInput(
  population: ScoreInput[],
  versions: string[],
  fromVersion: string,
  toVersion: string
): ScoreInput {
  const byVersion = new Map<string, ScoreInput>();
  for (const row of population) byVersion.set(row.version, row);

  let fixes = 0;
  let knownIssues = 0;
  let breaking = 0;
  let apiChanges = 0;
  let blockers = 0;
  let mobileBlockers = 0;
  let notes = 0;
  for (const v of versions) {
    const row = byVersion.get(v);
    if (!row) continue;
    fixes += row.fixes;
    knownIssues += row.knownIssues;
    breaking += row.breaking;
    apiChanges += row.apiChanges;
    blockers += row.blockers;
    mobileBlockers += row.mobileBlockers;
    notes += row.notes;
  }

  const from = byVersion.get(fromVersion);
  const to = byVersion.get(toVersion);
  // Algebraic bookend trick: see docstring above.
  const priorNetFix =
    from && to
      ? fixes - knownIssues - ((to.fixes - to.knownIssues) - (from.fixes - from.knownIssues))
      : null;

  // Resolve the bookend dates for the virtual release. Use `to`'s date
  // as the "release date" of the diff so any future ageing logic gets
  // the right anchor.
  const releaseDate = to?.releaseDate ?? null;

  return {
    version: `${fromVersion} → ${toVersion}`,
    stream: "ALL",
    minorLine: from?.minorLine ?? "",
    releaseDate,
    notes,
    fixes,
    knownIssues,
    breaking,
    apiChanges,
    blockers,
    mobileBlockers,
    priorNetFix
  };
}
