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
import { pollResources } from "../../src/jobs/poll-resources";
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

test("empty content discovery fails instead of quietly reverting to seven legacy pages", async () => {
  mocks.fetchText.mockReset().mockResolvedValueOnce(source(sitemap("2026-08-01")))
    .mockResolvedValueOnce(source("<urlset></urlset>"));
  await expect(pollResources()).rejects.toThrow("Resource discovery returned no entries");
});

test("parser drift fails the run and cannot report success", async () => {
  mocks.fetchHtmlWithRetry.mockResolvedValue(source(html.replace(/datePublished/g, "removedDate")));
  await expect(pollResources()).rejects.toThrow("Resource ingestion failed for 1 pages");
  expect(mocks.upsertResource).not.toHaveBeenCalled();
});
