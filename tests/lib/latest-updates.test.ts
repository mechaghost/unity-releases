import { afterEach, beforeEach, expect, test, vi } from "vitest";

await vi.hoisted(async () => {
  const { AsyncLocalStorage } = await import("node:async_hooks");
  Object.assign(globalThis, { AsyncLocalStorage });
});

// Exercise Next's real cache wrapper with an isolated in-memory storage backend.
const entries = new Map<string, { value: unknown; savedAt: number }>();
let now = 0;

const mocks = vi.hoisted(() => ({
  query: vi.fn(), issues: vi.fn(), news: vi.fn(), resources: vi.fn(),
  discussions: vi.fn(), github: vi.fn(), products: vi.fn(), schemaReady: vi.fn()
}));
vi.mock("../../src/lib/db/client", () => ({ query: mocks.query }));
vi.mock("../../src/lib/db/repositories", () => ({
  listDiscoursePosts: mocks.discussions,
  listLatestBlogPosts: mocks.news,
  listGithubRepos: mocks.github,
  listResources: mocks.resources,
  numericVersionDesc: () => "numeric_version DESC"
}));
vi.mock("../../src/lib/issues", () => ({ getNewestIssues: mocks.issues }));
vi.mock("../../src/lib/product-updates/repositories", () => ({
  listProductUpdates: mocks.products,
  productUpdatesSchemaReady: mocks.schemaReady
}));
import { getLatestUpdates } from "../../src/lib/latest-updates";

beforeEach(() => {
  vi.resetAllMocks();
  entries.clear();
  now = 0;
  vi.stubGlobal("__incrementalCache", {
    generateSimpleCacheKey: async (key: string) => key,
    get: async (key: string, options: { revalidate: number }) => {
      const entry = entries.get(key);
      return entry ? { value: entry.value, isStale: now - entry.savedAt >= options.revalidate * 1000 } : null;
    },
    set: async (key: string, value: unknown) => { entries.set(key, { value, savedAt: now }); }
  });
  mocks.query.mockResolvedValue({ rows: [] });
  mocks.issues.mockResolvedValue([]);
  mocks.news.mockResolvedValue([]);
  mocks.resources.mockResolvedValue({ rows: [], total: 0 });
  mocks.discussions.mockResolvedValue({ items: [], total: 0 });
  mocks.github.mockResolvedValue({ items: [], total: 0 });
  mocks.products.mockResolvedValue([]);
  mocks.schemaReady.mockResolvedValue(true);
});

afterEach(() => vi.unstubAllGlobals());

test("disabled product surfaces do not query their schema or data", async () => {
  const result = await getLatestUpdates(false);
  expect(mocks.schemaReady).not.toHaveBeenCalled();
  expect(mocks.products).not.toHaveBeenCalled();
  expect(result["editor-tools"]).toEqual({ item: null, unavailable: false });
  expect(result.products).toEqual({ item: null, unavailable: false });
  expect(Object.keys(result)).toHaveLength(9);
});

test("failure in one source leaves other sources usable and differs from empty", async () => {
  mocks.news.mockRejectedValue(new Error("database timeout"));
  mocks.discussions.mockResolvedValue({ items: [{ topicTitle: "Unity 6.6", discourseUpdatedAt: "2026-10-23T04:00:00Z" }] });
  const result = await getLatestUpdates(false);
  expect(result.news).toEqual({ item: null, unavailable: true });
  expect(result.resources).toEqual({ item: null, unavailable: false });
  expect(result.discussions).toEqual({ item: { title: "Unity 6.6", date: "2026-10-23T04:00:00.000Z", dateLabel: "Updated" }, unavailable: false });
});

test("editor tools get a bounded family query and undated products never inherit discovery dates", async () => {
  mocks.products.mockResolvedValue([{
    title: "Version 1.2", productName: "Unity CLI", releaseDate: null,
    sortTime: "2026-10-24T04:00:00Z", lastValidatedAt: "2026-10-24T04:00:00Z"
  }]);
  const result = await getLatestUpdates(true);
  expect(mocks.products).toHaveBeenCalledWith({ family: "editor-tooling", limit: 1 });
  expect(result["editor-tools"].item).toEqual({ title: "Unity CLI: Version 1.2", date: null });
  expect(result.products.item?.date).toBeNull();
});

test("missing product schema is unavailable, not an empty feed", async () => {
  mocks.schemaReady.mockResolvedValue(false);
  const result = await getLatestUpdates(true);
  expect(result.products.unavailable).toBe(true);
  expect(result["editor-tools"].unavailable).toBe(true);
  expect(mocks.products).not.toHaveBeenCalled();
});

test("release and package teasers use bounded source-date queries, with stable release scope", async () => {
  mocks.query.mockImplementation(async (sql: string) => ({ rows: sql.includes("FROM unity_releases")
    ? [{ version: "6000.6.7f1", stream: "Update/Supported", release_date: "2026-10-22T09:00:00Z" }]
    : [{ name: "Input System", version: "1.17.0", published_at: new Date("2026-10-21T00:00:00Z") }]
  }));
  const result = await getLatestUpdates(false);
  expect(result.releases.item).toEqual({ title: "Unity 6000.6.7f1 · Supported", date: "2026-10-22T09:00:00.000Z" });
  expect(result.packages.item).toEqual({ title: "Input System 1.17.0", date: "2026-10-21T00:00:00.000Z" });
  const releaseSql = mocks.query.mock.calls.find(([sql]) => sql.includes("FROM unity_releases"))![0];
  expect(releaseSql).toContain("WHERE stream IN ('LTS', 'Update/Supported')");
  expect(releaseSql).toMatch(/ORDER BY release_date DESC NULLS LAST/);
  expect(releaseSql).toContain("LIMIT 1");
});

test("each section uses its upstream date instead of sync timestamps", async () => {
  const upstream = "2026-10-20T00:00:00.000Z";
  const sync = "2026-10-24T00:00:00.000Z";
  mocks.issues.mockResolvedValue([{ issueId: "UUM-42", description: "Editor freezes", introducedDate: upstream, updated_at: sync }]);
  mocks.news.mockResolvedValue([{ title: "News", guid: "news-guid", published_at: upstream, event_time: sync, updated_at: sync }]);
  mocks.resources.mockResolvedValue({ rows: [{ title: "Guide", resource_date: upstream, updated_at: sync }] });
  mocks.discussions.mockResolvedValue({ items: [{ topicTitle: "Discussion", discourseUpdatedAt: upstream, updated_at: sync }] });
  mocks.github.mockResolvedValue({ items: [{ name: "Graphics", latestCommitMessage: "Fix render pass", repoPushedAt: upstream, last_synced_at: sync }] });
  const result = await getLatestUpdates(false);
  for (const key of ["issues", "news", "resources", "discussions", "github"] as const) expect(result[key].item?.date).toBe(upstream);
  expect(mocks.discussions).toHaveBeenCalledWith({ firstPostOnly: true, sort: "recent", perPage: 1 });
  expect(mocks.github).toHaveBeenCalledWith({ sort: "updated", direction: "desc", perPage: 1 });
});


test("undated blog entries do not display feed discovery time as publication date", async () => {
  mocks.news.mockResolvedValue([{ title: "News", guid: "news-guid", published_at: null, event_time: "2026-10-24T00:00:00Z" }]);
  const result = await getLatestUpdates(false);
  expect(result.news.item).toEqual({ title: "News", date: null });
});


test("cards include actual release notes, changelog bullets, and product summaries", async () => {
  mocks.query.mockImplementation(async (sql: string) => ({ rows: sql.includes("FROM unity_releases")
    ? [{ version: "6000.6.7f1", stream: "Update/Supported", release_date: null, summary: "Added [lighting layers](https://example.com) for `2D` lights." }]
    : [{ name: "Input System", version: "1.18.0-pre.1", published_at: null, is_prerelease: true, changelog: "# Changelog\n\n## 1.18.0\n### Added\n- Added **controller** support.\n- Another change." }]
  }));
  mocks.products.mockResolvedValue([{ title: "Unity CLI 1.2", productName: "Unity CLI", releaseDate: null, summary: "Added a project command." }]);
  const result = await getLatestUpdates(true);
  expect(result.releases.item?.summary).toBe("Added lighting layers for 2D lights.");
  expect(result.packages.item?.title).toContain("Prerelease");
  expect(result.packages.item?.summary).toBe("Added controller support.");
  expect(result.packages.item?.summary).not.toContain("Another change");
  expect(result.products.item?.summary).toBe("Added a project command.");
  const releaseSql = mocks.query.mock.calls.find(([sql]) => sql.includes("FROM unity_releases"))![0];
  expect(releaseSql).toContain("numeric_version DESC");
  expect(releaseSql).toContain("'Features', 'Improvements', 'Fixes'");
  const packageSql = mocks.query.mock.calls.find(([sql]) => sql.includes("FROM packages p"))![0];
  expect(packageSql).toContain("ORDER BY published_at DESC NULLS LAST, version DESC");
  expect(packageSql).toContain("LOWER(COALESCE(p.display_name, p.name)) ASC");
});

test("long summaries stay short and missing changelogs get no invented description", async () => {
  mocks.products.mockResolvedValue([{ title: "Update", productName: "Unity CLI", releaseDate: null, summary: "Actual release detail ".repeat(30) }]);
  mocks.query.mockResolvedValue({ rows: [{ name: "Input System", version: "1.17.0", published_at: null, changelog: "# Changelog\nNo notes supplied." }] });
  const result = await getLatestUpdates(true);
  expect(result.products.item?.summary?.length).toBeLessThanOrEqual(180);
  expect(result.products.item?.summary).toMatch(/…$/);
  expect(result.packages.item?.summary).toBeUndefined();
});


test("product cards prefer a real change over generated summary counts", async () => {
  mocks.products.mockResolvedValue([{ id: 42, title: "Unity Hub 3.14", productName: "Unity Hub", releaseDate: null, summary: "11 documented changes across 5 sections." }]);
  mocks.query.mockImplementation(async (sql: string) => ({ rows: sql.includes("FROM product_update_observation_items") ? [{ body: "Added [project templates](https://example.com) to the Hub." }] : [] }));
  const result = await getLatestUpdates(true);
  expect(result["editor-tools"].item?.summary).toBe("Added project templates to the Hub.");
  const [sql, params] = mocks.query.mock.calls.find(([sql]) => sql.includes("FROM product_update_observation_items"))!;
  expect(params).toEqual([42]);
  expect(sql).toContain("NOT IN ('known-issue', 'known_issue')");
  expect(sql).toContain("LIMIT 1");
});

test("product cards retain meaningful source summaries but omit generated counts when there are no changes", async () => {
  mocks.products.mockResolvedValue([{ id: 42, title: "Unity Hub 3.14", productName: "Unity Hub", releaseDate: null, summary: "11 documented changes across 5 sections." }]);
  let result = await getLatestUpdates(true);
  expect(result["editor-tools"].item?.summary).toBeUndefined();
  now += 300_000;
  mocks.products.mockResolvedValue([{ id: 42, title: "Unity Hub 3.14", productName: "Unity Hub", releaseDate: null, summary: "Added project templates." }]);
  result = await getLatestUpdates(true);
  expect(result["editor-tools"].item?.summary).toBe("Added project templates.");
});

test("release teasers hide legacy LTS when modern LTS exists, with a legacy fallback", async () => {
  await getLatestUpdates(false);
  const sql = mocks.query.mock.calls.find(([sql]) => sql.includes("FROM unity_releases"))![0];
  expect(sql).toContain("stream <> 'LTS'");
  expect(sql).toContain("OR NOT EXISTS");
  expect(sql).toContain("modern_lts.stream = 'LTS'");
  expect(sql).toContain("modern_lts.version");
  expect(sql).toContain(">= 6000");
});


test("warm homepage visits reuse each source, then refresh after five minutes", async () => {
  await getLatestUpdates(false);
  const queryCount = mocks.query.mock.calls.length;
  await getLatestUpdates(false);
  expect(mocks.query).toHaveBeenCalledTimes(queryCount);
  expect(mocks.news).toHaveBeenCalledTimes(1);
  now += 300_000;
  await getLatestUpdates(false);
  expect(mocks.query).toHaveBeenCalledTimes(queryCount * 2);
  expect(mocks.news).toHaveBeenCalledTimes(2);
});

test("failed sources retry while healthy sources stay cached", async () => {
  mocks.news.mockRejectedValueOnce(new Error("temporary outage"));
  expect((await getLatestUpdates(false)).news.unavailable).toBe(true);
  mocks.news.mockResolvedValue([{ title: "Recovered", published_at: null }]);
  expect((await getLatestUpdates(false)).news.item?.title).toBe("Recovered");
  expect(mocks.news).toHaveBeenCalledTimes(2);
  expect(mocks.resources).toHaveBeenCalledTimes(1);
});

test("enabling products after a warm disabled visit loads their own cache entries", async () => {
  await getLatestUpdates(false);
  await getLatestUpdates(true);
  expect(mocks.products).toHaveBeenCalledTimes(2);
  expect(mocks.news).toHaveBeenCalledTimes(1);
});

test("refresh timestamp is shared across visits and expires after five minutes", async () => {
  const { lastDataUpdate } = await import("../../src/lib/last-data-update");
  mocks.query.mockResolvedValue({ rows: [{ updated_at: "2026-10-25T10:00:00Z" }] });
  expect(await lastDataUpdate()).toBe("2026-10-25T10:00:00.000Z");
  expect(await lastDataUpdate()).toBe("2026-10-25T10:00:00.000Z");
  expect(mocks.query).toHaveBeenCalledTimes(1);
  now += 300_000;
  mocks.query.mockResolvedValue({ rows: [{ updated_at: "2026-10-25T10:05:00Z" }] });
  expect(await lastDataUpdate()).toBe("2026-10-25T10:05:00.000Z");
  expect(mocks.query).toHaveBeenCalledTimes(2);
});
