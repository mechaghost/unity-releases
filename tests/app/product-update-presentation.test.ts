import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

import {
  PRODUCT_UPDATE_SITEMAP_PER_PRODUCT
} from "../../src/lib/product-updates/repositories";

const views = readFileSync(
  "src/app/updates/_components/ProductUpdateViews.tsx",
  "utf8"
);
const updatesPage = readFileSync("src/app/updates/page.tsx", "utf8");
const familyPage = readFileSync("src/app/updates/[family]/page.tsx", "utf8");
const repositories = readFileSync(
  "src/lib/product-updates/repositories.ts",
  "utf8"
);

/**
 * Source-level guards: these are server components reading the DB, so there
 * is no unit-testable render surface. Each assertion below corresponds to a
 * defect found while QA'ing the live site.
 */
describe("Product Updates presentation", () => {
  test("never renders the ingest timestamp in the release-date slot", () => {
    // `sortTime` falls back to first_seen_at, so this told readers every
    // LevelPlay adapter version shipped on the day we first indexed it.
    expect(views).not.toContain("update.releaseDate ?? update.sortTime");
    expect(views).toContain("update.releaseDate ?");
    expect(views).toContain("product-update-row__date-unknown");
  });

  test("drops the internal tier eyebrows from the reader-facing pages", () => {
    // The tier labels restated the family name or ranked the page for us;
    // neither told the reader anything the name and description didn't
    // already say. Asserting the quoted JSX literals rather than the bare
    // words so a comment explaining the removal can't satisfy the guard.
    for (const source of [views, updatesPage, familyPage]) {
      expect(source).not.toContain('"Optional intelligence"');
      expect(source).not.toContain('"Editor-adjacent"');
      expect(source).not.toContain('"Secondary intelligence"');
      expect(source).not.toContain("product-updates-eyebrow\">Secondary");
    }
    // The styling hook stays - only the label went away.
    expect(views).toContain('data-priority={family.priority}');
  });

  test("caps sitemap detail URLs per product", () => {
    // One component-heavy product (3k+ adapter versions) otherwise swamps
    // the sitemap against the release pages that carry the real value.
    expect(PRODUCT_UPDATE_SITEMAP_PER_PRODUCT).toBeGreaterThan(0);
    expect(PRODUCT_UPDATE_SITEMAP_PER_PRODUCT).toBeLessThanOrEqual(100);
    expect(repositories).toContain("PARTITION BY product_update.product_id");
    expect(repositories).toContain("WHERE product_rank <= $2");
  });
});
