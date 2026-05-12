import { fetchText } from "../lib/ingest/fetch";
import { fetchHtmlWithRetry, runWithConcurrency } from "../lib/ingest/runner";
import {
  parseResourcePage,
  parseResourcesSitemap,
  SITEMAP_URL
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

async function main() {
  await withIngestionTransaction("resources", "poll-resources", async (client, runId) => {
    const sitemap = await fetchText(SITEMAP_URL);
    const sourceSnapshotId = await recordSourceSnapshot(client, "resources_sitemap", sitemap);
    const entries = parseResourcesSitemap(sitemap.text);
    const freshness = await getResourceFreshness();

    // Incremental filter: re-fetch only when the sitemap lastmod has
    // advanced past what we already have on file. Brand-new slugs get
    // fetched too. Cap per run so a `--full` re-crawl is opt-in.
    const todo = entries.filter((entry) => {
      const known = freshness.get(slugFromUrl(entry.url));
      if (!known) return true;
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
        await upsertResource(client, parsed, entry.lastmod, runId, sourceSnapshotId);
      } catch (err) {
        stats.errors += 1;
        console.error(JSON.stringify({ url: entry.url, error: err instanceof Error ? err.message : String(err) }));
      }
    });

    console.log(
      JSON.stringify({
        sitemapEntries: entries.length,
        considered: todo.length,
        ...stats
      })
    );
  });
}

function slugFromUrl(url: string): string {
  const m = /\/resources\/([^/?#]+)/.exec(url);
  return m ? m[1] : url;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
