import { describe, expect, test } from "vitest";
import { parseResourcePage, parseResourcesSitemap } from "@/lib/ingest/resources";

/**
 * The RSC payload embeds a JSON blob inside a JS string, so JSON quotes
 * appear as `\"` and HTML-significant chars are unicode-escaped
 * (`&` → `&`). This helper builds a fixture the same way, given a
 * plain JS object, so the tests read naturally.
 */
function rscBlock(obj: Record<string, unknown>): string {
  return JSON.stringify(obj)
    .replace(/&/g, "\\u0026")
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/"/g, '\\"');
}

describe("parseResourcePage", () => {
  test("recovers a seo title that contains an escaped entity (& → \\u0026)", () => {
    // Regression: a title like "Stripe & Coda" broke the [^"\\]+ capture
    // at the interior backslash, so the match fell through to a later
    // page-section titled "Text 1" and every such resource was ingested
    // as "Text"/"Text 1". (Real case: /resources/unity-iap-payment-providers.)
    const html =
      `garbage${rscBlock({ isGated: false })}` +
      // A decoy section that literally has title "Text 1" AFTER the seo block.
      `${rscBlock({ seo: { title: "Unity IAP Payment Providers: Stripe & Coda Integration", description: "Reduce platform fees with web checkouts." } })}` +
      `later${rscBlock({ _type: "block", title: "Text 1" })}`;

    const parsed = parseResourcePage(html, "https://unity.com/resources/unity-iap-payment-providers");
    expect(parsed).not.toBeNull();
    expect(parsed?.title).toBe("Unity IAP Payment Providers: Stripe & Coda Integration");
    expect(parsed?.summary).toBe("Reduce platform fees with web checkouts.");
    expect(parsed?.slug).toBe("unity-iap-payment-providers");
  });

  test("decodes escaped entities in a plain seo title", () => {
    const html = rscBlock({
      isGated: true,
      seo: { title: "Q&A: What is Unity IAP?", description: "" }
    });
    const parsed = parseResourcePage(html, "https://unity.com/resources/what-is-unity-iap");
    expect(parsed?.title).toBe("Q&A: What is Unity IAP?");
  });

  test("decodes escaped entities in single-label and array-label fields", () => {
    const html = rscBlock({
      isGated: false,
      type: { label: "E-book & Guide" },
      topics: [{ label: "News & General" }, { label: "Q&A" }],
      seo: { title: "Real Title", description: "d" }
    });
    const parsed = parseResourcePage(html, "https://unity.com/resources/x");
    expect(parsed?.resourceType).toBe("E-book & Guide");
    expect(parsed?.topics).toEqual(["News & General", "Q&A"]);
  });

  test("still returns null for a soft-404 (no isGated and no type)", () => {
    const html = rscBlock({ seo: { title: "Text 1", description: "" } });
    expect(parseResourcePage(html, "https://unity.com/resources/ghost")).toBeNull();
  });

  test("falls back to the slug when there is no seo title", () => {
    const html = rscBlock({ isGated: false });
    const parsed = parseResourcePage(html, "https://unity.com/resources/no-seo-here");
    expect(parsed?.title).toBe("no-seo-here");
  });
});

describe("parseResourcesSitemap", () => {
  test("keeps English canonicals and drops locale-prefixed copies", () => {
    const xml = `
      <urlset>
        <url><loc>https://unity.com/resources/a-guide</loc><lastmod>2026-08-05</lastmod></url>
        <url><loc>https://unity.com/fr/resources/a-guide</loc><lastmod>2026-08-05</lastmod></url>
      </urlset>`;
    const entries = parseResourcesSitemap(xml);
    expect(entries).toEqual([
      { url: "https://unity.com/resources/a-guide", lastmod: "2026-08-05" }
    ]);
  });
});
