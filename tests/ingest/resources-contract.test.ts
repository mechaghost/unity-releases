/** Opt in with UNITY_RESOURCES_CONTRACT=1; performs no database writes. */
import { describe, expect, test } from "vitest";
import { fetchText } from "../../src/lib/ingest/fetch";
import {
  CONTENT_SITEMAP_URL, RESOURCES_INDEX_URL, SITEMAP_URL,
  mergeResourceEntries, parseResourcePage, parseResourcesIndex, parseResourcesSitemap
} from "../../src/lib/ingest/resources";

describe.runIf(process.env.UNITY_RESOURCES_CONTRACT === "1")("Unity resources discovery contract", () => {
  test("discovers migrated resources and parses every latest index card", async () => {
    const sources = await Promise.all([SITEMAP_URL, CONTENT_SITEMAP_URL, RESOURCES_INDEX_URL]
      .map((url) => fetchText(url, { timeoutMs: 60_000 })));
    for (const source of sources) expect(source.status, source.url).toBe(200);
    const sitemaps = sources.slice(0, 2).flatMap((source) => parseResourcesSitemap(source.text));
    const index = parseResourcesIndex(sources[2].text);
    // Detect another 200-with-seven-pages discovery collapse.
    expect(mergeResourceEntries([...sitemaps, ...index]).length).toBeGreaterThan(100);
    expect(index.length).toBeGreaterThan(0);
    const failures: string[] = [];
    for (const entry of index) {
      try {
        const source = await fetchText(entry.url, { timeoutMs: 30_000 });
        expect(source.status).toBe(200);
        const parsed = parseResourcePage(source.text, entry.url);
        expect(parsed, entry.url).not.toBeNull();
        expect(parsed!.title).not.toBe(parsed!.slug);
        expect(parsed!.resourceDate).not.toBeNull();
        expect(parsed!.rawMetadata.parserPath).toBe("flight");
      } catch (error) { failures.push(`${entry.url}: ${String(error)}`); }
    }
    expect(failures).toEqual([]);
  }, 360_000);
});
