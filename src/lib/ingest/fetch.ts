import { sha256 } from "./hash";

export const DEFAULT_USER_AGENT = "UnityReleasesBot/0.1 (+https://github.com/mechaghost/unity-releases)";

export type FetchedSource = {
  url: string;
  finalUrl: string;
  status: number;
  etag: string | null;
  lastModified: string | null;
  text: string;
  sha256: string;
};

export type FetchTextOptions = {
  userAgent?: string;
  /** Each attempt includes downloading the body. Default 30 seconds. */
  timeoutMs?: number;
  /** Retries beyond the initial GET, capped at four. Default two. */
  retries?: number;
  backoffMs?: number;
};

/** Retry GETs only. Return final HTTP errors so existing callers retain status. */
export async function fetchText(url: string, opts: FetchTextOptions = {}): Promise<FetchedSource> {
  const retries = boundedNumber(opts.retries, 2, 0, 4);
  const timeoutMs = boundedNumber(opts.timeoutMs, 30_000, 1, 120_000);
  const backoffMs = boundedNumber(opts.backoffMs, 300, 0, 5000);
  for (let attempt = 0; ; attempt++) {
    let delay = Math.min(backoffMs * 3 ** attempt + Math.random() * backoffMs, 5000);
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": opts.userAgent ?? process.env.INGESTION_USER_AGENT ?? DEFAULT_USER_AGENT,
          accept: "text/html,application/rss+xml,application/xml,text/xml,application/json,text/plain,*/*"
        },
        redirect: "follow",
        signal: AbortSignal.timeout(timeoutMs)
      });
      const retryAfter = response.headers.get("retry-after");
      const retryAfterMs = retryAfter === null ? 0 : /^\d+$/.test(retryAfter.trim())
        ? Number(retryAfter) * 1000
        : Math.max(0, Date.parse(retryAfter) - Date.now()) || 0;
      const transient = response.status === 408 || response.status === 429 || response.status >= 500;
      // Do not hammer a server that requested a long pause. Leave it for the
      // next scheduled run rather than sleeping for hours or retrying early.
      if (transient && attempt < retries && retryAfterMs <= 30_000) {
        await response.body?.cancel();
        delay = Math.max(delay, retryAfterMs);
      } else {
        const text = await response.text();
        return { url, finalUrl: response.url, status: response.status,
          etag: response.headers.get("etag"), lastModified: response.headers.get("last-modified"),
          text, sha256: sha256(text) };
      }
    } catch (error) {
      if (attempt >= retries) throw error;
    }
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

function boundedNumber(value: number | undefined, fallback: number, min: number, max: number) {
  return value === undefined || !Number.isFinite(value) ? fallback : Math.min(max, Math.max(min, Math.floor(value)));
}
