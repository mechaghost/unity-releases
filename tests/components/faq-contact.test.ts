import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const faqPage = readFileSync("src/app/faq/page.tsx", "utf8");

describe("FAQ contact", () => {
  test("points bug and missing-data reports to the Mechaghost email", () => {
    expect(faqPage).toContain('href="mailto:elbert@mechaghost.com"');
    expect(faqPage).toContain("elbert@mechaghost.com");
    expect(faqPage).not.toContain("https://github.com/mechaghost/unity-releases");
  });
});
