import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({ repos: vi.fn(), posts: vi.fn(), updates: vi.fn(), count: vi.fn() }));
vi.mock("@/lib/db/repositories", () => ({
  listGithubRepos: mocks.repos,
  listDiscoursePosts: mocks.posts,
  listGithubRepoFacets: async () => ({ languages: [], topics: [] }),
  getReposLatestActivity: async () => new Map(),
  getGithubStats: async () => ({ activeRepos: 0, totalStars: 0, notableRepos: 0, languages: 0 }),
  listDiscourseFilterFacets: async () => ({ categories: [], tags: [], authors: [] }),
  getDiscoursePostStats: async () => ({ totalPosts: 0, editedPosts: 0, deletedPosts: 0, trackedStaff: 0, activeStaff: 0, trackedCategories: 0 })
}));
vi.mock("@/lib/product-updates/repositories", () => ({
  productUpdatesSchemaReady: async () => true,
  listUnityProducts: async () => [],
  listProductUpdates: mocks.updates,
  countProductUpdates: mocks.count
}));
import GithubPage from "@/app/github/page";
import DiscussionsPage from "@/app/discussions/page";
import { loadProductUpdates } from "@/app/updates/_data";

beforeEach(() => { vi.clearAllMocks(); });
describe("list paging and failures", () => {
  for (const [name, component, query] of [["repositories", GithubPage, mocks.repos], ["staff discussions", DiscussionsPage, mocks.posts]] as const) {
    it(`${name} clamps stale page links and fetches the last available page`, async () => {
      query.mockResolvedValue({ items: [], total: 31 });
      const html = renderToStaticMarkup(await component({ searchParams: Promise.resolve({ page: "999", q: "render" }) }));
      expect(query).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, q: "render" }));
      expect(html).not.toContain("29,941");
      expect(html).toContain("31–31");
    });
    it(`${name} distinguishes a failed request from empty data`, async () => {
      query.mockRejectedValue(new Error("offline"));
      const html = renderToStaticMarkup(await component({ searchParams: Promise.resolve({}) }));
      expect(html).toContain("Could not load");
      expect(html).not.toContain("indexed yet");
    });
  }
  it("product updates refetch the last page without dropping filters", async () => {
    mocks.count.mockResolvedValue(41);
    mocks.updates.mockResolvedValue([]);
    const result = await loadProductUpdates({ page: 999, limit: 40, product: "unity-hub", channel: "stable" });
    expect(result?.page).toBe(2);
    expect(mocks.updates).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 40, product: "unity-hub", channel: "stable" }));
  });
});
