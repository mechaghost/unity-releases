import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// vi.hoisted lets the mock object live above the vi.mock factories so
// individual tests can rewrite the spy return values without redefining
// the module mock.
const repo = vi.hoisted(() => ({
  listReleases: vi.fn(),
  listTopIssueIds: vi.fn()
}));

vi.mock("@/lib/db/repositories", () => ({
  listReleases: repo.listReleases,
  listTopIssueIds: repo.listTopIssueIds
}));

import sitemap from "../../src/app/sitemap";

beforeEach(() => {
  repo.listReleases.mockReset();
  repo.listTopIssueIds.mockReset();
  delete process.env.NEXT_PUBLIC_SITE_URL;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("sitemap", () => {
  test("renders the static surface pages with no /upgrade or /explorer", async () => {
    repo.listReleases.mockResolvedValue([]);
    repo.listTopIssueIds.mockResolvedValue([]);
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls).toEqual(
      expect.arrayContaining([
        "https://unityreleases.com/",
        "https://unityreleases.com/compare",
        "https://unityreleases.com/releases",
        "https://unityreleases.com/packages",
        "https://unityreleases.com/resources",
        "https://unityreleases.com/news",
        "https://unityreleases.com/faq"
      ])
    );
    expect(urls).not.toContain("https://unityreleases.com/upgrade");
    expect(urls).not.toContain("https://unityreleases.com/explorer");
  });

  test("appends one entry per release version returned by listReleases", async () => {
    repo.listReleases.mockResolvedValue([
      { version: "6000.3.15f1", release_date: "2026-05-08T05:39:58.493Z" },
      { version: "6000.5.0b7", release_date: "2026-05-07T14:14:10.613Z" }
    ]);
    repo.listTopIssueIds.mockResolvedValue([]);
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls).toContain("https://unityreleases.com/releases/6000.3.15f1");
    expect(urls).toContain("https://unityreleases.com/releases/6000.5.0b7");
    const releaseEntry = entries.find(
      (e) => e.url === "https://unityreleases.com/releases/6000.3.15f1"
    );
    expect(releaseEntry?.lastModified).toBeInstanceOf(Date);
    expect((releaseEntry?.lastModified as Date).toISOString()).toBe(
      "2026-05-08T05:39:58.493Z"
    );
  });

  test("includes top issues as /issues/<id> entries", async () => {
    repo.listReleases.mockResolvedValue([]);
    repo.listTopIssueIds.mockResolvedValue(["UUM-12345", "UUM-67890"]);
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls).toContain("https://unityreleases.com/issues/UUM-12345");
    expect(urls).toContain("https://unityreleases.com/issues/UUM-67890");
  });

  test("falls back to static + (where available) release entries when issue lookup fails", async () => {
    repo.listReleases.mockResolvedValue([
      { version: "6000.3.15f1", release_date: null }
    ]);
    repo.listTopIssueIds.mockRejectedValue(new Error("db down"));
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    // Release page still gets indexed.
    expect(urls).toContain("https://unityreleases.com/releases/6000.3.15f1");
    // Static surfaces still present.
    expect(urls).toContain("https://unityreleases.com/faq");
    // No issue URLs leaked through despite the failure.
    expect(urls.some((u) => u.includes("/issues/"))).toBe(false);
  });

  test("falls back to static entries when listReleases throws", async () => {
    repo.listReleases.mockRejectedValue(new Error("db down"));
    repo.listTopIssueIds.mockResolvedValue(["UUM-12345"]);
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    // No releases or issues - we bailed early.
    expect(urls.some((u) => u.includes("/releases/"))).toBe(false);
    expect(urls.some((u) => u.includes("/issues/"))).toBe(false);
    // Static surfaces still present.
    expect(urls).toContain("https://unityreleases.com/compare");
  });

  test("honors NEXT_PUBLIC_SITE_URL so staging builds emit the right origin", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://staging.unityreleases.com";
    repo.listReleases.mockResolvedValue([
      { version: "6000.3.15f1", release_date: null }
    ]);
    repo.listTopIssueIds.mockResolvedValue(["UUM-1"]);
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls).toContain("https://staging.unityreleases.com/");
    expect(urls).toContain("https://staging.unityreleases.com/releases/6000.3.15f1");
    expect(urls).toContain("https://staging.unityreleases.com/issues/UUM-1");
  });
});
