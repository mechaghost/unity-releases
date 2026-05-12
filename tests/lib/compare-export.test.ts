import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveDiffRange: vi.fn(),
  getIssueStatuses: vi.fn(),
  searchReleaseNotesInRange: vi.fn()
}));

vi.mock("@/lib/db/repositories", () => ({
  resolveDiffRange: mocks.resolveDiffRange,
  getIssueStatuses: mocks.getIssueStatuses,
  searchReleaseNotesInRange: mocks.searchReleaseNotesInRange
}));

import { buildCompareMarkdownExport } from "@/lib/compare-export";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildCompareMarkdownExport", () => {
  test("rejects malformed editor version shapes before querying", async () => {
    const result = await buildCompareMarkdownExport(
      new URLSearchParams({ from: "foo.bar.baz", to: "6000.0.74f1" })
    );

    expect(result).toMatchObject({ ok: false, error: "invalid-versions" });
    expect(mocks.resolveDiffRange).not.toHaveBeenCalled();
  });

  test("rejects pre-Unity-6 versions outside the indexed LTS lines", async () => {
    // 2018 is older than our indexed legacy LTS range (2019-2022) so
    // the regex should still reject it even though its shape is
    // otherwise well-formed.
    const result = await buildCompareMarkdownExport(
      new URLSearchParams({ from: "2018.4.36f1", to: "2018.4.40f1" })
    );

    expect(result).toMatchObject({ ok: false, error: "invalid-versions" });
    expect(mocks.resolveDiffRange).not.toHaveBeenCalled();
  });

  test("rejects cross-major comparisons before any DB work", async () => {
    const result = await buildCompareMarkdownExport(
      new URLSearchParams({ from: "2022.3.50f1", to: "6000.0.74f1" })
    );

    expect(result).toMatchObject({ ok: false, error: "cross-major" });
    expect(mocks.resolveDiffRange).not.toHaveBeenCalled();
  });

  test("rejects overly wide ranges before lane fan-out", async () => {
    mocks.resolveDiffRange.mockResolvedValueOnce({
      reversed: false,
      includedStreams: ["LTS"],
      includedMinorLines: ["6000.0"],
      versions: Array.from({ length: 201 }, (_, i) => `6000.0.${i}f1`)
    });

    const result = await buildCompareMarkdownExport(
      new URLSearchParams({ from: "6000.0.1f1", to: "6000.0.201f1" })
    );

    expect(result).toMatchObject({ ok: false, error: "range-too-wide" });
    expect(mocks.searchReleaseNotesInRange).not.toHaveBeenCalled();
    expect(mocks.getIssueStatuses).not.toHaveBeenCalled();
  });
});
