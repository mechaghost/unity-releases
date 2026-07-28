import { sha256 } from "../ingest/hash";
import type {
  ProductUpdateFetchResult,
  ProductUpdateTargetManifest,
  ProductUpdateTargetState
} from "./types";

export type ProductUpdateFetchOptions = {
  timeoutMs: number;
  maxResponseBytes: number;
  retries?: number;
  maxRedirects?: number;
  userAgent?: string;
  fetchImpl?: typeof fetch;
};

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const ALLOWED_CONTENT_TYPES = [
  "text/",
  "application/json",
  "application/xml",
  "application/rss+xml",
  "application/xhtml+xml"
];

export async function fetchProductUpdateTarget(
  target: ProductUpdateTargetManifest,
  state: ProductUpdateTargetState,
  options: ProductUpdateFetchOptions
): Promise<ProductUpdateFetchResult> {
  const retries = options.retries ?? 2;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetchAttempt(target, state, options);
    } catch (error) {
      lastError = error;
      if (attempt >= retries || !isRetryableFetchError(error)) break;
      const retryAfterMs =
        error instanceof ProductUpdateHttpError ? error.retryAfterMs : null;
      const delay = retryAfterMs ?? Math.min(300 * 3 ** attempt + Math.floor(Math.random() * 200), 5_000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

async function fetchAttempt(
  target: ProductUpdateTargetManifest,
  state: ProductUpdateTargetState,
  options: ProductUpdateFetchOptions
): Promise<ProductUpdateFetchResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const requestedUrl = target.url;
  let current = new URL(requestedUrl);
  const maxRedirects = options.maxRedirects ?? 5;
  const visited = new Set<string>();
  const headers = new Headers({
    "user-agent":
      options.userAgent ??
      process.env.INGESTION_USER_AGENT ??
      "UnityReleasesBot/0.1 (+https://github.com/mechaghost/unity-releases)",
    accept: "text/html,application/json,application/xml,application/rss+xml,text/plain"
  });
  if (state.validatedEtag) headers.set("if-none-match", state.validatedEtag);
  if (state.validatedLastModified) {
    headers.set("if-modified-since", state.validatedLastModified);
  }

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    validateOutboundUrl(current, target.allowedHosts);
    if (visited.has(current.href)) {
      throw new Error(`Redirect loop for ${requestedUrl}`);
    }
    visited.add(current.href);

    const response = await fetchImpl(current, {
      headers,
      redirect: "manual",
      signal: AbortSignal.timeout(options.timeoutMs)
    });

    if (REDIRECT_STATUSES.has(response.status)) {
      if (redirectCount >= maxRedirects) {
        await response.body?.cancel();
        throw new Error(`Too many redirects for ${requestedUrl}`);
      }
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) throw new Error(`Redirect missing Location for ${current.href}`);
      current = new URL(location, current);
      continue;
    }

    if (response.status === 304) {
      await response.body?.cancel();
      return {
        kind: "not-modified",
        requestedUrl,
        finalUrl: current.href,
        status: 304,
        etag: response.headers.get("etag"),
        lastModified: response.headers.get("last-modified")
      };
    }

    if (response.status === 429 || response.status >= 500) {
      const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
      await response.body?.cancel();
      throw new ProductUpdateHttpError(response.status, current.href, retryAfterMs);
    }
    if (response.status < 200 || response.status >= 300) {
      await response.body?.cancel();
      throw new ProductUpdateHttpError(response.status, current.href, null);
    }

    const contentType = (response.headers.get("content-type") ?? "text/plain").toLowerCase();
    if (!ALLOWED_CONTENT_TYPES.some((allowed) => contentType.includes(allowed))) {
      await response.body?.cancel();
      throw new Error(`Unsupported content type ${contentType} for ${current.href}`);
    }

    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > options.maxResponseBytes) {
      await response.body?.cancel();
      throw new Error(`Response exceeds ${options.maxResponseBytes} bytes for ${current.href}`);
    }

    const text = await readBoundedText(response, options.maxResponseBytes);
    return {
      kind: "content",
      requestedUrl,
      finalUrl: current.href,
      status: response.status,
      etag: response.headers.get("etag"),
      lastModified: response.headers.get("last-modified"),
      sha256: sha256(text),
      text
    };
  }

  throw new Error(`Redirect handling exhausted for ${requestedUrl}`);
}

async function readBoundedText(response: Response, maxBytes: number) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel();
        throw new Error(`Response exceeds ${maxBytes} bytes`);
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return text;
  } finally {
    reader.releaseLock();
  }
}

function validateOutboundUrl(url: URL, allowedHosts: readonly string[]) {
  if (url.protocol !== "https:") throw new Error(`Refusing non-HTTPS URL ${url.href}`);
  if (url.username || url.password) throw new Error(`Refusing credentialed URL ${url.href}`);
  if (url.port && url.port !== "443") throw new Error(`Refusing nonstandard port in ${url.href}`);
  if (!allowedHosts.includes(url.hostname)) {
    throw new Error(`Host ${url.hostname} is not allowlisted`);
  }
}

function parseRetryAfter(value: string | null) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.min(Math.max(seconds * 1_000, 0), 60_000);
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return Math.min(Math.max(timestamp - Date.now(), 0), 60_000);
}

function isRetryableFetchError(error: unknown) {
  if (error instanceof ProductUpdateHttpError) {
    return error.status === 429 || error.status >= 500;
  }
  if (error instanceof Error) {
    return (
      error.name === "TimeoutError" ||
      error.name === "AbortError" ||
      error instanceof TypeError
    );
  }
  return false;
}

export class ProductUpdateHttpError extends Error {
  constructor(
    public readonly status: number,
    url: string,
    public readonly retryAfterMs: number | null
  ) {
    super(`HTTP ${status} for ${url}`);
    this.name = "ProductUpdateHttpError";
  }
}
