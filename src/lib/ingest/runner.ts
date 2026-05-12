import { fetchText, type FetchedSource } from "./fetch";

/**
 * Shared helpers for outbound crawlers. Both poll-resources.ts and
 * poll-legacy-lts.ts walk a Unity sitemap, fetch each entry, and
 * upsert. They share the same politeness requirements: bounded
 * concurrency, a per-request timeout, and an exponential-backoff
 * retry on 5xx / 429 / network errors.
 */

/** Run `worker(item)` over `items` with at most `n` in-flight at once.
 *  Errors thrown inside a worker propagate to `Promise.all` (the loop
 *  re-throws). Callers should catch + log per-item failures inside the
 *  worker so one bad URL doesn't kill the whole crawl. */
export async function runWithConcurrency<T>(
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
 * network/timeout errors). 4xx other than 429 fails fast — those pages
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
  const retries = options.retries ?? 2;
  const timeoutMs = options.timeoutMs ?? 20_000;
  const baseBackoff = options.backoffMs ?? 300;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const fetched = await Promise.race([
        fetchText(url),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`timeout for ${url}`)), timeoutMs)
        )
      ]);
      if (fetched.status >= 500 || fetched.status === 429) {
        throw new Error(`HTTP ${fetched.status} for ${url}`);
      }
      if (fetched.status >= 400) {
        // 4xx other than 429 = permanent. Don't retry.
        throw new Error(`HTTP ${fetched.status} for ${url}`);
      }
      return fetched;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        // Exponential backoff: 300ms, 900ms, 2700ms by default.
        await new Promise((r) =>
          setTimeout(r, baseBackoff * Math.pow(3, attempt))
        );
      }
    }
  }
  throw lastErr;
}
