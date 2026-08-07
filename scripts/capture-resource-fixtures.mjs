#!/usr/bin/env node
/**
 * Capture golden fixtures for the resource parser from LIVE Unity pages.
 *
 * Hand-authored fixtures encode the author's *belief* about a format. That
 * is exactly how the "Madbox achieves \" truncation survived a green
 * suite: the helper that built the fixtures escaped quotes without first
 * escaping backslashes, so it never produced the real 4-char sequence and
 * the tests certified the bug. These fixtures are real bytes instead.
 *
 * Only the `self.__next_f.push([1,"…"])` calls are kept - that is
 * precisely what extractFlightStream reads, so fidelity is preserved
 * while dropping ~65% of the page (markup, styles, preload tags).
 *
 * Usage:  node scripts/capture-resource-fixtures.mjs [slug …]
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// Each fixture earns its place by covering a bug that reached production.
const DEFAULT_SLUGS = [
  // Title contains a quoted phrase -> `\\\"` (3 backslashes) vs the
  // `\"` delimiter. Truncated to `Madbox achieves \` in prod.
  "madbox",
  // seo.description is a Flight reference (`$3a`) whose text lives in a
  // later chunk. Rendered a literal `$3a` as the summary in prod.
  "lessons-learned-in-building-a-digital-landfill-twin",
  // Title contains `&` as `&`. Fell through to a section titled
  // "Text 1" in prod.
  "unity-iap-payment-providers"
];

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const OUT_DIR = join(process.cwd(), "tests/fixtures/resources");

const slugs = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_SLUGS;
mkdirSync(OUT_DIR, { recursive: true });

for (const slug of slugs) {
  const url = `https://unity.com/resources/${slug}`;
  const res = await fetch(url, { headers: { "user-agent": UA } });
  if (!res.ok) {
    console.error(`FAIL ${slug}: HTTP ${res.status}`);
    process.exitCode = 1;
    continue;
  }
  const html = await res.text();
  const pushes = html.match(/self\.__next_f\.push\(\[1,[\s\S]*?\]\)/g) ?? [];
  if (pushes.length === 0) {
    console.error(`FAIL ${slug}: no __next_f.push chunks found`);
    process.exitCode = 1;
    continue;
  }
  const out = join(OUT_DIR, `${slug}.flight.txt`);
  writeFileSync(out, pushes.join("\n"), "utf8");
  console.log(`ok ${slug}: ${pushes.length} chunks, ${pushes.join("\n").length} bytes -> ${out}`);
}
