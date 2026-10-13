import { beforeEach, expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";

const mocks = vi.hoisted(() => ({
  fetchText: vi.fn(), fetchHtmlWithRetry: vi.fn(),
  getResourceFreshness: vi.fn(), recordSourceSnapshot: vi.fn(),
  upsertResource: vi.fn(), withIngestionTransaction: vi.fn()
}));
vi.mock("../../src/lib/ingest/fetch", () => ({ fetchText: mocks.fetchText }));
vi.mock("../../src/lib/ingest/runner", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../src/lib/ingest/runner")>(),
  fetchHtmlWithRetry: mocks.fetchHtmlWithRetry
}));
vi.mock("../../src/lib/db/repositories", () => mocks);
import { fetchResourceDiscovery, pollResources } from "../../src/jobs/poll-resources";
import { RESOURCE_PARSER_VERSION } from "../../src/lib/ingest/resources";

const slug = "a-beginners-guide-to-unity-cli-and-the-pipeline-package";
const url = `https://unity.com/resources/${slug}`;
const html = readFileSync(`tests/fixtures/resources/${slug}.content.html`, "utf8");
const source = (text: string, status = 200) => ({ status, text });
const sitemap = (lastmod: string) => `<urlset><url><loc>${url}</loc><lastmod>${lastmod}</lastmod></url></urlset>`;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.withIngestionTransaction.mockImplementation(async (_, __, callback) => callback({}, 10));
  mocks.recordSourceSnapshot.mockResolvedValueOnce(1).mockResolvedValueOnce(2).mockResolvedValueOnce(3);
  mocks.fetchText.mockResolvedValueOnce(source(sitemap("2026-08-01")))
    .mockResolvedValueOnce(source(sitemap("2026-09-17")))
    .mockResolvedValueOnce(source(`<a href="/resources/${slug}">Guide</a>`));
  mocks.fetchHtmlWithRetry.mockResolvedValue(source(html));
  mocks.getResourceFreshness.mockResolvedValue(new Map());
});

test("discovers migrated resources once and keeps the content sitemap snapshot", async () => {
  await pollResources();
  expect(mocks.fetchHtmlWithRetry).toHaveBeenCalledTimes(1);
  expect(mocks.upsertResource).toHaveBeenCalledWith({}, expect.objectContaining({
    title: "A beginner’s guide to Unity CLI and the Pipeline package",
    resourceDate: "2026-09-17"
  }), "2026-09-17", 10, 2);
});

test("replays old parser output even when lastmod is unchanged", async () => {
  mocks.getResourceFreshness.mockResolvedValue(new Map([[slug, { lastmod: "2026-09-17", parserVersion: null }]]));
  await pollResources();
  expect(mocks.upsertResource).toHaveBeenCalledTimes(1);
});

test("current parser output stays incremental", async () => {
  mocks.getResourceFreshness.mockResolvedValue(new Map([[slug, {
    lastmod: "2026-09-17", parserVersion: RESOURCE_PARSER_VERSION
  }]]));
  await pollResources();
  expect(mocks.fetchHtmlWithRetry).not.toHaveBeenCalled();
});

test("discovery HTTP failures cannot report a successful empty ingestion", async () => {
  mocks.fetchText.mockReset().mockResolvedValue(source("Unavailable", 503));
  await expect(pollResources()).rejects.toThrow("Resource discovery HTTP 503");
  expect(mocks.upsertResource).not.toHaveBeenCalled();
});

test("a transient content sitemap 504 retries and recovers full discovery with correct provenance", async () => {
  mocks.fetchText.mockReset().mockResolvedValueOnce(source("<urlset></urlset>"))
    .mockResolvedValueOnce(source("Gateway timeout", 504))
    .mockResolvedValueOnce(source(sitemap("2026-09-17")))
    .mockResolvedValueOnce(source(`<a href="/resources/${slug}">Guide</a>`));
  await pollResources();
  expect(mocks.fetchText).toHaveBeenCalledTimes(4);
  expect(mocks.fetchText.mock.calls.map(c => c[0])).toEqual([
    "https://unity.com/resources/sitemap.xml", "https://unity.com/content/sitemap.xml",
    "https://unity.com/content/sitemap.xml", "https://unity.com/resources"
  ]);
  expect(mocks.upsertResource).toHaveBeenCalledWith({}, expect.anything(), "2026-09-17", 10, 2);
});

test("persistent catalog failure still checks the index but cannot publish partial coverage as complete", async () => {
  mocks.fetchText.mockReset().mockResolvedValueOnce(source("<urlset></urlset>"))
    .mockResolvedValueOnce(source("Unavailable", 504))
    .mockResolvedValueOnce(source("Unavailable", 504))
    .mockResolvedValueOnce(source("Unavailable", 504))
    .mockResolvedValueOnce(source(`<a href="/resources/${slug}">Guide</a>`));
  await expect(pollResources()).rejects.toThrow(/Resource discovery incomplete: 1 entries.*HTTP 504/);
  expect(mocks.fetchText).toHaveBeenCalledTimes(5);
  expect(mocks.fetchText.mock.calls.at(-1)?.[0]).toBe("https://unity.com/resources");
  expect(mocks.getResourceFreshness).not.toHaveBeenCalled();
  expect(mocks.upsertResource).not.toHaveBeenCalled();
});

test("permanent HTTP failures do not retry and do not hide behind valid alternatives", async () => {
  mocks.fetchText.mockReset().mockResolvedValueOnce(source("Forbidden", 403))
    .mockResolvedValueOnce(source(sitemap("2026-09-17")))
    .mockResolvedValueOnce(source(`<a href="/resources/${slug}">Guide</a>`));
  await expect(pollResources()).rejects.toThrow(/incomplete.*HTTP 403/);
  expect(mocks.fetchText).toHaveBeenCalledTimes(3);
  expect(mocks.upsertResource).not.toHaveBeenCalled();
});

test.each([new TypeError("fetch failed"), Object.assign(new Error("aborted"), { name: "TimeoutError" })])(
  "bounded timeout/network discovery retries recover: %s", async (error) => {
    mocks.fetchText.mockReset().mockRejectedValueOnce(error).mockResolvedValueOnce(source(sitemap("2026-09-17")));
    await expect(fetchResourceDiscovery(url)).resolves.toMatchObject({ status: 200 });
    expect(mocks.fetchText).toHaveBeenCalledTimes(2);
    expect(mocks.fetchText).toHaveBeenCalledWith(url, { timeoutMs: 60_000 });
  }
);

test("rate-limit responses retry within the same discovery budget", async () => {
  mocks.fetchText.mockReset().mockResolvedValueOnce(source("Rate limited", 429))
    .mockResolvedValueOnce(source(sitemap("2026-09-17")));
  await expect(fetchResourceDiscovery(url)).resolves.toMatchObject({ status: 200 });
  expect(mocks.fetchText).toHaveBeenCalledTimes(2);
});

test("empty legacy sitemap continues to alternatives and preserves their provenance", async () => {
  mocks.fetchText.mockReset().mockResolvedValueOnce(source("<urlset></urlset>"))
    .mockResolvedValueOnce(source(sitemap("2026-09-17")))
    .mockResolvedValueOnce(source(`<a href="/resources/${slug}">Guide</a>`));
  await pollResources();
  expect(mocks.fetchText).toHaveBeenCalledTimes(3);
  expect(mocks.recordSourceSnapshot).toHaveBeenCalledTimes(3);
  expect(mocks.upsertResource).toHaveBeenCalledWith({}, expect.objectContaining({
    title: "A beginner’s guide to Unity CLI and the Pipeline package"
  }), "2026-09-17", 10, 2);
});

test("empty sitemaps can use valid index discovery", async () => {
  mocks.fetchText.mockReset().mockResolvedValueOnce(source("<urlset></urlset>"))
    .mockResolvedValueOnce(source("<urlset></urlset>"))
    .mockResolvedValueOnce(source(`<a href="/resources/${slug}">Guide</a>`));
  await pollResources();
  expect(mocks.fetchHtmlWithRetry).toHaveBeenCalledTimes(1);
  expect(mocks.upsertResource).toHaveBeenCalledWith({}, expect.anything(), null, 10, 3);
});

test.each(["<urlset></urlset>", "<html>Invalid discovery document</html>"])(
  "wholly empty or unparseable aggregate discovery fails: %s", async (text) => {
    mocks.fetchText.mockReset().mockResolvedValue(source(text));
    await expect(pollResources()).rejects.toThrow("Resource discovery returned no entries across all sources");
    expect(mocks.fetchText).toHaveBeenCalledTimes(3);
    expect(mocks.getResourceFreshness).not.toHaveBeenCalled();
    expect(mocks.upsertResource).not.toHaveBeenCalled();
  }
);

test("parser drift fails the run and cannot report success", async () => {
  mocks.fetchHtmlWithRetry.mockResolvedValue(source(html.replace(/datePublished/g, "removedDate")));
  await expect(pollResources()).rejects.toThrow("Resource ingestion failed for 1 pages");
  expect(mocks.upsertResource).not.toHaveBeenCalled();
});
