import { describe, expect, test } from "vitest";

import {
  parseSelectedReleaseFilters,
  releaseMatchesSelectedFilters,
  releasePageHref
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
