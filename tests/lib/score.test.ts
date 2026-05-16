import { describe, expect, test } from "vitest";
import {
  aggregateDiffScoreInput,
  buildCohortStats,
  scoreAllReleases,
  scoreRelease,
  SUB_SCORES,
  SCORE_CONSTANTS,
  type ScoreInput
} from "../../src/lib/score";

/**
 * Helper: build a population with explicit per-release inputs. Defaults
 * land near the median for fields the test doesn't care about, so
 * sub-scores stay neutral unless explicitly set.
 */
function input(overrides: Partial<ScoreInput>): ScoreInput {
  return {
    version: "0.0.0",
    stream: "LTS",
    minorLine: "6000.0",
    releaseDate: "2026-01-01",
    notes: 100,
    fixes: 50,
    knownIssues: 10,
    breaking: 2,
    apiChanges: 3,
    blockers: 0,
    mobileBlockers: 1,
    priorNetFix: 30,
    ...overrides
  };
}

/** Build a baseline cohort of N similar releases so a focal release has
 *  a population to be scored against. */
function makeCohort(n: number, base: Partial<ScoreInput> = {}): ScoreInput[] {
  const rows: ScoreInput[] = [];
  const stream = base.stream ?? "LTS";
  for (let i = 0; i < n; i++) {
    // Namespace the version by stream so combining two cohorts in a
    // test doesn't collide on identical version strings.
    rows.push(input({ ...base, version: `${stream}-6000.0.${i}f1` }));
  }
  return rows;
}

describe("SUB_SCORES weight invariant", () => {
  test("weights sum to 1.0 — composite must hit a true 0-100 ceiling", () => {
    const sum = SUB_SCORES.reduce((acc, s) => acc + s.weight, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  test("every sub-score belongs to one of the three groups", () => {
    const valid = new Set(["upgradeRisk", "netCleanup", "liveDebt"]);
    for (const s of SUB_SCORES) {
      expect(valid.has(s.group)).toBe(true);
    }
  });

  test("group weights match the design (50/30/20 split)", () => {
    const totals = { upgradeRisk: 0, netCleanup: 0, liveDebt: 0 } as Record<string, number>;
    for (const s of SUB_SCORES) totals[s.group] += s.weight;
    expect(totals.upgradeRisk).toBeCloseTo(0.5, 5);
    expect(totals.netCleanup).toBeCloseTo(0.3, 5);
    expect(totals.liveDebt).toBeCloseTo(0.2, 5);
  });
});

describe("sparse releases", () => {
  test("releases with notes < MIN_SCORABLE return null composite", () => {
    const cohort = makeCohort(20);
    const stats = buildCohortStats(cohort);
    const focal = input({ version: "test", notes: SCORE_CONSTANTS.MIN_SCORABLE_NOTES - 1, fixes: 1, knownIssues: 0 });
    const result = scoreRelease(focal, stats, "LTS");
    expect(result.composite).toBeNull();
    expect(result.insufficient).toBe(true);
    expect(result.sub).toHaveLength(0);
  });

  test("releases between MIN_SCORABLE and MIN_FULL get a confidence-blended score", () => {
    const cohort = makeCohort(40);
    const stats = buildCohortStats(cohort);
    const focal = input({
      version: "sparse",
      notes: 10,
      fixes: 10,
      knownIssues: 0,
      breaking: 0,
      apiChanges: 0,
      blockers: 0,
      mobileBlockers: 0
    });
    const result = scoreRelease(focal, stats, "LTS");
    expect(result.composite).not.toBeNull();
    // Confidence reflects notes / MIN_FULL_CONFIDENCE_NOTES (10 / 20 = 0.5)
    expect(result.confidence).toBeCloseTo(0.5, 5);
    // Score should be pulled toward the cohort median, not at the
    // theoretical max despite all metrics being "perfect" raw.
    expect(result.composite).toBeLessThan(80);
  });
});

describe("normalization properties", () => {
  test("a release at the cohort median gets ~50 on each sub-score", () => {
    const cohort = makeCohort(50);
    const stats = buildCohortStats(cohort);
    const median = input({ version: "median" });
    const r = scoreRelease(median, stats, "LTS");
    for (const s of r.sub) {
      // Allow some wiggle from log1p curvature — but every sub-score
      // should be close-ish to 50 for a perfectly-average release.
      expect(s.score).toBeGreaterThan(35);
      expect(s.score).toBeLessThan(65);
    }
  });

  test("higher fixes → higher fix-density sub-score", () => {
    const cohort = makeCohort(50);
    const stats = buildCohortStats(cohort);
    const high = scoreRelease(input({ version: "high", fixes: 90, knownIssues: 0 }), stats, "LTS");
    const low = scoreRelease(input({ version: "low", fixes: 10, knownIssues: 0 }), stats, "LTS");
    const highFix = high.sub.find((s) => s.id === "fixDensity")!;
    const lowFix = low.sub.find((s) => s.id === "fixDensity")!;
    expect(highFix.score).toBeGreaterThan(lowFix.score);
  });

  test("more breaking changes → lower breaking-surface sub-score", () => {
    const cohort = makeCohort(50);
    const stats = buildCohortStats(cohort);
    const heavy = scoreRelease(input({ version: "heavy", breaking: 40, apiChanges: 20 }), stats, "LTS");
    const light = scoreRelease(input({ version: "light", breaking: 0, apiChanges: 0 }), stats, "LTS");
    const heavyB = heavy.sub.find((s) => s.id === "breakingSurface")!;
    const lightB = light.sub.find((s) => s.id === "breakingSurface")!;
    expect(lightB.score).toBeGreaterThan(heavyB.score);
  });

  test("outliers are winsorized at p95 — wasClipped flag fires", () => {
    // Population has known_issues uniformly between 0 and 20.
    const cohort: ScoreInput[] = [];
    for (let i = 0; i < 50; i++) {
      cohort.push(input({ version: `b${i}`, knownIssues: i % 21 }));
    }
    const stats = buildCohortStats(cohort);
    // Wildly out-of-population release with 2000 known-issues on 2000 notes.
    const outlier = scoreRelease(
      input({ version: "outlier", notes: 2000, knownIssues: 2000, fixes: 0 }),
      stats,
      "LTS"
    );
    const kir = outlier.sub.find((s) => s.id === "knownIssueRate")!;
    expect(kir.wasClipped).toBe(true);
    // Despite the extreme value, the score should be a real number,
    // not -200 or similar. Winsorization caps the effect.
    expect(kir.score).toBeGreaterThanOrEqual(0);
    expect(kir.score).toBeLessThanOrEqual(100);
  });
});

describe("netFixDelta missing-prior-patch handling", () => {
  test("first release on a minor_line substitutes cohort median for the delta sub-score", () => {
    const cohort = makeCohort(40);
    const stats = buildCohortStats(cohort);
    const firstOnLine = scoreRelease(
      input({ version: "first", priorNetFix: null }),
      stats,
      "LTS"
    );
    const delta = firstOnLine.sub.find((s) => s.id === "netFixDelta")!;
    // Raw must be NaN (no prior); score must still land in [0, 100].
    expect(Number.isNaN(delta.raw)).toBe(true);
    expect(delta.score).toBeGreaterThan(30);
    expect(delta.score).toBeLessThan(70);
  });
});

describe("scoreAllReleases", () => {
  test("scores every release in the population", () => {
    const pop = [
      ...makeCohort(20, { stream: "LTS" }),
      ...makeCohort(20, { stream: "BETA" })
    ];
    const { results, cohorts } = scoreAllReleases(pop);
    expect(results.size).toBe(40);
    expect(cohorts.LTS).toBe(20);
    expect(cohorts.BETA).toBe(20);
  });

  test("small stream falls back to ALL cohort", () => {
    const pop = [
      ...makeCohort(20, { stream: "LTS" }),
      input({ version: "single-alpha", stream: "ALPHA" })
    ];
    const { results } = scoreAllReleases(pop);
    const lone = results.get("single-alpha")!;
    // ALPHA had only 1 row (< MIN_COHORT_SIZE), so it scores against the
    // global population.
    expect(lone.cohort).toBe("ALL");
  });
});

describe("composite math sanity", () => {
  test("composite equals sum of weighted sub-scores within rounding", () => {
    const cohort = makeCohort(30);
    const stats = buildCohortStats(cohort);
    const r = scoreRelease(input({ version: "audit" }), stats, "LTS");
    const sum = r.sub.reduce((acc, s) => acc + s.score * s.weight, 0);
    // Composite is rounded; allow ±1.
    expect(Math.abs(r.composite! - Math.round(sum))).toBeLessThanOrEqual(1);
  });

  test("composite stays in [0, 100] across extreme inputs", () => {
    const cohort = makeCohort(30);
    const stats = buildCohortStats(cohort);
    const cases = [
      input({ version: "best", fixes: 1000, knownIssues: 0, breaking: 0, apiChanges: 0, blockers: 0, mobileBlockers: 0, priorNetFix: -1000, notes: 1000 }),
      input({ version: "worst", fixes: 0, knownIssues: 1000, breaking: 200, apiChanges: 100, blockers: 50, mobileBlockers: 50, priorNetFix: 1000, notes: 1000 })
    ];
    for (const c of cases) {
      const r = scoreRelease(c, stats, "LTS");
      expect(r.composite).toBeGreaterThanOrEqual(0);
      expect(r.composite).toBeLessThanOrEqual(100);
    }
  });
});

describe("aggregateDiffScoreInput — diff/upgrade scoring", () => {
  test("sums every metric across the window for rate sub-scores", () => {
    const population: ScoreInput[] = [
      input({ version: "from", fixes: 10, knownIssues: 2, breaking: 1, apiChanges: 1, blockers: 0, mobileBlockers: 0, notes: 20, priorNetFix: 5 }),
      input({ version: "a",    fixes: 30, knownIssues: 5, breaking: 2, apiChanges: 3, blockers: 1, mobileBlockers: 1, notes: 50, priorNetFix: 8 }),
      input({ version: "b",    fixes: 40, knownIssues: 7, breaking: 0, apiChanges: 1, blockers: 0, mobileBlockers: 2, notes: 60, priorNetFix: 25 }),
      input({ version: "to",   fixes: 50, knownIssues: 8, breaking: 1, apiChanges: 1, blockers: 1, mobileBlockers: 0, notes: 70, priorNetFix: 33 })
    ];
    const diff = aggregateDiffScoreInput(population, ["a", "b", "to"], "from", "to");

    // Aggregate excludes `from` (window is exclusive at the start).
    expect(diff.fixes).toBe(120);
    expect(diff.knownIssues).toBe(20);
    expect(diff.breaking).toBe(3);
    expect(diff.apiChanges).toBe(5);
    expect(diff.blockers).toBe(2);
    expect(diff.mobileBlockers).toBe(3);
    expect(diff.notes).toBe(180);
  });

  test("bookend trick: scorer's netFixDelta formula expands to (to.netFix − from.netFix) / notes", () => {
    const population: ScoreInput[] = [
      input({ version: "from", fixes: 10, knownIssues: 2, notes: 20 }),
      input({ version: "a",    fixes: 30, knownIssues: 5, notes: 50 }),
      input({ version: "to",   fixes: 50, knownIssues: 8, notes: 70 })
    ];
    const diff = aggregateDiffScoreInput(population, ["a", "to"], "from", "to");

    // Scorer's metric formula is (fixes − knownIssues − priorNetFix) / notes.
    // We want this to equal (to.netFix − from.netFix) / notes.
    // to.netFix = 50 − 8 = 42; from.netFix = 10 − 2 = 8. Delta = 34.
    // diff.notes = 50 + 70 = 120. Target metric value = 34 / 120 ≈ 0.2833.
    const computed = (diff.fixes - diff.knownIssues - diff.priorNetFix!) / diff.notes;
    expect(computed).toBeCloseTo(34 / 120, 9);
  });

  test("returns null priorNetFix (so scorer uses cohort median) when either bookend is missing", () => {
    const population: ScoreInput[] = [
      input({ version: "to", fixes: 50, knownIssues: 8 })
    ];
    // `from` isn't in the population — e.g. an un-ingested anchor.
    const diff = aggregateDiffScoreInput(population, ["to"], "ghost-from", "to");
    expect(diff.priorNetFix).toBeNull();
  });

  test("the diff scores against an ALL cohort yield a real composite in [0, 100]", () => {
    // 30-release synthetic population so cohort math has substance.
    const population: ScoreInput[] = [];
    for (let i = 0; i < 30; i++) {
      population.push(input({ version: `v${i}`, fixes: 40 + i, knownIssues: 5 + (i % 7), notes: 100 + i }));
    }
    const diff = aggregateDiffScoreInput(
      population,
      population.slice(5, 15).map((p) => p.version),
      population[4].version,
      population[14].version
    );
    const stats = buildCohortStats(population);
    const result = scoreRelease(diff, stats, "ALL");
    expect(result.composite).not.toBeNull();
    expect(result.composite).toBeGreaterThanOrEqual(0);
    expect(result.composite).toBeLessThanOrEqual(100);
  });
});
