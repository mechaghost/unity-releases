import { beforeEach, expect, test, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  listIssueHistory: vi.fn(), listResources: vi.fn(), listLatestBlogPosts: vi.fn(),
  listPackages: vi.fn(), getEditorBundledVersions: vi.fn(), getUserPackages: vi.fn(),
  searchReleaseNotes: vi.fn(), listReleaseNoteFacets: vi.fn(), getIssueStatuses: vi.fn()
}));
vi.mock("@/lib/db/repositories", () => mocks);
vi.mock("@/lib/user-packages", () => ({ getUserPackages: mocks.getUserPackages }));
vi.mock("@/app/_components/SidebarUserPackages", () => ({ SidebarUserPackages: () => null }));
vi.mock("@/app/_components/PackageRowClient", () => ({ PackageRowClient: () => null }));
vi.mock("@/app/_components/ResourcesFilter", () => ({ ResourcesFilter: () => null }));
vi.mock("@/app/_components/PackagesFilter", () => ({ PackagesFilter: () => null }));
vi.mock("@/app/_components/IssuePill", () => ({ issueTrackerHref: (id: string) => `https://example.test/${id}` }));
vi.mock("@/app/_components/NoteRow", () => ({ NoteRow: () => <article data-note="true" /> }));

import IssuePage from "@/app/issues/[issueId]/page";
import ResourcesPage from "@/app/resources/page";
import NewsPage from "@/app/news/page";
import PackagesPage from "@/app/packages/page";
import ExplorerPage from "@/app/explorer/page";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUserPackages.mockResolvedValue([]);
  mocks.getEditorBundledVersions.mockResolvedValue(new Map());
  mocks.getIssueStatuses.mockResolvedValue(new Map());
  mocks.listReleaseNoteFacets.mockResolvedValue({ versions: [], minor_lines: [], streams: [], sections: [], areas: [], platforms: [], impacts: [], risks: [], packages: [] });
});

test("search recovers a stale page and preserves repeated filter links", async () => {
  const makeRows = (count: number) => Array.from({ length: count }, (_, id) => ({
    id, version: "6000.0.1f1", section: "Fixes", body: "Fix", total_count: "155", issue_ids: []
  }));
  mocks.searchReleaseNotes.mockResolvedValueOnce([]).mockResolvedValueOnce(makeRows(100)).mockResolvedValueOnce(makeRows(55));
  const html = renderToStaticMarkup(await ExplorerPage({ searchParams: Promise.resolve({ page: "999", risk: ["info", "caution"] }) }));
  expect(mocks.searchReleaseNotes.mock.calls.map(([filters]) => filters.offset)).toEqual([99800, 0, 100]);
  expect(html).toContain("155");
  expect(html).toContain("Page 2 of 2");
  expect(html).toContain("risk=info&amp;risk=caution");
  expect(html.match(/data-note="true"/g)).toHaveLength(55);
});

test("issue status/count/scopes use older mentions beyond the displayed page", async () => {
  const mentions = Array.from({ length: 154 }, (_, i) => ({
    id: i, version: "6000.0.2f1", section: "Fixes", area: "Editor", body: `Recent fix ${i}`,
    impact_kind: "fix", risk_level: "info", release_date: "2026-07-15"
  }));
  mentions.push({ ...mentions[0], id: 155, version: "2022.3.1f1", body: "Earliest legacy fix", release_date: "2025-01-01" });
  mocks.listIssueHistory.mockResolvedValue(mentions);
  const render = async (page: string, major?: string) => renderToStaticMarkup(await IssuePage({
    params: Promise.resolve({ issueId: "UUM-123124" }), searchParams: Promise.resolve({ page, major })
  }));
  const first = await render("1");
  const second = await render("2");
  for (const html of [first, second]) {
    expect(html).toContain("Mentioned in 155 release notes.");
    expect(html).toContain("First fixed in 2022.3.1f1");
    expect(html).toContain("?major=2022");
  }
  expect(first).not.toContain("Earliest legacy fix");
  expect(second).toContain("Earliest legacy fix");
  expect(second).toContain("Page 2 of 2");
  expect(await render("2", "2022")).toContain("Earliest legacy fix");
});

test("resources paging preserves repeated types and clamps stale pages", async () => {
  mocks.listResources.mockResolvedValue({ rows: [], total: 205 });
  const html = renderToStaticMarkup(await ResourcesPage({ searchParams: Promise.resolve({
    type: ["Article", "Video"], q: "audit", page: "999"
  }) }));
  expect(mocks.listResources.mock.calls.at(-1)?.[0]).toMatchObject({ offset: 200, types: ["Article", "Video"] });
  expect(html).toContain("Page 2 of 2");
  expect(html).toContain("type=Article&amp;type=Video&amp;q=audit");
});

test("repeated package search values do not crash", async () => {
  mocks.listPackages.mockResolvedValue([]);
  const html = renderToStaticMarkup(await PackagesPage({ searchParams: Promise.resolve({ q: ["input", "ignored"] }) }));
  expect(html).toContain("All Packages");
});

test("database failures are visible rather than empty-content claims", async () => {
  const failure = new Error("private database detail");
  mocks.listIssueHistory.mockRejectedValue(failure);
  mocks.listResources.mockRejectedValue(failure);
  mocks.listLatestBlogPosts.mockRejectedValue(failure);
  mocks.listPackages.mockRejectedValue(failure);
  const outputs = [
    await IssuePage({ params: Promise.resolve({ issueId: "UUM-123124" }) }),
    await ResourcesPage({ searchParams: Promise.resolve({ q: "keep-me" }) }),
    await NewsPage(),
    await PackagesPage({ searchParams: Promise.resolve({ q: "keep-me" }) })
  ];
  for (const output of outputs) {
    const html = renderToStaticMarkup(output);
    expect(html).toContain('role="alert"');
    expect(html).toContain("Try again");
    expect(html).not.toContain("private database detail");
    expect(html).not.toContain("No news indexed yet");
    expect(html).not.toContain("No resources match");
  }
});

test("unknown issue URLs return not found instead of an indexable empty page", async () => {
  mocks.listIssueHistory.mockResolvedValue([]);
  await expect(IssuePage({ params: Promise.resolve({ issueId: "UUM-999999999" }) })).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
  await expect(IssuePage({ params: Promise.resolve({ issueId: "UUM-NOT-REAL" }) })).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
});

test("filtered package pages are noindex but the main package index remains indexable", async () => {
  const { generateMetadata } = await import("@/app/packages/page");
  expect((await generateMetadata({ searchParams: Promise.resolve({ q: "nuget.castle-core" }) })).robots).toMatchObject({ index: false, googleBot: { index: false } });
  expect((await generateMetadata({ searchParams: Promise.resolve({}) })).robots).toMatchObject({ index: true });
});
