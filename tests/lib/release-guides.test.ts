import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
const sharp = createRequire(import.meta.url)("sharp");
import { describe, expect, test } from "vitest";
import { formatGuideDate, findReleaseGuide, guideHref, guideNotesHref, guideStatus, RELEASE_GUIDES } from "../../src/lib/release-guides";
const at = (day: string) => new Date(`${day}T12:00:00Z`);
const get = (version: string) => RELEASE_GUIDES.find(g => g.version === version)!;

describe("release guides", () => {
  test("launch and review dates keep their published calendar day", () => {
    expect(formatGuideDate("2026-09-01")).toBe("Sep 1, 2026");
    expect(formatGuideDate("2026-10-24")).toBe("Oct 24, 2026");
  });
  test("all seven released Unity 6 families have complete sourced guides", () => {
    expect(RELEASE_GUIDES.map(g => g.version).sort()).toEqual(["6.0", "6.1", "6.2", "6.3", "6.4", "6.5", "6.6"]);
    expect(new Set(RELEASE_GUIDES.map(g => g.slug)).size).toBe(RELEASE_GUIDES.length);
    for (const guide of RELEASE_GUIDES) {
      expect(guide.highlights).toHaveLength(4);
      expect(guide.source).toMatch(/^https:\/\/(unity\.com|discussions\.unity\.com)\//);
      expect(guide.reviewed >= guide.released).toBe(true);
      expect(findReleaseGuide(guide.slug)).toBe(guide);
      expect(guideHref(guide)).toBe(`/whats-new/${guide.slug}`);
      expect(guideNotesHref(guide)).toBe(`/explorer?minorLine=6000.${guide.version.split(".")[1]}`);
      for (const item of guide.highlights) {
        expect(item.benefit.length).toBeGreaterThan(20);
        expect(item.consideration.length).toBeGreaterThan(20);
      }
      if (guide.kind === "lts") {
        expect(guide.supportThrough).toMatch(/^\d{4}-\d{2}$/);
        expect(guide.extendedThrough! > guide.supportThrough!).toBe(true);
      }
    }
  });
  test("every feature has a distinct, decodable local image with an official source", async () => {
    const features = RELEASE_GUIDES.flatMap(g => g.highlights);
    expect(new Set(features.map(f => f.image.src)).size).toBe(28);
    for (const { image } of features) {
      expect(image.alt.length).toBeGreaterThan(10);
      expect(image.source).toMatch(/^https:\/\/(unity\.com|discussions\.unity\.com|docs\.unity3d\.com)\//);
      expect(image.original).toMatch(/^https:\/\//);
      expect(image.src).toMatch(/^\/images\/release-guides\/6\.[0-6]-[0-3]\.webp$/);
      const buffer = readFileSync(resolve("public", image.src.slice(1)));
      const metadata = await sharp(buffer).metadata();
      expect(metadata.format).toBe("webp");
      expect(metadata.width).toBe(image.width);
      expect(metadata.height).toBe(image.height);
      expect(buffer.byteLength).toBeLessThan(300_000);
    }
  });
  test("older Updates are superseded while both LTS lines can remain supported", () => {
    for (const version of ["6.1", "6.2", "6.4", "6.5"]) expect(guideStatus(get(version), at("2026-10-24")).label).toBe("Superseded");
    for (const version of ["6.0", "6.3", "6.6"]) expect(guideStatus(get(version), at("2026-10-24")).label).toBe("Supported now");
  });
  test("month-level LTS deadlines expire without changing the release type", () => {
    expect(guideStatus(get("6.0"), at("2026-10-31")).active).toBe(true);
    expect(guideStatus(get("6.0"), at("2026-11-01"))).toMatchObject({ active: false, label: "Standard support ended" });
    expect(guideStatus(get("6.0"), at("2026-11-01")).detail).toContain("Enterprise and Industry support through October 2027");
    expect(get("6.0").kind).toBe("lts");
  });
  test("an Update cannot claim current support indefinitely without review", () => {
    expect(guideStatus(get("6.6"), at("2026-12-01")).label).toBe("Check current support");
  });
  test("a future release is not presented as available", () => {
    expect(guideStatus(get("6.6"), at("2026-08-31")).label).toBe("Upcoming");
    expect(findReleaseGuide("6000.6.0f1")).toBeUndefined();
    expect(findReleaseGuide("unity-99-0")).toBeUndefined();
  });
});
