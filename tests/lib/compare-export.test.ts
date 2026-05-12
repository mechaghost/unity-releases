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

  test("accepts patch-channel (p) versions on legacy LTS lines", async () => {
    // 2020.3.48p1 etc. are valid Unity LTS patch releases. The regex
    // must accept `[abfp]`, not just `[abf]`.
    const result = await buildCompareMarkdownExport(
      new URLSearchParams({ from: "2020.3.48p1", to: "2020.3.49p1" })
    );

    // Rejected on resolveDiffRange (mock returns undefined) — but the
    // regex check must pass first, so the failure should be
    // `range-not-found`, not `invalid-versions`.
    expect(result).toMatchObject({ ok: false, error: "range-not-found" });
    expect(mocks.resolveDiffRange).toHaveBeenCalledTimes(1);
  });
});
