import { describe, expect, test } from "vitest";
import { legacyCompareHref } from "../../src/lib/home-navigation";

describe("homepage bookmark compatibility", () => {
  test("ordinary visits and campaign links stay on the release overview", () => {
    expect(legacyCompareHref({})).toBeUndefined();
    expect(legacyCompareHref({ utm_source: "newsletter", q: "Unity" })).toBeUndefined();
  });
  test("comparison bookmarks preserve every value, including repeated filters", () => {
    const href = legacyCompareHref({ from: "6000.0.1f1", to: "6000.0.2f1", stream: ["LTS", "SUPPORTED"], platform: "Android", p_fixes: "2", q: "a&b", absent: undefined })!;
    const url = new URL(href, "https://unityreleases.com");
    expect(url.pathname).toBe("/compare");
    expect(url.searchParams.getAll("stream")).toEqual(["LTS", "SUPPORTED"]);
    expect(url.searchParams.get("q")).toBe("a&b");
    expect(url.searchParams.get("p_fixes")).toBe("2");
    expect(url.searchParams.has("absent")).toBe(false);
  });
  test.each(["from", "to", "stream", "platform", "p_fixes"])("partial %s bookmarks still open the comparison tool", key => {
    expect(legacyCompareHref({ [key]: "" })).toBe(`/compare?${key}=`);
  });
});
