import { fetchText, type FetchedSource } from "./fetch";

/**
 * Shared helpers for outbound crawlers. Both poll-resources.ts and
 * poll-legacy-lts.ts walk a Unity sitemap, fetch each entry, and
 * upsert. They share the same politeness requirements: bounded
 * concurrency, a per-request timeout, and an exponential-backoff
 * retry on 5xx / 429 / network errors.
 */

/** Run `worker(item)` over `items` with at most `n` in-flight at once.
 *  Errors propagate only after every active worker has settled. Callers should catch + log per-item failures inside the
 *  worker so one bad URL doesn't kill the whole crawl. */
export async function runWithConcurrency<T>(
  items: T[],
  n: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  const queue = items.slice();
  const inflight: Promise<void>[] = [];
  for (let i = 0; i < n; i += 1) inflight.push(loop());
  const outcomes = await Promise.allSettled(inflight);
  const failure = outcomes.find((outcome): outcome is PromiseRejectedResult => outcome.status === "rejected");
  if (failure) throw failure.reason;

  async function loop() {
    while (queue.length > 0) {
      const item = queue.shift()!;
      await worker(item);
    }
  }
}

export class HttpStatusError extends Error {
  constructor(public readonly status: number, url: string) {
    super(`HTTP ${status} for ${url}`);
    this.name = "HttpStatusError";
  }
}

export type FetchRetryOptions = {
  /** Max attempts beyond the first. Default 2 (3 total tries). */
  retries?: number;
  /** Per-attempt timeout in ms. Default 20s. */
  timeoutMs?: number;
  /** Initial backoff in ms. Each retry triples this. Default 300. */
  backoffMs?: number;
};

/**
 * Fetch a URL with bounded retries on transient failures (5xx / 429 /
 * network/timeout errors). 4xx other than 408/429 fails fast — those pages
 * are gone permanently and retrying just wastes Unity's CDN credits.
 *
 * Uses the project's `fetchText` so the resulting `FetchedSource`
 * includes a SHA-256 of the body, the final-after-redirect URL, ETag,
 * and Last-Modified headers (whatever the caller's snapshotting needs).
 */
export async function fetchHtmlWithRetry(
  url: string,
  options: FetchRetryOptions = {}
): Promise<FetchedSource> {
  const fetched = await fetchText(url, { ...options, timeoutMs: options.timeoutMs ?? 20_000 });
  if (fetched.status >= 400) throw new HttpStatusError(fetched.status, url);
  return fetched;
}
