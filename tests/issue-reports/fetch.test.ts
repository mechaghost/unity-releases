import { readFileSync } from "node:fs";
import { expect, test, vi } from "vitest";
import { createTrackerFetcher, TrackerFetchError } from "../../src/lib/issue-reports/fetch";
import { issueIdResolver } from "../../src/lib/parsers/issue-report";
const html = readFileSync("tests/fixtures/issue-reports/customer.html", "utf8");
const streamedMissing = readFileSync("tests/fixtures/issue-reports/streamed-not-found.html", "utf8");
const url = issueIdResolver("UUM-145761");
const options = { wait: async () => {}, requestIntervalMs: 0 };

test("confirms a streamed 404 at its destination before classifying a resolver unavailable", async () => {
  const id = "UUM-151146", resolver = issueIdResolver(id);
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: "/issues/24434" } }))
    .mockResolvedValueOnce(new Response(streamedMissing))
    .mockResolvedValueOnce(new Response("<h1>Page not found</h1>"));
  const result = await createTrackerFetcher({ ...options, fetch: fetcher })(id, resolver);
  expect(result.report).toBeNull();
  expect(result.url).toBe("https://issuetracker.unity.com/not-found");
  expect(fetcher.mock.calls.map(([url]) => url)).toEqual([resolver, "https://issuetracker.unity.com/issues/24434", result.url]);
});

test("a streamed missing resolver still falls back to a valid original report", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(streamedMissing))
    .mockResolvedValueOnce(new Response("<h1>Page not found</h1>"))
    .mockResolvedValueOnce(new Response(html));
  const source = "https://issuetracker.unity3d.com/issues/source";
  const result = await createTrackerFetcher({ ...options, fetch: fetcher })("UUM-145761", source);
  expect(result.report?.issueId).toBe("UUM-145761");
  expect(result.url).toBe(source);
});

test("a streamed redirect cannot turn protection HTML into an unavailable report", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(streamedMissing))
    .mockResolvedValueOnce(new Response("<h1>Verify you are human</h1>"));
  await expect(createTrackerFetcher({ ...options, fetch: fetcher })("UUM-145761", url)).rejects.toMatchObject({ parserFailure: true, httpStatus: 200 });
  expect(fetcher).toHaveBeenCalledTimes(2);
});

test("default spacing honors the tracker crawl delay across redirects", async () => {
  let now=1_000_000;
  const clock=vi.spyOn(Date,"now").mockImplementation(()=>now);
  const times:number[]=[];
  const request=vi.fn().mockImplementation(async()=>{
    times.push(now);
    return times.length===1 ? new Response(null,{status:302,headers:{location:"/issues/23181/example"}}) : new Response(html);
  });
  try {
    const fetchReport=createTrackerFetcher({fetch:request,wait:async ms=>{now+=ms;}});
    await fetchReport("UUM-145761",url);
    await fetchReport("UUM-145761",url);
    expect(times[1]-times[0]).toBeGreaterThanOrEqual(10_000);
    expect(times[2]-times[1]).toBeGreaterThanOrEqual(10_000);
  } finally { clock.mockRestore(); }
});
test("an unverified URL hint must match the issue ID or fall back to the source", async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(new Response(html.replaceAll("UUM-145761","UUM-99999")))
    .mockResolvedValueOnce(new Response(html));
  const result=await createTrackerFetcher({...options,fetch:fetcher})("UUM-145761",url,"https://issuetracker.unity.com/issues/12/wrong-hint");
  expect(result.report?.issueId).toBe("UUM-145761");
  expect(result.url).toBe(url);
  expect(fetcher).toHaveBeenCalledTimes(2);
});

test("follows HTTP plus HTML redirects and verifies the report identity", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "/issues/23181" } }))
    .mockResolvedValueOnce(new Response('<meta http-equiv="refresh" content="1;url=/issues/23181/example">'))
    .mockResolvedValueOnce(new Response(html));
  const result = await createTrackerFetcher({ ...options, fetch: fetcher })("UUM-145761", url);
  expect(result.report?.issueId).toBe("UUM-145761");
  expect(result.url).toBe("https://issuetracker.unity.com/issues/23181/example");
  expect(fetcher).toHaveBeenCalledTimes(3);
});
test("does not follow redirects off the tracker host", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private" } }));
  await expect(createTrackerFetcher({ ...options, fetch: fetcher })("UUM-145761", url)).rejects.toThrow(/Unsupported/);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
test("tries the stable issue ID before a legacy slug and retains the source fallback", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response("missing", { status: 404 })).mockResolvedValueOnce(new Response(html));
  expect((await createTrackerFetcher({ ...options, fetch: fetcher })("UUM-145761", "https://issuetracker.unity3d.com/issues/stale")).report).not.toBeNull();
  expect(fetcher.mock.calls[0][0]).toBe(url);
  expect(fetcher.mock.calls[1][0]).toBe("https://issuetracker.unity3d.com/issues/stale");
});
test("a missing resolver does not withdraw a report that still has a valid source page", async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(new Response(null,{status:302,headers:{location:"/not-found"}}))
    .mockResolvedValueOnce(new Response("<h1>Page not found</h1>"))
    .mockResolvedValueOnce(new Response(html));
  const result=await createTrackerFetcher({...options,fetch:fetcher})("UUM-145761","https://issuetracker.unity3d.com/issues/source");
  expect(fetcher.mock.calls[0][0]).toBe(url);
  expect(result.report?.issueId).toBe("UUM-145761");
  expect(fetcher).toHaveBeenCalledTimes(3);
});
test("withdraws only a stable-identity unavailable result", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "/not-found" } }))
    .mockResolvedValueOnce(new Response("<h1>Page not found</h1>"));
  expect((await createTrackerFetcher({ ...options, fetch: fetcher })("UUM-145761", url)).report).toBeNull();
});
test("retries a transient status, but stops on Retry-After", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response("bad", { status: 503 })).mockResolvedValueOnce(new Response(html));
  await createTrackerFetcher({ ...options, fetch: fetcher })("UUM-145761", url);
  expect(fetcher).toHaveBeenCalledTimes(2);
  const limited = vi.fn().mockResolvedValue(new Response("limited", { status: 429, headers: { "retry-after": "3600" } }));
  await expect(createTrackerFetcher({ ...options, fetch: limited })("UUM-145761", url)).rejects.toMatchObject({ retryAt: expect.any(Date), httpStatus: 429 });
  expect(limited).toHaveBeenCalledTimes(1);
});
test("rejects oversized responses, redirect loops, mismatches and cancellation", async () => {
  await expect(createTrackerFetcher({ ...options, fetch: vi.fn().mockImplementation(async () => new Response("x".repeat(2 * 1024 * 1024 + 1))) })("UUM-145761", url)).rejects.toThrow(/2 MiB/);
  const loop = vi.fn().mockImplementation(async () => new Response(null, { status: 302, headers: { location: url } }));
  await expect(createTrackerFetcher({ ...options, fetch: loop })("UUM-145761", url)).rejects.toThrow(/redirects/);
  expect(loop).toHaveBeenCalledTimes(6);
  await expect(createTrackerFetcher({ ...options, fetch: vi.fn().mockResolvedValue(new Response("<h1>challenge</h1>")) })("UUM-145761", url)).rejects.toBeInstanceOf(TrackerFetchError);
  const controller = new AbortController(); controller.abort();
  const cancelled = vi.fn();
  await expect(createTrackerFetcher({ ...options, signal: controller.signal, fetch: cancelled })("UUM-145761", url)).rejects.toThrow();
  expect(cancelled).not.toHaveBeenCalled();
});


test("an ambiguous resolver 404 cannot withdraw cached report content", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response("Generic route error", { status: 404 }));
  await expect(createTrackerFetcher({ ...options, fetch: fetcher })("UUM-145761", url)).rejects.toMatchObject({ message: expect.stringMatching(/identity/), parserFailure: true, httpStatus: 404 });
});
