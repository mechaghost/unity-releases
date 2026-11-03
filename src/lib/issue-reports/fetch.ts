import { setTimeout as delay } from "node:timers/promises";
import { DEFAULT_USER_AGENT } from "../ingest/fetch";
import { parseIssueReport, trackerHtmlRedirect, trackerPageUnavailable, validatedTrackerUrl, issueIdResolver } from "../parsers/issue-report";

export const TRACKER_REPORT_TIMEOUT_MS = 90_000;
// https://issuetracker.unity.com/robots.txt: Crawl-delay: 10
const TRACKER_REQUEST_INTERVAL_MS = 10_000;

export class TrackerFetchError extends Error {
  constructor(message: string, public readonly retryAt?: Date, public readonly parserFailure = false,
    public readonly httpStatus?: number) { super(message); }
}
export type TrackerFetchOptions = {
  signal?: AbortSignal;
  fetch?: typeof fetch;
  wait?: (ms: number, signal?: AbortSignal) => Promise<void>;
  requestIntervalMs?: number;
  onRequest?: () => void;
};

export function createTrackerFetcher(options: TrackerFetchOptions = {}) {
  const request = options.fetch ?? fetch;
  const wait = options.wait ?? (async (ms, signal) => { await delay(ms, undefined, { signal }); });
  let lastRequest = 0;
  let activeSignal = options.signal;
  async function page(start: string) {
    let url = validatedTrackerUrl(start);
    for (let hop = 0; hop <= 5; hop++) {
      let response: Response | undefined;
      let text = "";
      for (let attempt = 0; attempt <= 1; attempt++) {
        activeSignal?.throwIfAborted();
        await wait(Math.max(0, lastRequest + (options.requestIntervalMs ?? TRACKER_REQUEST_INTERVAL_MS) - Date.now()), activeSignal);
        lastRequest = Date.now();
        options.onRequest?.();
        try {
          const signal = activeSignal ? AbortSignal.any([activeSignal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000);
          response = await request(url, { redirect: "manual", signal,
            headers: { "user-agent": process.env.INGESTION_USER_AGENT ?? DEFAULT_USER_AGENT, accept: "text/html" } });
          if (response.status === 429 || response.headers.has("retry-after")) {
            const value = response.headers.get("retry-after") ?? "60";
            const at = /^\d+$/.test(value) ? Date.now() + Number(value) * 1000 : Date.parse(value);
            await response.body?.cancel();
            throw new TrackerFetchError("Tracker requested a cooldown", new Date(Math.max(Date.now() + 60_000, Number.isFinite(at) ? at : 0)), false, response.status);
          }
          if ((response.status >= 500 || response.status === 408) && attempt === 0) {
            await response.body?.cancel();
            await wait(1000, activeSignal);
            continue;
          }
          const reader = response.body?.getReader();
          const chunks: Uint8Array[] = [];
          let bytes = 0;
          if (reader) {
            try {
              for (;;) {
                const chunk = await reader.read();
                if (chunk.done) break;
                bytes += chunk.value.byteLength;
                if (bytes > 2 * 1024 * 1024) throw new TrackerFetchError("Tracker response exceeds 2 MiB");
                chunks.push(chunk.value);
              }
            } catch (error) { await reader.cancel().catch(() => undefined); throw error; }
            finally { reader.releaseLock(); }
          }
          text = Buffer.concat(chunks).toString("utf8");
          break;
        } catch (error) {
          if (error instanceof TrackerFetchError || activeSignal?.aborted || attempt === 1) throw error;
          await wait(1000, activeSignal);
        }
      }
      if (!response) throw new TrackerFetchError("No tracker response");
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) throw new TrackerFetchError("Tracker redirect has no destination");
        url = validatedTrackerUrl(new URL(location, url).href);
        continue;
      }
      if (response.status === 404 || response.status === 410) return { url, text, unavailable: trackerPageUnavailable(text, url), status: response.status };
      if (response.status !== 200) throw new TrackerFetchError(`Tracker HTTP ${response.status}`, undefined, false, response.status);
      const redirect = trackerHtmlRedirect(text, url);
      if (redirect) { url = redirect; continue; }
      return { url, text, unavailable: trackerPageUnavailable(text, url), status: response.status };
    }
    throw new TrackerFetchError("Too many tracker redirects");
  }
  return async (id: string, sourceUrl: string, canonicalUrl?: string | null) => {
    activeSignal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(TRACKER_REPORT_TIMEOUT_MS)]) : AbortSignal.timeout(TRACKER_REPORT_TIMEOUT_MS);
    const resolver = issueIdResolver(id);
    // Cached/sitemap URLs avoid redirects; the stable ID avoids legacy-host hops.
    const candidates = [...new Set([canonicalUrl, resolver, sourceUrl].filter((url): url is string => Boolean(url)))];
    let lastError: unknown;
    let unavailable: Awaited<ReturnType<typeof page>> | undefined;
    for (const candidate of candidates) {
      try {
        const result = await page(candidate);
        if (result.unavailable) {
          if (candidate === resolver) unavailable = result;
          continue; // A broken slug is not evidence that an issue was removed.
        }
        try { return { ...result, report: parseIssueReport(result.text, id) }; }
        catch (error) { lastError = new TrackerFetchError((error as Error).message, undefined, true, result.status); }
      } catch (error) {
        if (error instanceof TrackerFetchError && error.retryAt || activeSignal?.aborted) throw error;
        lastError = error;
      }
    }
    // The resolver can be stale while an original source page still works.
    if (unavailable) return { ...unavailable, report: null };
    throw lastError ?? new TrackerFetchError("Unable to resolve tracker issue", undefined, true);
  };
}
