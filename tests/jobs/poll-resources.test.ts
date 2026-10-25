import { beforeEach, expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";

const mocks = vi.hoisted(() => ({
  fetchText: vi.fn(), fetchHtmlWithRetry: vi.fn(),
  getResourceFreshness: vi.fn(), recordSourceSnapshot: vi.fn(),
  upsertResource: vi.fn(), withIngestionTransaction: vi.fn(),
  listResourceRechecks: vi.fn(), markResourceUnavailable: vi.fn(), recordResourceCheckAttempt: vi.fn()
}));
vi.mock("../../src/lib/ingest/fetch", () => ({ fetchText: mocks.fetchText }));
vi.mock("../../src/lib/ingest/runner", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../src/lib/ingest/runner")>(),
  fetchHtmlWithRetry: mocks.fetchHtmlWithRetry
}));
vi.mock("../../src/lib/db/repositories", () => mocks);
import { fetchResourceDiscovery, pollResources } from "../../src/jobs/poll-resources";
import { HttpStatusError } from "../../src/lib/ingest/runner";
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
  mocks.listResourceRechecks.mockResolvedValue([]);
  mocks.recordResourceCheckAttempt.mockResolvedValue(undefined);
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

test.each([404, 410])("removed page (%i) does not discard other resource updates", async (status) => {
  mocks.fetchText.mockReset().mockResolvedValueOnce(source(sitemap("2026-09-17").replace("</urlset>",
    "<url><loc>https://unity.com/resources/removed</loc></url></urlset>")))
    .mockResolvedValueOnce(source(sitemap("2026-09-17")))
    .mockResolvedValueOnce(source(`<a href="/resources/${slug}">Guide</a>`));
  mocks.fetchHtmlWithRetry.mockImplementation(async (requestedUrl) => {
    if (requestedUrl.endsWith("/removed")) throw new HttpStatusError(status, requestedUrl);
    return source(html);
  });
  await expect(pollResources()).resolves.toBeUndefined();
  expect(mocks.upsertResource).toHaveBeenCalledTimes(1);
});

test.each([403, 503])("HTTP %i still fails the resource run", async (status) => {
  mocks.fetchHtmlWithRetry.mockRejectedValue(new HttpStatusError(status, url));
  await expect(pollResources()).rejects.toThrow("Resource ingestion failed");
});

test("known URLs absent from discovery are rechecked and retired only on 404", async () => {
  const oldUrl = "https://unity.com/resources/retired";
  mocks.listResourceRechecks.mockResolvedValue([{ url: oldUrl, lastmod: null }]);
  mocks.fetchHtmlWithRetry.mockImplementation(async (target) => {
    if (target === oldUrl) throw new HttpStatusError(404, oldUrl);
    return source(html);
  });
  await pollResources();
  expect(mocks.markResourceUnavailable).toHaveBeenCalledWith({}, oldUrl);
});
test.each([403,429,503])("transient HTTP %s does not retire historical resource", async (status) => {
  mocks.fetchHtmlWithRetry.mockRejectedValue(new HttpStatusError(status,url));
  await expect(pollResources()).rejects.toThrow("Resource ingestion failed");
  expect(mocks.markResourceUnavailable).not.toHaveBeenCalled();
});
test("retired URL rechecks can publish a valid recovered page", async () => {
  mocks.getResourceFreshness.mockResolvedValue(new Map([[slug, { lastmod: "2026-09-17", parserVersion: RESOURCE_PARSER_VERSION }]]));
  mocks.listResourceRechecks.mockResolvedValue([{ url, lastmod: "2026-09-17" }]);
  await pollResources();
  expect(mocks.upsertResource).toHaveBeenCalledWith({},expect.objectContaining({slug}),"2026-09-17",10,null);
});

test("one blocked recheck preserves independent successful writes and advances its attempt", async () => {
  const blocked="https://unity.com/resources/blocked";
  mocks.listResourceRechecks.mockResolvedValue([{url:blocked,lastmod:null}]);
  mocks.fetchHtmlWithRetry.mockImplementation(async target => {
    if(target===blocked) throw new HttpStatusError(403,target);
    return source(html);
  });
  const committed:string[]=[];
  mocks.withIngestionTransaction.mockImplementation(async(_,job,work)=>{
    const value=await work({},10); committed.push(job); return value;
  });
  await expect(pollResources()).rejects.toThrow("1 pages");
  expect(committed).toEqual(expect.arrayContaining(["poll-resources-discovery","poll-resources-item"]));
  expect(mocks.upsertResource).toHaveBeenCalledTimes(1);
  expect(mocks.recordResourceCheckAttempt).toHaveBeenCalledWith(blocked);
});

test("retirement write failure waits for sibling work before returning a failed batch", async () => {
  const removed="https://unity.com/resources/removed";
  mocks.listResourceRechecks.mockResolvedValue([{url:removed,lastmod:null}]);
  let release!:()=>void;
  const held=new Promise<void>(resolve=>{release=resolve;});
  mocks.fetchHtmlWithRetry.mockImplementation(async target=>{
    if(target===removed) throw new HttpStatusError(404,target);
    await held; return source(html);
  });
  mocks.markResourceUnavailable.mockRejectedValue(new Error("write failed"));
  let settled=false;
  const run=pollResources().finally(()=>{settled=true;});
  const rejection=expect(run).rejects.toThrow("1 pages");
  await new Promise(resolve=>setImmediate(resolve));
  expect(settled).toBe(false);
  release();
  await rejection;
  expect(mocks.upsertResource).toHaveBeenCalledTimes(1);
  expect(mocks.recordResourceCheckAttempt).toHaveBeenCalledWith(removed);
});
