import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Stub the pg client layer so resolveDiffRange / diffRangeCounts /
// searchReleaseNotesInRange can be exercised without a database.
const mocks = vi.hoisted(() => ({
  query: vi.fn()
}));

vi.mock("../../src/lib/db/client", () => ({
  query: mocks.query,
  getPool: vi.fn()
}));

import {
  diffRangeCounts,
  resolveDiffRange,
  searchReleaseNotesInRange
} from "../../src/lib/db/repositories";

type Row = Record<string, unknown>;

function rows<T extends Row>(...records: T[]) {
  return { rows: records, rowCount: records.length };
}

beforeEach(() => {
  mocks.query.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─── resolveDiffRange ──────────────────────────────────────────

describe("resolveDiffRange", () => {
  test("returns null when either endpoint isn't in the index", async () => {
    mocks.query.mockResolvedValueOnce(rows({ version: "6000.3.14f1", release_date: "2026-04-22T00:00:00Z", stream: "LTS", minor_line: "6000.3" }));
    const result = await resolveDiffRange("missing", "6000.3.14f1", ["LTS"]);
    expect(result).toBeNull();
  });

  test("short-circuits to an empty range when no streams are allowed", async () => {
    mocks.query.mockResolvedValueOnce(
      rows(
        { version: "6000.0.59f2", release_date: "2025-10-08T00:00:00Z", stream: "LTS", minor_line: "6000.0" },
        { version: "6000.0.74f1", release_date: "2026-04-29T00:00:00Z", stream: "LTS", minor_line: "6000.0" }
      )
    );
    const result = await resolveDiffRange("6000.0.59f2", "6000.0.74f1", []);
    expect(result).not.toBeNull();
    expect(result!.versions).toEqual([]);
    expect(result!.includedStreams).toEqual([]);
    // We should not have run the second SELECT (the in-range query).
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });

  test("passes the supplied stream list and the computed minor-line range to SQL", async () => {
    mocks.query
      .mockResolvedValueOnce(
        rows(
          { version: "6000.0.30f1", release_date: "2025-01-01T00:00:00Z", stream: "LTS", minor_line: "6000.0" },
          { version: "6000.5.0b6", release_date: "2026-04-30T00:00:00Z", stream: "beta", minor_line: "6000.5" }
        )
      )
      .mockResolvedValueOnce(rows({ version: "6000.3.14f1" }, { version: "6000.4.5f1" }));

    const result = await resolveDiffRange("6000.0.30f1", "6000.5.0b6", ["LTS", "Update/Supported"]);
    expect(result?.versions).toEqual(["6000.3.14f1", "6000.4.5f1"]);
    expect(result?.includedStreams).toEqual(["LTS", "Update/Supported"]);
    expect(result?.includedMinorLines).toEqual([
      "6000.0",
      "6000.1",
      "6000.2",
      "6000.3",
      "6000.4",
      "6000.5"
    ]);

    // Second call is the range scan; verify the params it sends.
    // resolveDiffRange passes the release_date strings through unchanged,
    // so the assertion uses whatever shape the test supplied above.
    const [, params] = mocks.query.mock.calls[1];
    expect(params).toEqual([
      "2025-01-01T00:00:00Z",
      "2026-04-30T00:00:00Z",
      ["LTS", "Update/Supported"],
      ["6000.0", "6000.1", "6000.2", "6000.3", "6000.4", "6000.5"]
    ]);
  });

  test("flips lower/upper bounds when from > to and marks the result reversed", async () => {
    mocks.query
      .mockResolvedValueOnce(
        rows(
          // from is NEWER than to → caller is downgrading
          { version: "6000.3.14f1", release_date: "2026-04-22T00:00:00Z", stream: "LTS", minor_line: "6000.3" },
          { version: "6000.3.13f1", release_date: "2026-04-08T00:00:00Z", stream: "LTS", minor_line: "6000.3" }
        )
      )
      .mockResolvedValueOnce(rows({ version: "6000.3.14f1" }));

    const result = await resolveDiffRange("6000.3.14f1", "6000.3.13f1", ["LTS"]);
    expect(result?.reversed).toBe(true);

    const [, params] = mocks.query.mock.calls[1];
    // Lower (param 1) should be the older date, upper (param 2) the newer.
    expect(params[0]).toBe("2026-04-08T00:00:00Z");
    expect(params[1]).toBe("2026-04-22T00:00:00Z");
  });
});

// ─── diffRangeCounts ──────────────────────────────────────────

describe("diffRangeCounts", () => {
  test("returns zeroes when no versions are supplied (no DB hit)", async () => {
    const counts = await diffRangeCounts([]);
    expect(counts.totalNotes).toBe(0);
    expect(counts.byImpact).toEqual({});
    expect(counts.blockerKnownIssues).toBe(0);
    expect(counts.topPlatforms).toEqual([]);
    expect(counts.topAreas).toEqual([]);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  test("aggregates impact counts and the blocker subcount in parallel", async () => {
    // Order matches Promise.all in diffRangeCounts:
    // [impactResult, blockerResult, platformResult, areaResult]
    mocks.query
      .mockResolvedValueOnce(rows(
        { impact_kind: "fix", count: "100" },
        { impact_kind: "breaking_change", count: "5" },
        { impact_kind: "known_issue", count: "20" }
      ))
      .mockResolvedValueOnce(rows({ count: "3" }))
      .mockResolvedValueOnce(rows(
        { platform: "WebGL", count: "12" },
        { platform: "iOS", count: "7" }
      ))
      .mockResolvedValueOnce(rows(
        { area: "Graphics", count: "9" }
      ));

    const counts = await diffRangeCounts(["v1", "v2"]);
    expect(counts.totalNotes).toBe(125);
    expect(counts.byImpact).toEqual({ fix: 100, breaking_change: 5, known_issue: 20 });
    expect(counts.blockerKnownIssues).toBe(3);
    expect(counts.topPlatforms).toEqual([
      { platform: "WebGL", count: 12 },
      { platform: "iOS", count: 7 }
    ]);
    expect(counts.topAreas).toEqual([{ area: "Graphics", count: 9 }]);
  });

  test("appends a platform filter to the impact / blocker / area queries when supplied", async () => {
    mocks.query
      .mockResolvedValueOnce(rows({ impact_kind: "fix", count: "1" }))
      .mockResolvedValueOnce(rows({ count: "0" }))
      .mockResolvedValueOnce(rows())
      .mockResolvedValueOnce(rows());

    await diffRangeCounts(["v1"], "WebGL");
    const [impactSql, impactParams] = mocks.query.mock.calls[0];
    expect(impactSql).toContain("$2 = ANY(platforms)");
    expect(impactParams).toEqual([["v1"], "WebGL"]);

    // Platform breakdown query never filters by the same platform - it
    // reports counts for ALL platforms in the range so the dropdown can
    // populate.
    const [platformSql, platformParams] = mocks.query.mock.calls[2];
    expect(platformSql).not.toContain("$2 = ANY(platforms)");
    expect(platformParams).toEqual([["v1"]]);
  });
});

// ─── searchReleaseNotesInRange ────────────────────────────────

describe("searchReleaseNotesInRange", () => {
  test("returns immediately for an empty version list (no DB hit)", async () => {
    const out = await searchReleaseNotesInRange([], {});
    expect(out).toEqual([]);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  test("filters by the supplied version array and limit", async () => {
    mocks.query.mockResolvedValueOnce(rows({ id: 1, version: "v1" }, { id: 2, version: "v2" }));
    const out = await searchReleaseNotesInRange(["v1", "v2"], {}, 50);
    expect(out).toHaveLength(2);

    const [sql, params] = mocks.query.mock.calls[0];
    expect(sql).toContain("version = ANY($");
    expect(params).toContain(50);
    expect(params.some((v: unknown) => Array.isArray(v) && (v as string[]).includes("v1"))).toBe(
      true
    );
  });

  test("layers additional filters on top of the version-array clause", async () => {
    mocks.query.mockResolvedValueOnce(rows());
    await searchReleaseNotesInRange(["v1"], { impactKind: "breaking_change", platform: "WebGL" }, 25);

    const [sql, params] = mocks.query.mock.calls[0];
    expect(sql).toContain("impact_kind = $");
    expect(sql).toContain("$1 = ANY(platforms)");
    expect(params).toContain("breaking_change");
    expect(params).toContain("WebGL");
  });
});
