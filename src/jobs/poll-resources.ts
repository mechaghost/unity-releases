import { scheduledJobMain } from "../lib/ingest/job-health";
import { pathToFileURL } from "node:url";
import { fetchText, type FetchedSource } from "../lib/ingest/fetch";
import { fetchHtmlWithRetry, HttpStatusError, runWithConcurrency } from "../lib/ingest/runner";
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
  listResourceRechecks,
  markResourceUnavailable,
  recordResourceCheckAttempt,
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

/** Discovery also needs bounded retries; page-fetch retries do not cover it. */
export async function fetchResourceDiscovery(url: string): Promise<FetchedSource> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    let source: FetchedSource | null = null;
    try {
      // Discovery owns its retry loop; avoid multiplying the shared retries.
      source = await fetchText(url, { timeoutMs: 60_000, retries: 0 });
    } catch (error) {
      const transient = error instanceof Error &&
        (error instanceof TypeError || error.name === "TimeoutError" || error.name === "AbortError");
      if (!transient || attempt === MAX_RETRIES) throw error;
    }
    if (source) {
      if (source.status === 200) return source;
      const error = new Error(`Resource discovery HTTP ${source.status}: ${url}`);
      if ((source.status !== 429 && source.status < 500) || attempt === MAX_RETRIES) throw error;
    }
    console.warn(JSON.stringify({ source: url, warning: "Transient resource discovery failure; retrying", attempt: attempt + 1 }));
    await new Promise(resolve => setTimeout(resolve, 300 * 3 ** attempt));
  }
  throw new Error(`Resource discovery retries exhausted: ${url}`);
}

export async function pollResources() {
  const { todo, sitemapEntries } = await withIngestionTransaction("resources", "poll-resources-discovery", async (client) => {
    const discovered: (SitemapEntry & { sourceSnapshotId: number })[] = [];
    const failures: string[] = [];
    for (const url of [SITEMAP_URL, CONTENT_SITEMAP_URL, RESOURCES_INDEX_URL]) {
      // Catch discovery failures only. Persistence failures must abort the transaction.
      let source: FetchedSource;
      let parsed: SitemapEntry[];
      try {
        source = await fetchResourceDiscovery(url);
        parsed = url === RESOURCES_INDEX_URL
          ? parseResourcesIndex(source.text) : parseResourcesSitemap(source.text);
      } catch (error) {
        const message = `${url}: ${error instanceof Error ? error.message : String(error)}`;
        failures.push(message);
        console.warn(JSON.stringify({ source: url, warning: "Resource discovery source failed; checking remaining sources", error: message }));
        continue;
      }
      const sourceSnapshotId = await recordSourceSnapshot(
        client, url === RESOURCES_INDEX_URL ? "resources_index" : "resources_sitemap", source
      );
      if (parsed.length === 0) {
        console.warn(JSON.stringify({ source: url, warning: "Resource discovery returned no entries; checking remaining sources" }));
      }
      discovered.push(...parsed.map((entry) => ({ ...entry, sourceSnapshotId })));
    }
    const entries = mergeResourceEntries(discovered);
    const failureDetails = failures.length ? `; failed sources: ${failures.join("; ")}` : "";
    if (entries.length === 0) throw new Error(`Resource discovery returned no entries across all sources${failureDetails}`);
    if (failures.length) {
      throw new Error(`Resource discovery incomplete: ${entries.length} entries from available sources${failureDetails}`);
    }
    const freshness = await getResourceFreshness();

    // Incremental filter: re-fetch only when the sitemap lastmod has
    // advanced past what we already have on file. Brand-new slugs get
    // fetched too. Cap per run so a `--full` re-crawl is opt-in.
    const todo: (SitemapEntry & { sourceSnapshotId: number | null })[] = entries.filter((entry) => {
      if (FORCE) return true;
      const known = freshness.get(slugFromUrl(entry.url));
      if (!known) return true;
      if (known.parserVersion !== RESOURCE_PARSER_VERSION) return true;
      if (!known.lastmod) return true;
      if (!entry.lastmod) return false;
      return new Date(entry.lastmod).getTime() > new Date(known.lastmod).getTime();
    }).slice(0, MAX_PER_RUN);

    const rechecks = await listResourceRechecks(100);
    const queued = new Set(todo.map(entry => entry.url));
    for (const entry of rechecks) {
      if (!queued.has(entry.url)) {
        todo.push({ ...entry, sourceSnapshotId: null });
        queued.add(entry.url);
      }
    }

    return { todo, sitemapEntries: entries.length };
  });

  const stats = { fetched: 0, parsed: 0, skippedRemoved: 0, errors: 0 };
  await runWithConcurrency(todo, CONCURRENCY, async (entry) => {
    try {
      let fetched: FetchedSource;
      try {
        fetched = await fetchHtmlWithRetry(entry.url, { timeoutMs: REQUEST_TIMEOUT_MS, retries: MAX_RETRIES });
      } catch (error) {
        if (error instanceof HttpStatusError && (error.status === 404 || error.status === 410)) {
          await withIngestionTransaction("resources", "poll-resources-item", client => markResourceUnavailable(client, entry.url));
          stats.skippedRemoved += 1;
          return;
        }
        throw error;
      }
      stats.fetched += 1;
      const parsed = parseResourcePage(fetched.text, entry.url, entry.lastmod);
      if (!parsed) throw new Error(`Resource page could not be parsed: ${entry.url}`);
      await withIngestionTransaction("resources", "poll-resources-item", (client, runId) =>
        upsertResource(client, parsed, entry.lastmod, runId, entry.sourceSnapshotId));
      stats.parsed += 1;
    } catch (error) {
      stats.errors += 1;
      console.error(JSON.stringify({ url: entry.url, error: error instanceof Error ? error.message : String(error) }));
      // Commit attempts independently so a blocked old URL cannot monopolize
      // the oldest-100 recheck queue. Preserve its previous content/availability.
      await recordResourceCheckAttempt(entry.url).catch(attemptError => {
        console.error(JSON.stringify({ url: entry.url, attemptError: String(attemptError) }));
      });
    }
  });
  console.log(JSON.stringify({ sitemapEntries, force: FORCE, considered: todo.length, ...stats }));
  if (stats.errors > 0) throw new Error(`Resource ingestion failed for ${stats.errors} pages`);
}

function slugFromUrl(url: string): string {
  const m = /\/resources\/([^/?#]+)/.exec(url);
  return m ? m[1] : url;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void scheduledJobMain("poll-resources", pollResources);
}
