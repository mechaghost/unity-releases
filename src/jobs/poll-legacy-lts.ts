import { pathToFileURL } from "node:url";
import { scheduledJobMain } from "../lib/ingest/job-health";
/**
 * Ingester for legacy LTS editor releases (Unity 2019.4 / 2020.3 /
 * 2021.3 / 2022.3). Unity's main /releases/editor/{latest,beta,alpha}
 * pages only show Unity 6 now, but each year still has a per-major
 * sitemap at /releases/sitemap/<year>.xml that lists every indexed
 * version with a <lastmod>. We walk those sitemaps, filter to the
 * LTS minor line for each year, and run each version through the
 * same release-page parser the Unity-6 poller uses.
 *
 * Rechecks the bounded sitemap list each run; upserts preserve identity.
 *
 * Concurrency 4 / 20s timeout / 3 retries on 5xx, polite to Unity.
 */
import { fetchText } from "../lib/ingest/fetch";
import { fetchHtmlWithRetry, runWithConcurrency } from "../lib/ingest/runner";
import { normalizeReleaseForStorage } from "../lib/ingest/releases";
import { extractReleasePageMetadata } from "../lib/parsers/release-page";
import { isLtsMinorLine, parseUnityVersion } from "../lib/parsers/version";
import { LEGACY_LTS_PARSER_VERSION } from "../lib/ingest/parser-versions";
import {
  recordSourceSnapshot,
  upsertReleaseBundle,
  withIngestionTransaction
} from "../lib/db/repositories";

const LEGACY_MAJORS: readonly number[] = [2019, 2020, 2021, 2022];
const SITEMAP_URL = (year: number) => `https://unity.com/releases/sitemap/${year}.xml`;
const CONCURRENCY = 4;
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_RETRIES = 2;
// Per run cap so a `--full` first crawl can be done in stages if
// rate-limit hints appear. Bumped via env var for one-off backfills.
const MAX_PER_RUN = Number(process.env.LEGACY_LTS_MAX_PER_RUN ?? 400);
const PARSER_VERSION =
  process.env.PARSER_VERSION ?? LEGACY_LTS_PARSER_VERSION;

type SitemapEntry = { url: string; version: string; lastmod: string | null };

export async function main() {
  const allEntries: SitemapEntry[] = [];
  for (const year of LEGACY_MAJORS) {
    const sm = await fetchText(SITEMAP_URL(year));
    if (sm.status !== 200) throw new Error(`Legacy sitemap HTTP ${sm.status}: ${year}`);
    const entries = parseSitemap(sm.text);
    if (!entries.length) throw new Error(`Empty legacy sitemap: ${year}`);
    await withIngestionTransaction("editor_release", "poll-legacy-lts-sitemap", async client => {
      await recordSourceSnapshot(client, `legacy_lts_sitemap_${year}`, sm);
    }, PARSER_VERSION);
    allEntries.push(...entries.filter(entry => {
      const parsed = safeParseVersion(entry.version);
      return parsed && isLtsMinorLine(parsed.major, parsed.minor) && !parsed.isPrerelease;
    }));
  }
  const stats = { considered: allEntries.length, fetched: 0, ingested: 0, errors: 0 };
  await runWithConcurrency(allEntries.slice(0, MAX_PER_RUN), CONCURRENCY, async entry => {
    try {
      // Finish network work before opening the per-release write transaction.
      const page = await fetchHtmlWithRetry(entry.url, { timeoutMs: REQUEST_TIMEOUT_MS, retries: MAX_RETRIES });
      stats.fetched++;
      const metadata = extractReleasePageMetadata(page.text, page.finalUrl);
      const notes = metadata.releaseNotesUrl
        ? await fetchHtmlWithRetry(metadata.releaseNotesUrl, { timeoutMs: REQUEST_TIMEOUT_MS, retries: MAX_RETRIES }) : null;
      await withIngestionTransaction("editor_release", "poll-legacy-lts", async (client, runId) => {
        const pageId = await recordSourceSnapshot(client, "editor_release_page", page);
        const notesId = notes ? await recordSourceSnapshot(client, "editor_release_notes", notes) : pageId;
        await upsertReleaseBundle(client, normalizeReleaseForStorage({
          metadata, releaseNotesMarkdown: notes?.text ?? page.text,
          sourceSnapshotId: notesId, ingestionRunId: runId, parserVersion: PARSER_VERSION
        }));
      }, PARSER_VERSION);
      stats.ingested++;
    } catch (error) {
      stats.errors++;
      console.error(JSON.stringify({ url: entry.url, version: entry.version, error: error instanceof Error ? error.message : String(error) }));
    }
  });
  console.log(JSON.stringify({ majors: LEGACY_MAJORS, ...stats }));
  if (stats.errors) throw new Error(`Legacy ingestion failed for ${stats.errors} releases`);
}

function parseSitemap(xml: string): SitemapEntry[] {
  const out: SitemapEntry[] = [];
  const URL_BLOCK = /<url>([\s\S]*?)<\/url>/g;
  for (let m = URL_BLOCK.exec(xml); m !== null; m = URL_BLOCK.exec(xml)) {
    const block = m[1];
    const locMatch = /<loc>(https:\/\/unity\.com\/releases\/editor\/whats-new\/([^<\s]+))<\/loc>/.exec(block);
    if (!locMatch) continue;
    const url = locMatch[1];
    const version = locMatch[2];
    // Reject locale-prefixed copies.
    if (/^https:\/\/unity\.com\/[a-z]{2}\//.test(url)) continue;
    const lastmodMatch = /<lastmod>([^<]+)<\/lastmod>/.exec(block);
    out.push({ url, version, lastmod: lastmodMatch ? lastmodMatch[1] : null });
  }
  return out;
}

function safeParseVersion(version: string): ReturnType<typeof parseUnityVersion> | null {
  try {
    return parseUnityVersion(version);
  } catch {
    return null;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void scheduledJobMain("poll-legacy-lts", main);
}
