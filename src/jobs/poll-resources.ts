import { fetchText, DEFAULT_USER_AGENT } from "../lib/ingest/fetch";
import { sha256 } from "../lib/ingest/hash";
import {
  parseResourcePage,
  parseResourcesSitemap,
  SITEMAP_URL,
  type SitemapEntry
} from "../lib/ingest/resources";
import {
  getResourceFreshness,
  recordSourceSnapshot,
  upsertResource,
  withIngestionTransaction
} from "../lib/db/repositories";

// Be polite — we're crawling 700+ pages off a CDN. 6 in flight is well
// under the implicit limit a Sanity-backed Next.js site can absorb.
const CONCURRENCY = 6;
const REQUEST_TIMEOUT_MS = 20_000;
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
        const html = await fetchHtmlWithTimeout(entry.url, REQUEST_TIMEOUT_MS);
        stats.fetched += 1;
        const parsed = parseResourcePage(html, entry.url, entry.lastmod);
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

async function fetchHtmlWithTimeout(url: string, ms: number): Promise<string> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": process.env.INGESTION_USER_AGENT ?? DEFAULT_USER_AGENT,
        accept: "text/html,*/*"
      },
      redirect: "follow",
      signal: controller.signal
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.text();
  } finally {
    clearTimeout(id);
  }
}

/** Run `worker(item)` over `items` with at most `n` in-flight at once.
 *  Errors inside a worker bubble up — the caller catches them above. */
async function runWithConcurrency<T>(
  items: T[],
  n: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  const queue = items.slice();
  const inflight: Promise<void>[] = [];
  for (let i = 0; i < n; i += 1) inflight.push(loop());
  await Promise.all(inflight);

  async function loop() {
    while (queue.length > 0) {
      const item = queue.shift()!;
      await worker(item);
    }
  }
}

// Touch sha256 to keep the import for callers that may want
// per-resource hashing in the future; lint would otherwise flag it.
void sha256;

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
