import { describe, expect, test } from "vitest";
import { editorReleaseGuideLink, packageFeatureLinks } from "../../src/lib/release-guide-links";
import { RELEASE_GUIDES, findReleaseGuide } from "../../src/lib/release-guides";
import { findGuideFeature, guideFeatures } from "../../src/lib/release-features";

const now = new Date("2026-10-24T12:00:00Z");

describe("feature guide links from technical tools", () => {
  test("exact Unity 6 builds link to the matching published family", () => {
    for (const guide of RELEASE_GUIDES) {
      for (const channel of ["a", "b", "f", "p"]) {
        expect(editorReleaseGuideLink(`6000.${guide.version.split(".")[1]}.12${channel}1`, now)).toEqual({
          href: `/whats-new/${guide.slug}`, label: `Unity ${guide.version} feature guide`
        });
      }
    }
    for (const version of ["2022.3.12f1", "7000.0.0f1", "6000.99.0f1", "6000.6", "invalid", "6000.6.0f1/extra"]) {
      expect(editorReleaseGuideLink(version, now)).toBeUndefined();
    }
    expect(editorReleaseGuideLink("6000.6.0b1", new Date("2026-08-01T00:00:00Z"))).toBeUndefined();
  });

  test("package links match exact researched associations and carry only compact navigation data", () => {
    const packageNames = new Set(RELEASE_GUIDES.flatMap(guideFeatures).map(feature => feature.details.packageId).filter(Boolean));
    for (const packageName of packageNames) {
      const links = packageFeatureLinks(packageName!, now);
      const expectedCount = RELEASE_GUIDES.flatMap(guideFeatures).filter(feature => feature.details.packageId === packageName).length;
      expect(links).toHaveLength(expectedCount);
      expect(new Set(links.map(link => link.href)).size).toBe(links.length);
      for (const link of links) {
        expect(Object.keys(link).sort()).toEqual(["href", "title", "version"]);
        const [, , guideSlug, featureSlug] = link.href.split("/");
        const guide = findReleaseGuide(guideSlug)!;
        const feature = findGuideFeature(guide, featureSlug)!;
        expect(feature.details.packageId).toBe(packageName);
        expect(link.title).toBe(feature.title);
        expect(link.version).toBe(guide.version);
      }
    }
    expect(packageFeatureLinks("com.unity.render-pipelines", now)).toEqual([]);
    expect(packageFeatureLinks("com.unity.nonexistent", now)).toEqual([]);
  });

  test("package links do not advertise unpublished guide content", () => {
    const releaseDay = new Date("2024-10-17T12:00:00Z");
    const links = packageFeatureLinks("com.unity.render-pipelines.universal", releaseDay);
    expect(links.length).toBeGreaterThan(0);
    expect(links.every(link => link.version === "6.0")).toBe(true);
    expect(packageFeatureLinks("com.unity.render-pipelines.universal", new Date("2024-10-16T12:00:00Z"))).toEqual([]);
  });
});
