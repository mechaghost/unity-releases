import { describe, expect, test } from "vitest";
import { RELEASE_GUIDES } from "../../src/lib/release-guides";
import { filterUnity6Features, unity6Features } from "../../src/lib/unity6-features";

const now = new Date("2026-10-24T12:00:00Z");
describe("Unity 6 feature catalog", () => {
  test("includes all published Unity 6 highlights, including superseded releases", () => {
    const entries = unity6Features(now);
    expect([...new Set(entries.map(item => item.guide.version))]).toEqual(["6.6", "6.5", "6.4", "6.3", "6.2", "6.1", "6.0"]);
    expect(entries.length).toBe(RELEASE_GUIDES.reduce((total, guide) => total + guide.highlights.length, 0));
    expect(new Set(entries.map(item => item.feature.id)).size).toBe(entries.length);
  });
  test("excludes unpublished and non-Unity-6 guides", () => {
    const guide = RELEASE_GUIDES[0];
    expect(unity6Features(now, [{ ...guide, released: "2099-01-01" }, { ...guide, version: "7.0" }])).toEqual([]);
  });
  test("combines version, category and case-insensitive search terms", () => {
    const results = filterUnity6Features(unity6Features(now), { q: "  GRAPH   toolkit ", version: "6.2", category: "Visual tools" });
    expect(results.map(item => item.feature.title)).toEqual(["Create custom visual editors"]);
    expect(filterUnity6Features(unity6Features(now), { q: "no-such-feature-xyz", version: "", category: "" })).toEqual([]);
  });
});
