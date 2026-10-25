import { afterEach, describe, expect, test, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { VersionPill } from "../../src/app/_components/VersionPill";
import { formatReleaseDate } from "../../src/lib/format-date";
import TimelinePage from "../../src/app/timeline/page";
import PackagesPage from "../../src/app/packages/page";
import { listTimelineFeed, listPackages } from "../../src/lib/db/repositories";

vi.mock("../../src/lib/db/repositories", () => ({
  listTimelineFeed: vi.fn(async () => []),
  listPackages: vi.fn(async () => []),
  getEditorBundledVersions: vi.fn(async () => new Map())
}));
vi.mock("../../src/lib/user-packages", () => ({ getUserPackages: vi.fn(async () => []) }));
vi.mock("../../src/app/_components/SidebarUserPackages", () => ({ SidebarUserPackages: () => null }));

afterEach(() => { vi.clearAllMocks(); });

describe("data presentation audit", () => {
  test("unknown streams do not claim a supported release marker", () => {
    for (const version of ["6000.0.1f1", "6000.7.0b1", "6000.8.0a1"]) {
      const html = renderToStaticMarkup(<VersionPill version={version} />);
      expect(html).not.toContain("data-stream");
      expect(html).toContain(version);
    }
    expect(renderToStaticMarkup(<VersionPill version="6000.7.0b1" stream="beta" hoverCard={false} />)).toContain('data-stream="B"');
  });

  test("publication dates have identical UTC calendar dates in all environments", () => {
    const original = process.env.TZ;
    try {
      for (const tz of ["America/Los_Angeles", "UTC", "Asia/Tokyo"]) {
        process.env.TZ = tz;
        expect(formatReleaseDate("2026-10-24T00:30:00Z")).toBe("Oct 24, 2026");
        expect(formatReleaseDate(new Date("2026-10-24T23:30:00Z"))).toBe("Oct 24, 2026");
      }
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });

  test("timeline accepts repeated query parameters", async () => {
    const html = renderToStaticMarkup(await TimelinePage({ searchParams: Promise.resolve({ q: ["first", "second"], filter: ["content", "system"] }) }));
    expect(html).toContain('value="first"');
    expect(html).toContain("No activity logs found");
  });

  test("timeline database failures show a retry preserving query filters", async () => {
    vi.mocked(listTimelineFeed).mockRejectedValueOnce(new Error("Database unavailable"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const html = renderToStaticMarkup(await TimelinePage({ searchParams: Promise.resolve({ q: "test", filter: "failures" }) }));
      expect(html).toContain('role="alert"');
      expect(html).toContain("Could not load activity.");
      expect(html).toContain('/timeline?q=test&amp;filter=failures');
      expect(html).not.toContain("No activity logs found");
    } finally { log.mockRestore(); }
  });

  test("packages without indexed versions are unknown and excluded from stable filters", async () => {
    vi.mocked(listPackages).mockResolvedValue([
      { name: "com.unity.unknown", display_name: "Unknown package", source_url: "https://packages.unity.com/com.unity.unknown", latest_version: null, latest_is_prerelease: null },
      { name: "com.unity.stable", display_name: "Stable package", source_url: "https://packages.unity.com/com.unity.stable", latest_version: "1.0.0", latest_is_prerelease: false },
      { name: "com.unity.preview", display_name: "Preview package", source_url: "https://packages.unity.com/com.unity.preview", latest_version: "2.0.0-pre.1", latest_is_prerelease: true }
    ]);
    const all = renderToStaticMarkup(await PackagesPage({ searchParams: Promise.resolve({}) }));
    expect(all).toMatch(/data-label="Channel"><span class="muted text-xs">Unknown<\/span>/);
    const stable = renderToStaticMarkup(await PackagesPage({ searchParams: Promise.resolve({ channel: "stable" }) }));
    expect(stable).toContain("Stable package");
    expect(stable).not.toContain("Unknown package");
    expect(stable).not.toContain("Preview package");
    const preview = renderToStaticMarkup(await PackagesPage({ searchParams: Promise.resolve({ channel: "prerelease" }) }));
    expect(preview).toContain("Preview package");
    expect(preview).not.toContain("Unknown package");
    expect(preview).not.toContain("Stable package");
  });
});
