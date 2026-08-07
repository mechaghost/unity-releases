import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { parseResourcePage } from "@/lib/ingest/resources";
import {
  extractFlightStream,
  parseFlightRows
} from "@/lib/ingest/rsc-flight";

/**
 * Golden tests against REAL Unity payloads (regenerate with
 * `node scripts/capture-resource-fixtures.mjs`).
 *
 * These exist because hand-authored fixtures failed us: the helper that
 * built them escaped quotes without first escaping backslashes, so it
 * never produced the byte sequence Unity actually emits, and a broken
 * parser passed a green suite. Every fixture here is bytes captured off
 * unity.com, and each one covers a bug that reached production.
 */
function fixture(slug: string): string {
  return readFileSync(
    join(process.cwd(), "tests/fixtures/resources", `${slug}.flight.txt`),
    "utf8"
  );
}

function parse(slug: string) {
  return parseResourcePage(fixture(slug), `https://unity.com/resources/${slug}`);
}

describe("golden: real Unity resource payloads", () => {
  test("madbox - a quoted phrase inside the title survives intact", () => {
    // Was stored as `Madbox achieves \` - the scanner stopped at the
    // first inner quote because `\\\"` and the `\"` delimiter are both
    // odd backslash runs.
    const parsed = parse("madbox");
    expect(parsed?.title).toBe(
      'Madbox achieves "mad growth" monetizing with ironSource interstitials | Unity'
    );
    expect(parsed?.resourceType).toBe("Case study");
    expect(parsed?.topics).toEqual(["Monetization"]);
    expect(parsed?.resourceDate).toBe("2019-06-17");
    expect(parsed?.rawMetadata).toMatchObject({ parserPath: "flight" });
  });

  test("landfill - a Flight reference resolves to its real prose", () => {
    // seo.description is `$3a`; the text lives in a later chunk. Prod
    // rendered a literal `$3a` as the summary.
    const parsed = parse("lessons-learned-in-building-a-digital-landfill-twin");
    expect(parsed?.title).toBe("Lessons learned in Building a Digital Landfill Twin");
    expect(parsed?.summary).toMatch(/^The project was born out of a landfill tour/);
    expect(parsed?.summary).not.toMatch(/^\$/);
    expect(parsed?.summary.length).toBeGreaterThan(200);
    expect(parsed?.resourceType).toBe("Video");
  });

  test("unity-iap-payment-providers - an escaped entity decodes to '&'", () => {
    // Was stored as "Text 1": the `&` broke the capture, so the
    // regex matched a later section that happened to be titled "Text 1".
    const parsed = parse("unity-iap-payment-providers");
    expect(parsed?.title).toBe(
      "Unity IAP Payment Providers: Stripe & Coda Integration"
    );
    // The ampersand must be decoded, not left as the raw `&` escape,
    // and must not have derailed the match onto the "Text 1" section.
    expect(parsed?.title).not.toContain("\\u0026");
    expect(parsed?.title).not.toContain("Text");
    expect(parsed?.resourceDate).toBe("2026-08-05");
  });

  test("no fixture renders an escape artefact in display text", () => {
    for (const slug of [
      "madbox",
      "lessons-learned-in-building-a-digital-landfill-twin",
      "unity-iap-payment-providers"
    ]) {
      const parsed = parse(slug);
      expect(parsed, slug).not.toBeNull();
      for (const field of [parsed!.title, parsed!.summary]) {
        expect(field, `${slug}: literal backslash`).not.toMatch(/\\/);
        expect(field, `${slug}: undecoded entity`).not.toMatch(/&(amp|#x?\d|lt|gt|quot);/);
        expect(field, `${slug}: Flight token`).not.toMatch(/^\$[0-9a-zA-Z]*$/);
        expect(field, `${slug}: untrimmed`).toBe(field.trim());
      }
      // Every fixture must take the authoritative path.
      expect(parsed!.rawMetadata, slug).toMatchObject({ parserPath: "flight" });
    }
  });
});

describe("golden: Flight stream mechanics", () => {
  test("reconstructs the stream across all push chunks", () => {
    const stream = extractFlightStream(fixture("madbox"));
    expect(stream.length).toBeGreaterThan(50_000);
    // Rows are `<hexid>:` prefixed.
    expect(stream).toMatch(/(^|\n)[0-9a-f]+:/);
  });

  test("length-delimited T blobs don't swallow the rows after them", () => {
    // A T blob is delimited by its declared length, not a newline, so the
    // next row can start mid-line. A line-based split lost the document
    // row entirely on pages with a base64 image blob.
    const rows = parseFlightRows(
      extractFlightStream(fixture("lessons-learned-in-building-a-digital-landfill-twin"))
    );
    const textRows = [...rows.values()].filter((r) => r.kind === "text");
    expect(textRows.length).toBeGreaterThan(0);
    // The document row must still be present and parseable alongside them.
    const jsonRows = [...rows.values()].filter((r) => r.kind === "json");
    expect(jsonRows.length).toBeGreaterThan(0);
    expect(rows.size).toBeGreaterThan(30);
  });

  test("every JSON row that parses is valid JSON, not a truncated fragment", () => {
    const rows = parseFlightRows(extractFlightStream(fixture("unity-iap-payment-providers")));
    let parsed = 0;
    for (const row of rows.values()) {
      if (row.kind !== "json") continue;
      expect(() => JSON.parse(row.body), `row ${row.id}`).not.toThrow();
      parsed += 1;
    }
    expect(parsed).toBeGreaterThan(5);
  });
});
