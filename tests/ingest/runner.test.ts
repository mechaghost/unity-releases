import { afterEach, expect, test, vi } from "vitest";
import { fetchHtmlWithRetry, HttpStatusError } from "../../src/lib/ingest/runner";

afterEach(() => vi.unstubAllGlobals());

test.each([400, 403, 404, 410])("does not retry HTTP %i", async (status) => {
  const fetch = vi.fn().mockImplementation(async () => new Response("gone", { status }));
  vi.stubGlobal("fetch", fetch);
  await expect(fetchHtmlWithRetry("https://example.test", { backoffMs: 0 }))
    .rejects.toMatchObject({ status });
  expect(fetch).toHaveBeenCalledTimes(1);
});

test.each([429, 503])("retries HTTP %i and returns the successful response", async (status) => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response("retry", { status }))
    .mockResolvedValueOnce(new Response("ok"));
  vi.stubGlobal("fetch", fetch);
  expect((await fetchHtmlWithRetry("https://example.test", { backoffMs: 0 })).text).toBe("ok");
  expect(fetch).toHaveBeenCalledTimes(2);
});

test("aborts each timed-out request before starting the next attempt", async () => {
  let active = 0;
  let peak = 0;
  const fetch = vi.fn((_url, options: RequestInit) => new Promise<Response>((_, reject) => {
    active++;
    peak = Math.max(peak, active);
    options.signal?.addEventListener("abort", () => {
      active--;
      reject(options.signal!.reason);
    }, { once: true });
  }));
  vi.stubGlobal("fetch", fetch);
  await expect(fetchHtmlWithRetry("https://example.test", { timeoutMs: 10, backoffMs: 0 }))
    .rejects.toThrow();
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(peak).toBe(1);
  expect(active).toBe(0);
});

test("exhausted transient failures retain their HTTP status", async () => {
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response("retry", { status: 503 })));
  await expect(fetchHtmlWithRetry("https://example.test", { backoffMs: 0 }))
    .rejects.toBeInstanceOf(HttpStatusError);
});
