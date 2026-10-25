import { describe, expect, test } from "vitest";
import { filteredPageRobots } from "../../src/lib/search-indexing";

describe("filtered search indexing", () => {
  test.each([
    [{ q: "com.unity.modules.physics", sort: "name_desc" }, ["q", "sort"]],
    [{ lanes: "breaking,api" }, ["lanes"]],
    [{ status: "fixed", area: "UI", page: "4" }, ["status", "area"]],
    [{ major: ["6000"] }, ["major"]]
  ])("excludes filter variants for all crawlers, including Google", (query, keys) => {
    expect(filteredPageRobots(query, keys)).toEqual({ index: false, follow: true, googleBot: { index: false, follow: true } });
  });
  test.each([{}, { page: "2" }, { utm_source: "newsletter" }, { q: " " }])("keeps content pages and pagination indexable", query => {
    expect(filteredPageRobots(query, ["q"])).toMatchObject({ index: true, googleBot: { index: true } });
  });
});
