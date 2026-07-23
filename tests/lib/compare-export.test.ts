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

import { buildCompareMarkdownExport, isComparableVersion } from "@/lib/compare-export";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isComparableVersion", () => {
  test("accepts every generation of the modern scheme", () => {
    // /llms.txt documents from/to as "one of the indexed editor lines listed
    // above", and that list is generated from the DB. A hardcoded 6000 here
    // would 400 exactly the diffs the manifest advertises once Unity 7 ships -
    // including the 6000.7 -> 7000.0 transition diff.
    expect(isComparableVersion("6000.0.74f1")).toBe(true);
    expect(isComparableVersion("6000.7.0f1")).toBe(true);
    expect(isComparableVersion("7000.0.0f1")).toBe(true);
    expect(isComparableVersion("7000.12.3f1")).toBe(true);
    expect(isComparableVersion("8000.0.0a1")).toBe(true);
  });

  test("accepts the indexed legacy LTS majors and their patch channel", () => {
    expect(isComparableVersion("2022.3.40f1")).toBe(true);
    expect(isComparableVersion("2020.3.48p1")).toBe(true);
    expect(isComparableVersion("2019.4.40f1")).toBe(true);
  });

  test("rejects legacy majors we do not index, and malformed input", () => {
    expect(isComparableVersion("2023.2.20f1")).toBe(false);
    expect(isComparableVersion("2018.4.36f1")).toBe(false);
    expect(isComparableVersion("6000.0.74")).toBe(false);
    expect(isComparableVersion("not-a-version")).toBe(false);
    expect(isComparableVersion("")).toBe(false);
    expect(isComparableVersion("6000.0.74f1; DROP TABLE")).toBe(false);
  });
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
