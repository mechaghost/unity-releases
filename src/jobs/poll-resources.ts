import { pathToFileURL } from "node:url";
import { fetchText } from "../lib/ingest/fetch";
import { fetchHtmlWithRetry, runWithConcurrency } from "../lib/ingest/runner";
import {
  parseResourcePage,
  parseResourcesIndex,
  parseResourcesSitemap,
  mergeResourceEntries,
  SITEMAP_URL,
  CONTENT_SITEMAP_URL,
  RESOURCES_INDEX_URL,
  RESOURCE_PARSER_VERSION,
  type SitemapEntry
} from "../lib/ingest/resources";
import {
  getResourceFreshness,
  recordSourceSnapshot,
  upsertResource,
  withIngestionTransaction
} from "../lib/db/repositories";

// Be polite - we're crawling 700+ pages off a CDN. 6 in flight is well
// under the implicit limit a Sanity-backed Next.js site can absorb.
const CONCURRENCY = 6;
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_RETRIES = 2;
const MAX_PER_RUN = Number(process.env.RESOURCES_MAX_PER_RUN ?? 1500);
// Bypass the lastmod incremental filter and re-fetch every sitemap entry.
// Needed after a parser fix: the stored lastmod already matches the
// sitemap, so incremental runs skip the pages that need re-parsing.
const FORCE = /^(1|true|yes)$/i.test(process.env.RESOURCES_FORCE ?? "");

export async function pollResources() {
  await withIngestionTransaction("resources", "poll-resources", async (client, runId) => {
    const discovered: (SitemapEntry & { sourceSnapshotId: number })[] = [];
    for (const url of [SITEMAP_URL, CONTENT_SITEMAP_URL, RESOURCES_INDEX_URL]) {
      const source = await fetchText(url, { timeoutMs: 60_000 });
      if (source.status !== 200) throw new Error(`Resource discovery HTTP ${source.status}: ${url}`);
      const parsed = url === RESOURCES_INDEX_URL
        ? parseResourcesIndex(source.text) : parseResourcesSitemap(source.text);
      const sourceSnapshotId = await recordSourceSnapshot(
        client, url === RESOURCES_INDEX_URL ? "resources_index" : "resources_sitemap", source
      );
      if (parsed.length === 0) {
        console.warn(JSON.stringify({ source: url, warning: "Resource discovery returned no entries; checking remaining sources" }));
      }
      discovered.push(...parsed.map((entry) => ({ ...entry, sourceSnapshotId })));
    }
    const entries = mergeResourceEntries(discovered);
    if (entries.length === 0) throw new Error("Resource discovery returned no entries across all sources");
    const freshness = await getResourceFreshness();

    // Incremental filter: re-fetch only when the sitemap lastmod has
    // advanced past what we already have on file. Brand-new slugs get
    // fetched too. Cap per run so a `--full` re-crawl is opt-in.
    const todo = entries.filter((entry) => {
      if (FORCE) return true;
      const known = freshness.get(slugFromUrl(entry.url));
      if (!known) return true;
      if (known.parserVersion !== RESOURCE_PARSER_VERSION) return true;
      if (!known.lastmod) return true;
      if (!entry.lastmod) return false;
      return new Date(entry.lastmod).getTime() > new Date(known.lastmod).getTime();
    }).slice(0, MAX_PER_RUN);

    let stats = { fetched: 0, parsed: 0, skipped404: 0, errors: 0 };
    await runWithConcurrency(todo, CONCURRENCY, async (entry) => {
      try {
        const fetched = await fetchHtmlWithRetry(entry.url, {
          timeoutMs: REQUEST_TIMEOUT_MS,
          retries: MAX_RETRIES
        });
        stats.fetched += 1;
        const parsed = parseResourcePage(fetched.text, entry.url, entry.lastmod);
        if (!parsed) {
          stats.skipped404 += 1;
          return;
        }
        stats.parsed += 1;
        await upsertResource(client, parsed, entry.lastmod, runId, entry.sourceSnapshotId);
      } catch (err) {
        stats.errors += 1;
        console.error(JSON.stringify({ url: entry.url, error: err instanceof Error ? err.message : String(err) }));
      }
    });

    console.log(
      JSON.stringify({
        sitemapEntries: entries.length,
        force: FORCE,
        considered: todo.length,
        ...stats
      })
    );
    if (stats.errors > 0) throw new Error(`Resource ingestion failed for ${stats.errors} pages`);
  });
}

function slugFromUrl(url: string): string {
  const m = /\/resources\/([^/?#]+)/.exec(url);
  return m ? m[1] : url;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  pollResources().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
