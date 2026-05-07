import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const comparePage = readFileSync("src/app/compare/page.tsx", "utf8");
const releasesPage = readFileSync("src/app/releases/page.tsx", "utf8");

describe("obsolete filter surfaces", () => {
  test("compare page does not render the old bottom filters card", () => {
    expect(comparePage).not.toContain('className="compare-meta"');
    expect(comparePage).not.toContain("<h4>Filters</h4>");
    expect(comparePage).not.toContain("Top areas");
  });

  test("releases page keeps the useful stream filter", () => {
    expect(releasesPage).toContain("ReleaseStreamFilter");
    expect(releasesPage).toContain("selectedFilters");
  });
});
