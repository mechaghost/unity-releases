import { afterEach, expect, test, vi } from "vitest";
import { fetchText } from "../../src/lib/ingest/fetch";
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

test.each([408, 429, 500, 502, 503, 504])("shared downloads recover from HTTP %i", async status => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response("retry", { status })).mockResolvedValueOnce(new Response("good"));
  vi.stubGlobal("fetch", fetch);
  expect((await fetchText("https://example.test", { backoffMs: 0 })).text).toBe("good");
  expect(fetch).toHaveBeenCalledTimes(2);
});
test("permanent HTTP errors return unchanged without retries", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response("missing", { status: 404 }));
  vi.stubGlobal("fetch", fetch);
  expect((await fetchText("https://example.test")).status).toBe(404);
  expect(fetch).toHaveBeenCalledTimes(1);
});
test("network failures stop at the attempt limit", async () => {
  const fetch = vi.fn().mockRejectedValue(new TypeError("network failed"));
  vi.stubGlobal("fetch", fetch);
  await expect(fetchText("https://example.test", { backoffMs: 0 })).rejects.toThrow("network failed");
  expect(fetch).toHaveBeenCalledTimes(3);
});
test("Retry-After waits before retrying; excessive waits return the failure", async () => {
  vi.useFakeTimers();
  const fetch = vi.fn().mockResolvedValueOnce(new Response("busy", { status: 429, headers: { "retry-after": "2" } })).mockResolvedValueOnce(new Response("ok"));
  vi.stubGlobal("fetch", fetch);
  const request = fetchText("https://example.test", { backoffMs: 0 });
  await vi.advanceTimersByTimeAsync(1999);
  expect(fetch).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect((await request).status).toBe(200);
  fetch.mockReset().mockResolvedValue(new Response("busy", { status: 429, headers: { "retry-after": "86400" } }));
  expect((await fetchText("https://example.test")).status).toBe(429);
  expect(fetch).toHaveBeenCalledTimes(1);
});

test("explicit opt-out preserves a caller's own request budget", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response("limited", { status: 429 }));
  vi.stubGlobal("fetch", fetch);
  expect((await fetchText("https://example.test", { retries: 0 })).status).toBe(429);
  expect(fetch).toHaveBeenCalledTimes(1);
});
