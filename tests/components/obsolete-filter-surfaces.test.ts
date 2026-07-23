import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const comparePage = readFileSync("src/app/compare/page.tsx", "utf8");
const releasesPage = readFileSync("src/app/releases/page.tsx", "utf8");
const rootLayout = readFileSync("src/app/layout.tsx", "utf8");
const sitemap = readFileSync("src/app/sitemap.ts", "utf8");

describe("obsolete filter surfaces", () => {
  test("compare page does not render the old bottom filters card", () => {
    expect(comparePage).not.toContain('className="compare-meta"');
    expect(comparePage).not.toContain("<h4>Filters</h4>");
    expect(comparePage).not.toContain("Top areas");
  });

  test("releases page keeps the useful stream filter", () => {
    // Renamed from ReleaseStreamFilter when the chip row became
    // server-rendered and data-derived.
    expect(releasesPage).toContain("ReleaseStreamChips");
    expect(releasesPage).toContain("selectedFilters");
  });

  test("the active sort is threaded into both the chip form and the page links", () => {
    // Source-level guard because these call sites have no unit-testable surface
    // (server component + DB reads). Round-2 mutation testing showed reverting
    // either to `null` left the whole suite green while silently dropping ?sort:
    // paging out of a score-sorted list then re-orders and repeats rows.
    // The chip form must receive the sort so a chip toggle preserves it:
    expect(releasesPage).toMatch(/<ReleaseStreamChips[\s\S]*?sortKey=\{sortKey\}/);
    // Both pagination links must carry the sort, not a hardcoded null:
    const pageLinkArgs = [...releasesPage.matchAll(/releasePageHref\(pagination\.page[^)]*\)/g)].map(
      (m) => m[0]
    );
    expect(pageLinkArgs.length).toBe(2);
    for (const call of pageLinkArgs) {
      expect(call).toContain("sortKey");
      expect(call).not.toMatch(/,\s*null\s*,/);
    }
  });

  test("canonical release consumers use the uncapped lightweight summary query", () => {
    for (const source of [comparePage, releasesPage, rootLayout, sitemap]) {
      expect(source).toContain("listReleaseSummaries");
      expect(source).not.toContain("listReleases(500)");
    }
  });
});
