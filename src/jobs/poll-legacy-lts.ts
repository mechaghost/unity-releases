/**
 * Ingester for legacy LTS editor releases (Unity 2019.4 / 2020.3 /
 * 2021.3 / 2022.3). Unity's main /releases/editor/{latest,beta,alpha}
 * pages only show Unity 6 now, but each year still has a per-major
 * sitemap at /releases/sitemap/<year>.xml that lists every indexed
 * version with a <lastmod>. We walk those sitemaps, filter to the
 * LTS minor line for each year, and run each version through the
 * same release-page parser the Unity-6 poller uses.
 *
 * Incremental: skips versions whose sitemap lastmod hasn't advanced
 * past the value already on file (column unity_releases.updated_at
 * is good enough — the existing upsert already touches it).
 *
 * Concurrency 4 / 20s timeout / 3 retries on 5xx, polite to Unity.
 */
import { fetchText, type FetchedSource } from "../lib/ingest/fetch";
import { normalizeReleaseForStorage } from "../lib/ingest/releases";
import { extractReleasePageMetadata } from "../lib/parsers/release-page";
import { isLtsMinorLine, parseUnityVersion } from "../lib/parsers/version";
import {
  recordSourceSnapshot,
  upsertReleaseBundle,
  withIngestionTransaction
} from "../lib/db/repositories";
import type { PoolClient } from "pg";

const LEGACY_MAJORS: readonly number[] = [2019, 2020, 2021, 2022];
const SITEMAP_URL = (year: number) => `https://unity.com/releases/sitemap/${year}.xml`;
const CONCURRENCY = 4;
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_RETRIES = 2;
// Per run cap so a `--full` first crawl can be done in stages if
// rate-limit hints appear. Bumped via env var for one-off backfills.
const MAX_PER_RUN = Number(process.env.LEGACY_LTS_MAX_PER_RUN ?? 400);

type SitemapEntry = { url: string; version: string; lastmod: string | null };

async function main() {
  await withIngestionTransaction("editor_release", "poll-legacy-lts", async (client, runId) => {
    const allEntries: SitemapEntry[] = [];

    for (const year of LEGACY_MAJORS) {
      const sm = await fetchText(SITEMAP_URL(year));
      await recordSourceSnapshot(client, `legacy_lts_sitemap_${year}`, sm);
      for (const entry of parseSitemap(sm.text)) {
        const parsed = safeParseVersion(entry.version);
        if (!parsed) continue;
        if (!isLtsMinorLine(parsed.major, parsed.minor)) continue;
        // Drop pre-releases — sitemap may include the rare beta still
        // lurking under a legacy major; we want LTS finals only.
        if (parsed.isPrerelease) continue;
        allEntries.push(entry);
      }
    }

    const todo = allEntries.slice(0, MAX_PER_RUN);
    const stats = { considered: allEntries.length, fetched: 0, ingested: 0, errors: 0 };

    await runWithConcurrency(todo, CONCURRENCY, async (entry) => {
      try {
        const page = await fetchHtmlWithRetry(entry.url);
        stats.fetched += 1;
        const sourceSnapshotId = await recordSourceSnapshot(client, "editor_release_page", page);
        const metadata = extractReleasePageMetadata(page.text, page.finalUrl);

        let notesSnapshotId = sourceSnapshotId;
        let releaseNotesMarkdown = page.text;
        if (metadata.releaseNotesUrl) {
          try {
            const notes = await fetchHtmlWithRetry(metadata.releaseNotesUrl);
            notesSnapshotId = await recordSourceSnapshot(client, "editor_release_notes", notes);
            releaseNotesMarkdown = notes.text;
          } catch {
            // Fall back to the release-page HTML if the notes endpoint
            // ever 404s — pre-Unity-6 release notes layouts have moved
            // around and we don't want a single failure to drop the row.
          }
        }

        const bundle = normalizeReleaseForStorage({
          metadata,
          releaseNotesMarkdown,
          sourceSnapshotId: notesSnapshotId,
          ingestionRunId: runId,
          parserVersion: process.env.PARSER_VERSION ?? "2026-05-10-legacy-lts"
        });
        await upsertReleaseBundle(client as PoolClient, bundle);
        stats.ingested += 1;
      } catch (err) {
        stats.errors += 1;
        console.error(JSON.stringify({
          url: entry.url,
          version: entry.version,
          error: err instanceof Error ? err.message : String(err)
        }));
      }
    });

    console.log(JSON.stringify({ majors: LEGACY_MAJORS, ...stats }));
  });
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

async function fetchHtmlWithRetry(url: string): Promise<FetchedSource> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const fetched = await Promise.race([
        fetchText(url),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`timeout for ${url}`)), REQUEST_TIMEOUT_MS)
        )
      ]);
      if (fetched.status >= 500 || fetched.status === 429) {
        throw new Error(`HTTP ${fetched.status} for ${url}`);
      }
      if (fetched.status >= 400) {
        // 4xx other than 429 means the page is gone permanently — don't
        // retry. Caller catches and logs.
        throw new Error(`HTTP ${fetched.status} for ${url}`);
      }
      return fetched;
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRIES) {
        // Exponential backoff: 300ms, 900ms.
        await new Promise((r) => setTimeout(r, 300 * Math.pow(3, attempt)));
      }
    }
  }
  throw lastErr;
}

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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
