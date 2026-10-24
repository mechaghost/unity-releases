import { describe, expect, test } from "vitest";
import { FEATURE_DETAILS } from "../../src/lib/release-feature-details";
import { RELEASE_GUIDES } from "../../src/lib/release-guides";
import { featureHref, featureTools, findGuideFeature, guideFeatures, relatedFeatures } from "../../src/lib/release-features";
import { filtersFromSearchParams } from "../../src/lib/api";

describe("release feature details", () => {
  test("every published card has one complete detail record and no record is orphaned", () => {
    const ids = RELEASE_GUIDES.flatMap(guide => guide.highlights.map((_, index) => `${guide.version}-${index}`));
    expect(Object.keys(FEATURE_DETAILS).sort()).toEqual(ids.sort());
    const paths: string[] = [];
    for (const guide of RELEASE_GUIDES) {
      const features = guideFeatures(guide);
      expect(features).toHaveLength(guide.highlights.length);
      expect(new Set(features.map(feature => feature.details.slug)).size).toBe(features.length);
      for (const feature of features) {
        const detail = feature.details;
        expect(detail.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
        expect(detail.technicalName.trim().length).toBeGreaterThan(0);
        expect(detail.overview.length).toBeGreaterThan(0);
        expect(detail.steps.length).toBeGreaterThan(0);
        expect(detail.searchTerms.length).toBeGreaterThan(0);
        for (const text of [...detail.overview, ...detail.steps, ...detail.notes, ...detail.searchTerms]) {
          expect(text.trim().length).toBeGreaterThan(0);
        }
        expect(detail.links.length).toBeGreaterThan(0);
        for (const link of detail.links) {
          expect(link.label.trim().length).toBeGreaterThan(0);
          const url = new URL(link.url);
          expect(url.protocol).toBe("https:");
          const officialDocumentation = /(^|\.)(unity\.com|unity3d\.com)$/.test(url.hostname);
          const officialSample = url.hostname === "github.com" && url.pathname.startsWith("/Unity-Technologies/");
          expect(officialDocumentation || officialSample).toBe(true);
        }
        paths.push(featureHref(guide, feature));
      }
    }
    expect(new Set(paths).size).toBe(ids.length);
  });

  test("feature paths survive editorial title changes and lookups stay inside their guide", () => {
    for (const guide of RELEASE_GUIDES) {
      for (const feature of guideFeatures(guide)) {
        const path = featureHref(guide, feature);
        expect(path).toBe(`/whats-new/${guide.slug}/${feature.details.slug}`);
        expect(featureHref(guide, { ...feature, title: "A revised casual heading" })).toBe(path);
        expect(findGuideFeature(guide, feature.details.slug)?.id).toBe(feature.id);
      }
      expect(findGuideFeature(guide, "unknown-feature")).toBeUndefined();
      expect(findGuideFeature(guide, "../unity-6-6")).toBeUndefined();
      const ownSlugs = new Set(guideFeatures(guide).map(feature => feature.details.slug));
      const foreign = RELEASE_GUIDES.flatMap(guideFeatures).find(feature => !ownSlugs.has(feature.details.slug));
      if (foreign) expect(findGuideFeature(guide, foreign.details.slug)).toBeUndefined();
    }
  });

  test("tool links preserve the feature query and scope release notes to the correct family", () => {
    for (const guide of RELEASE_GUIDES) {
      for (const feature of guideFeatures(guide)) {
        const links = featureTools(guide, feature);
        const urls = links.map(link => new URL(link.href, "https://unityreleases.com"));
        const notes = urls.find(url => url.pathname === "/explorer")!;
        expect(filtersFromSearchParams(notes.searchParams)).toMatchObject({
          q: feature.details.searchTerms[0], minorLine: `6000.${guide.version.split(".")[1]}`
        });
        expect(notes.searchParams.has("version")).toBe(false);
        for (const url of urls) {
          expect(["/explorer", "/issues", "/packages", "/resources", "/discussions"]).toContain(url.pathname);
          expect(url.searchParams.get("q")).toBe(url.pathname === "/packages" ? feature.details.packageId : feature.details.searchTerms[0]);
          expect([...url.searchParams.keys()].sort()).toEqual(url.pathname === "/explorer" ? ["minorLine", "q"] : ["q"]);
        }
        expect(urls.some(url => url.pathname === "/packages")).toBe(Boolean(feature.details.packageId));
      }
    }
  });

  test("search terms cannot inject additional route parameters", () => {
    const guide = RELEASE_GUIDES[0];
    const feature = guideFeatures(guide)[0];
    const term = "2D & lights + shadows? #objects";
    const changed = { ...feature, details: { ...feature.details, searchTerms: [term], packageId: undefined } };
    for (const link of featureTools(guide, changed)) {
      const url = new URL(link.href, "https://unityreleases.com");
      expect(url.searchParams.get("q")).toBe(term);
      expect(url.hash).toBe("");
      expect(url.searchParams.has("lights")).toBe(false);
    }
  });

  test("related links lead to other published features with a shared topic", () => {
    let relatedCount = 0;
    for (const guide of RELEASE_GUIDES) {
      for (const feature of guideFeatures(guide)) {
        const related = relatedFeatures(guide, feature);
        expect(new Set(related.map(item => item.feature.id)).size).toBe(related.length);
        const terms = new Set(feature.details.searchTerms.map(term => term.toLowerCase()));
        for (const item of related) {
          relatedCount++;
          expect(item.feature.id).not.toBe(feature.id);
          expect(item.feature.details.searchTerms.some(term => terms.has(term.toLowerCase()))
            || Boolean(feature.details.packageId && item.feature.details.packageId === feature.details.packageId)).toBe(true);
          expect(findGuideFeature(item.guide, item.feature.details.slug)?.id).toBe(item.feature.id);
        }
      }
    }
    expect(relatedCount).toBeGreaterThan(0);
  });
});
