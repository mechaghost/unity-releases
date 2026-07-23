import { describe, expect, test } from "vitest";

import {
  buildReleaseFilters,
  defaultReleaseFilters,
  defaultViewGenerationsLabel,
  parseReleaseSortKey,
  parseSelectedReleaseFilters,
  releaseMatchesSelectedFilters,
  releasePageHref,
  sortReleasesByScore
} from "../../src/lib/release-page-filter";

/** The lines the production index holds today. */
const RELEASES = [
  { version: "6000.3.20f1", stream: "LTS" },
  { version: "6000.0.80f1", stream: "LTS" },
  { version: "6000.5.4f1", stream: "Update/Supported" },
  { version: "6000.6.0b5", stream: "beta" },
  { version: "2022.3.61f1", stream: "LTS" },
  { version: "2021.3.45f1", stream: "LTS" },
  { version: "2020.3.48f1", stream: "LTS" },
  { version: "2019.4.40f1", stream: "LTS" }
];

const FILTERS = buildReleaseFilters(RELEASES);

describe("buildReleaseFilters", () => {
  test("derives one chip per indexed LTS line, modern first, then streams, then legacy", () => {
    expect(FILTERS.map((f) => f.value)).toEqual([
      "6000.3-lts",
      "6000.0-lts",
      "update",
      "beta",
      "alpha",
      "2022.3-lts",
      "2021.3-lts",
      "2020.3-lts",
      "2019.4-lts"
    ]);
  });

  test("labels modern lines by marketing minor and legacy lines by year", () => {
    const labels = Object.fromEntries(FILTERS.map((f) => [f.value, f.label]));
    expect(labels["6000.3-lts"]).toBe("6.3 LTS");
    expect(labels["2022.3-lts"]).toBe("2022 LTS");
  });

  test("picks up a new LTS line with no code change", () => {
    // The whole point: 6000.7 and 7000.0 need no edit here to become
    // filterable. Before this, an LTS release on an unlisted line matched no
    // chip at all and was unreachable on /releases.
    const filters = buildReleaseFilters([
      ...RELEASES,
      { version: "6000.7.0f1", stream: "LTS" },
      { version: "7000.0.4f1", stream: "LTS" }
    ]);
    const values = filters.map((f) => f.value);
    expect(values.slice(0, 4)).toEqual(["7000.0-lts", "6000.7-lts", "6000.3-lts", "6000.0-lts"]);
    expect(filters.find((f) => f.value === "7000.0-lts")?.label).toBe("7.0 LTS");
    expect(filters.find((f) => f.value === "6000.7-lts")?.label).toBe("6.7 LTS");
  });

  test("sorts lines numerically so 6000.10 outranks 6000.9", () => {
    const filters = buildReleaseFilters([
      { version: "6000.9.1f1", stream: "LTS" },
      { version: "6000.10.0f1", stream: "LTS" }
    ]);
    expect(filters.map((f) => f.value).slice(0, 2)).toEqual(["6000.10-lts", "6000.9-lts"]);
  });

  test("ignores non-LTS releases and malformed versions", () => {
    const filters = buildReleaseFilters([
      { version: "6000.6.0b5", stream: "beta" },
      { version: "garbage", stream: "LTS" },
      { version: "6000.0.80f1", stream: null }
    ]);
    expect(filters.map((f) => f.value)).toEqual(["update", "beta", "alpha"]);
  });
});

describe("release page filters", () => {
  test("defaults to every modern LTS line", () => {
    expect(parseSelectedReleaseFilters(undefined, FILTERS)).toEqual([
      "6000.3-lts",
      "6000.0-lts"
    ]);
  });

  test("a newly-indexed LTS line joins the default selection", () => {
    const filters = buildReleaseFilters([...RELEASES, { version: "6000.7.0f1", stream: "LTS" }]);
    expect(defaultReleaseFilters(filters)).toEqual([
      "6000.7-lts",
      "6000.3-lts",
      "6000.0-lts"
    ]);
  });

  test("falls back to stream chips when nothing is indexed", () => {
    const filters = buildReleaseFilters([]);
    expect(defaultReleaseFilters(filters)).toEqual(["update", "beta", "alpha"]);
  });

  test("maps the legacy combined LTS query to the split LTS filters", () => {
    expect(parseSelectedReleaseFilters("lts", FILTERS)).toEqual(["6000.3-lts", "6000.0-lts"]);
  });

  test("accepts the chip label 'supported' as an alias for its value 'update'", () => {
    // Hand-built share URLs use the visible label; before the alias,
    // ?stream=supported silently fell back to the defaults.
    expect(parseSelectedReleaseFilters("supported", FILTERS)).toEqual(["update"]);
    expect(parseSelectedReleaseFilters("Supported", FILTERS)).toEqual(["update"]);
  });

  test("drops chip values that aren't available and falls back to defaults", () => {
    expect(parseSelectedReleaseFilters("9999.9-lts", FILTERS)).toEqual([
      "6000.3-lts",
      "6000.0-lts"
    ]);
  });

  test("Object.prototype keys in ?stream= cannot poison the result or crash", () => {
    // The alias lookup used to be a plain object literal, so ?stream=constructor
    // resolved to Object's constructor, flatMap spliced the function into the
    // selection, and releaseMatchesSelectedFilters then threw
    // "value.endsWith is not a function" -> HTTP 500 (there is no error.tsx).
    for (const probe of ["constructor", "__proto__", "valueOf", "hasOwnProperty"]) {
      const selected = parseSelectedReleaseFilters(probe, FILTERS);
      expect(selected.every((v) => typeof v === "string")).toBe(true);
      expect(selected).toEqual(defaultReleaseFilters(FILTERS));
      expect(() =>
        RELEASES.filter((r) => releaseMatchesSelectedFilters(r, selected))
      ).not.toThrow();
    }
  });

  test("a non-string chip value is ignored rather than throwing", () => {
    // ReleaseFilterValue is a bare string now, so TS no longer proves this.
    const hostile = [null, undefined, 42, {}] as unknown as string[];
    expect(() => RELEASES.filter((r) => releaseMatchesSelectedFilters(r, hostile))).not.toThrow();
  });

  test("matches LTS lines independently", () => {
    expect(
      releaseMatchesSelectedFilters({ version: "6000.0.74f1", stream: "LTS" }, ["6000.0-lts"])
    ).toBe(true);
    expect(
      releaseMatchesSelectedFilters({ version: "6000.3.14f1", stream: "LTS" }, ["6000.0-lts"])
    ).toBe(false);
    expect(
      releaseMatchesSelectedFilters({ version: "6000.3.14f1", stream: "LTS" }, ["6000.3-lts"])
    ).toBe(true);
  });

  test("matches a future generation's LTS line through the same generic rule", () => {
    expect(
      releaseMatchesSelectedFilters({ version: "7000.0.4f1", stream: "LTS" }, ["7000.0-lts"])
    ).toBe(true);
    expect(
      releaseMatchesSelectedFilters({ version: "6000.7.0f1", stream: "LTS" }, ["6000.7-lts"])
    ).toBe(true);
    // A prefix match must not let 6000.7 satisfy the 6000.70 chip.
    expect(
      releaseMatchesSelectedFilters({ version: "6000.7.0f1", stream: "LTS" }, ["6000.70-lts"])
    ).toBe(false);
  });

  test("preserves non-default filters in pagination links", () => {
    const defaults = defaultReleaseFilters(FILTERS);
    expect(releasePageHref(2, ["6000.3-lts"], null, defaults)).toBe(
      "/releases?stream=6000.3-lts&page=2"
    );
    expect(releasePageHref(2, ["6000.3-lts", "6000.0-lts"], null, defaults)).toBe(
      "/releases?page=2"
    );
  });

  test("the sort cycle can return to unsorted", () => {
    // Three-state: unsorted -> desc -> asc -> unsorted. This is load-bearing.
    // Page links and the chip form both carry ?sort now (so paging out of a
    // sorted list can't silently re-order), which removed the old "toggle a
    // chip to clear the sort" escape hatch. If the header only alternated
    // desc<->asc, sorting would be one-way with no way back to date order.
    const cycle = (current: "score-desc" | "score-asc" | null) =>
      current === "score-desc" ? "score-asc" : current === "score-asc" ? null : "score-desc";

    expect(cycle(null)).toBe("score-desc");
    expect(cycle("score-desc")).toBe("score-asc");
    expect(cycle("score-asc")).toBeNull();

    // ...and the null step must produce a URL with no sort param at all.
    const defaults = defaultReleaseFilters(FILTERS);
    expect(releasePageHref(1, defaults, cycle("score-asc"), defaults)).toBe("/releases");
  });

  test("carries an active sort into page links", () => {
    // Sorting happens before pagination, so dropping ?sort here served page 2
    // from the date-ordered list - repeating rows already shown on page 1.
    const defaults = defaultReleaseFilters(FILTERS);
    expect(releasePageHref(2, defaults, "score-desc", defaults)).toBe(
      "/releases?page=2&sort=score-desc"
    );
    expect(releasePageHref(2, ["6000.3-lts"], "score-asc", defaults)).toBe(
      "/releases?stream=6000.3-lts&page=2&sort=score-asc"
    );
  });
});

describe("defaultViewGenerationsLabel", () => {
  const labelFor = (rows: typeof RELEASES) =>
    defaultViewGenerationsLabel(defaultReleaseFilters(buildReleaseFilters(rows)));

  test("names the generations actually in the default view", () => {
    expect(labelFor(RELEASES)).toBe("Unity 6");
    expect(labelFor([...RELEASES, { version: "7000.0.4f1", stream: "LTS" }])).toBe("Unity 6 and 7");
  });

  test("does NOT name a generation whose only builds are prereleases", () => {
    // The state the index enters the day Unity ships its first 7000.x alpha.
    // Deriving from every indexed release instead of the default chip set made
    // the page claim "Unity 6 and 7 LTS lines are shown by default" while
    // rendering no Unity 7 chip and no Unity 7 rows.
    const withUnity7Alpha = [...RELEASES, { version: "7000.0.0a2", stream: "alpha" }];
    expect(labelFor(withUnity7Alpha)).toBe("Unity 6");
    expect(buildReleaseFilters(withUnity7Alpha).map((f) => f.value)).not.toContain("7000.0-lts");
  });

  test("returns null when no LTS line is indexed, so callers can reword", () => {
    // defaultReleaseFilters falls back to the stream chips here; there is no
    // "LTS lines are shown by default" to describe.
    expect(labelFor([{ version: "7000.0.0a2", stream: "alpha" }])).toBeNull();
    expect(defaultViewGenerationsLabel([])).toBeNull();
  });

  test("ignores legacy-only lines, which are never in the default view", () => {
    expect(labelFor([{ version: "2022.3.61f1", stream: "LTS" }])).toBeNull();
  });
});

describe("parseReleaseSortKey", () => {
  test("returns null for missing / unknown values", () => {
    expect(parseReleaseSortKey(undefined)).toBeNull();
    expect(parseReleaseSortKey("")).toBeNull();
    expect(parseReleaseSortKey("nope")).toBeNull();
    expect(parseReleaseSortKey("desc")).toBeNull(); // close but not the canonical key
  });

  test("accepts the two canonical keys verbatim", () => {
    expect(parseReleaseSortKey("score-desc")).toBe("score-desc");
    expect(parseReleaseSortKey("score-asc")).toBe("score-asc");
  });

  test("takes the first element of an array param (?sort=a&sort=b)", () => {
    expect(parseReleaseSortKey(["score-desc", "score-asc"])).toBe("score-desc");
  });
});

describe("sortReleasesByScore", () => {
  type R = { version: string; name: string };
  const releases: R[] = [
    { version: "6000.0.30f1", name: "thirty" },
    { version: "6000.0.32f1", name: "thirty-two" },
    { version: "6000.0.35f1", name: "thirty-five" },
    { version: "6000.0.40f1", name: "forty-no-score" }
  ];
  const scores = new Map<string, { composite: number | null }>([
    ["6000.0.30f1", { composite: 50 }],
    ["6000.0.32f1", { composite: 72 }],
    ["6000.0.35f1", { composite: 35 }]
    // 40f1 deliberately missing → simulates insufficient-data result
  ]);

  test("desc orders highest-first", () => {
    const sorted = sortReleasesByScore(releases, scores, "score-desc");
    expect(sorted.map((r) => r.version)).toEqual([
      "6000.0.32f1",
      "6000.0.30f1",
      "6000.0.35f1",
      "6000.0.40f1" // unscored always last regardless of direction
    ]);
  });

  test("asc orders lowest-first", () => {
    const sorted = sortReleasesByScore(releases, scores, "score-asc");
    expect(sorted.map((r) => r.version)).toEqual([
      "6000.0.35f1",
      "6000.0.30f1",
      "6000.0.32f1",
      "6000.0.40f1" // unscored stays at the end
    ]);
  });

  test("does not mutate the input array", () => {
    const original = [...releases];
    sortReleasesByScore(releases, scores, "score-desc");
    expect(releases).toEqual(original);
  });

  test("handles all-unscored input deterministically", () => {
    const allUnscored = [
      { version: "a", name: "a" },
      { version: "b", name: "b" }
    ];
    const empty = new Map<string, { composite: number | null }>();
    expect(sortReleasesByScore(allUnscored, empty, "score-desc")).toHaveLength(2);
  });

  test("treats explicit null composite as unscored", () => {
    const sparse = new Map<string, { composite: number | null }>([
      ["6000.0.30f1", { composite: 50 }],
      ["6000.0.32f1", { composite: null }],
      ["6000.0.35f1", { composite: 35 }]
    ]);
    const sorted = sortReleasesByScore(
      [
        { version: "6000.0.30f1", name: "a" },
        { version: "6000.0.32f1", name: "b" },
        { version: "6000.0.35f1", name: "c" }
      ],
      sparse,
      "score-desc"
    );
    // null composite must land last, scored items ordered desc.
    expect(sorted.map((r) => r.version)).toEqual(["6000.0.30f1", "6000.0.35f1", "6000.0.32f1"]);
  });
});
