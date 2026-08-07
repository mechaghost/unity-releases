import { describe, expect, test } from "vitest";
import { parseResourcePage, parseResourcesSitemap } from "@/lib/ingest/resources";

/**
 * Build a fixture with the SAME two layers of escaping Next.js emits:
 * JSON is serialized, then embedded in a JS string literal (so every
 * backslash doubles and every quote gains one), and finally
 * HTML-significant chars are written as JS unicode escapes.
 *
 * Order matters. Escaping backslashes before quotes is what produces
 * the real 4-char `\\\"` sequence for a quote *inside* a value versus
 * the 2-char `\"` delimiter - the exact distinction that truncated
 * `Madbox achieves \"mad growth\"` down to `Madbox achieves \`. An
 * earlier version of this helper skipped the backslash pass, so the
 * fixtures were easier than reality and the bug slipped through.
 */
function rscBlock(obj: Record<string, unknown>): string {
  return JSON.stringify(obj)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/&/g, "\\u0026")
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e");
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

  test("keeps a quoted phrase inside a title intact", () => {
    // Regression: a quote inside the value is `\\\"` (3 backslashes) while
    // the delimiter is `\"` (1). A regex can't tell them apart - both are
    // odd runs - so the value truncated at the first inner quote and
    // /resources/madbox was stored as `Madbox achieves \`.
    const html = rscBlock({
      isGated: false,
      seo: {
        title: 'Madbox achieves "mad growth" monetizing with ironSource | Unity',
        description: "d"
      }
    });
    const parsed = parseResourcePage(html, "https://unity.com/resources/madbox");
    expect(parsed?.title).toBe(
      'Madbox achieves "mad growth" monetizing with ironSource | Unity'
    );
  });

  test("keeps a title that OPENS with a quoted phrase intact", () => {
    // /resources/vr-reconstruction-of-historical-train-space stored a lone
    // backslash: the value began with the escaped quote, so the truncation
    // left nothing at all.
    const html = rscBlock({
      isGated: false,
      seo: { title: '"Virtual Train Ride" - VR reconstruction | Unity', description: "d" }
    });
    const parsed = parseResourcePage(html, "https://unity.com/resources/vr");
    expect(parsed?.title).toBe('"Virtual Train Ride" - VR reconstruction | Unity');
  });

  test("collapses encoded newlines instead of rendering a literal \\n", () => {
    // Unity's CMS leaves encoded newlines at the end of many descriptions;
    // unhandled they render as a literal "\n" on the resource card.
    const html = rscBlock({
      isGated: false,
      seo: { title: "T", description: "Reduce platform fees with web checkouts.\n\n" }
    });
    const parsed = parseResourcePage(html, "https://unity.com/resources/x");
    expect(parsed?.summary).toBe("Reduce platform fees with web checkouts.");
    expect(parsed?.summary).not.toContain("\\n");
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
