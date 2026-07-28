import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listReleaseSummaries: vi.fn(),
  listTopIssueIds: vi.fn(),
  getTrackedVersionLines: vi.fn(),
  listProductUpdateSitemapEntries: vi.fn()
}));

vi.mock("../../src/lib/db/repositories", () => ({
  listReleaseSummaries: mocks.listReleaseSummaries,
  listTopIssueIds: mocks.listTopIssueIds,
  getTrackedVersionLines: mocks.getTrackedVersionLines
}));

vi.mock("../../src/lib/product-updates/repositories", () => ({
  listProductUpdateSitemapEntries: mocks.listProductUpdateSitemapEntries
}));

import sitemap from "../../src/app/sitemap";
import { GET as getLlms } from "../../src/app/llms.txt/route";

beforeEach(() => {
  mocks.listReleaseSummaries.mockReset().mockResolvedValue([]);
  mocks.listTopIssueIds.mockReset().mockResolvedValue([]);
  mocks.getTrackedVersionLines.mockReset().mockResolvedValue([
    {
      minorLine: "6000.0",
      latestVersion: "6000.0.2f1",
      stream: "LTS",
      releaseCount: 2
    }
  ]);
  mocks.listProductUpdateSitemapEntries.mockReset().mockResolvedValue({
    products: [
      {
        slug: "unity-hub",
        updatedAt: "2026-07-28T00:00:00.000Z"
      }
    ],
    updates: [
      {
        productSlug: "unity-hub",
        updateSlug: "3.14.0",
        updatedAt: "2026-07-28T00:00:00.000Z"
      }
    ]
  });
  delete process.env.PRODUCT_UPDATE_UI_ENABLED;
  delete process.env.PRODUCT_UPDATE_NAV_ENABLED;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("Product Updates discoverability", () => {
  test("leaves the original sitemap and LLM manifest unchanged by default", async () => {
    const urls = (await sitemap()).map((entry) => entry.url);
    const llms = await (await getLlms()).text();

    expect(urls.some((url) => url.includes("/updates"))).toBe(false);
    expect(llms).not.toContain("## Secondary product intelligence");
    expect(mocks.listProductUpdateSitemapEntries).not.toHaveBeenCalled();
  });

  test("adds family and stable detail routes only when public navigation is enabled", async () => {
    process.env.PRODUCT_UPDATE_UI_ENABLED = "true";
    process.env.PRODUCT_UPDATE_NAV_ENABLED = "true";

    const urls = (await sitemap()).map((entry) => new URL(entry.url).pathname);
    const llms = await (await getLlms()).text();

    expect(urls).toEqual(
      expect.arrayContaining([
        "/updates",
        "/updates/editor-tooling",
        "/updates/platform-services",
        "/updates/monetization",
        "/updates/industry-enterprise",
        "/updates/products/unity-hub",
        "/updates/products/unity-hub/3.14.0"
      ])
    );
    expect(llms).toContain("## Secondary product intelligence");
    expect(llms).toContain("/api/events?scope=product-updates");
  });
});
