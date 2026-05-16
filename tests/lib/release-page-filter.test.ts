import { describe, expect, test } from "vitest";

import {
  parseReleaseSortKey,
  parseSelectedReleaseFilters,
  releaseMatchesSelectedFilters,
  releasePageHref,
  sortReleasesByScore
} from "../../src/lib/release-page-filter";

describe("release page filters", () => {
  test("defaults to the two current Unity 6 LTS lines", () => {
    expect(parseSelectedReleaseFilters(undefined)).toEqual(["6000.3-lts", "6000.0-lts"]);
  });

  test("maps the legacy combined LTS query to both split LTS filters", () => {
    expect(parseSelectedReleaseFilters("lts")).toEqual(["6000.3-lts", "6000.0-lts"]);
  });

  test("matches 6000.0 and 6000.3 LTS releases independently", () => {
    expect(
      releaseMatchesSelectedFilters(
        { version: "6000.0.74f1", stream: "LTS" },
        ["6000.0-lts"]
      )
    ).toBe(true);
    expect(
      releaseMatchesSelectedFilters(
        { version: "6000.3.14f1", stream: "LTS" },
        ["6000.0-lts"]
      )
    ).toBe(false);
    expect(
      releaseMatchesSelectedFilters(
        { version: "6000.3.14f1", stream: "LTS" },
        ["6000.3-lts"]
      )
    ).toBe(true);
  });

  test("preserves split filters in pagination links", () => {
    expect(releasePageHref(2, ["6000.3-lts"])).toBe("/releases?stream=6000.3-lts&page=2");
    expect(releasePageHref(2, ["6000.3-lts", "6000.0-lts"])).toBe("/releases?page=2");
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
