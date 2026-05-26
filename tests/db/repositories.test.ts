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
  getIssueStatuses,
  packageVersionsAtBoundary,
  resolveDiffRange,
  searchReleaseNotesInRange,
  listTimelineFeed
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

  test("walks every intermediate minor line for cross-major ranges", async () => {
    // Regression guard for commit 9c6c51f. Before that fix, a cross-major
    // diff (e.g. 2019.4.x → 2022.3.x) short-circuited to just the two
    // endpoint minor lines, dropping every 2020.3 / 2021.3 release from
    // the diff window. The current implementation queries the DB for
    // every distinct minor_line in the major range; this test makes sure
    // we don't ever revert to the endpoint-pair shortcut.
    mocks.query
      // 1. endpoint lookup (versions = ANY)
      .mockResolvedValueOnce(
        rows(
          { version: "2019.4.40f1", release_date: "2021-06-01T00:00:00Z", stream: "LTS", minor_line: "2019.4" },
          { version: "2022.3.50f1", release_date: "2024-10-08T00:00:00Z", stream: "LTS", minor_line: "2022.3" }
        )
      )
      // 2. cross-major minor_line scan — returns the four legacy LTS lines
      //    that actually exist in the DB between major 2019 and 2022.
      .mockResolvedValueOnce(
        rows(
          { minor_line: "2019.4" },
          { minor_line: "2020.3" },
          { minor_line: "2021.3" },
          { minor_line: "2022.3" }
        )
      )
      // 3. range scan — content doesn't matter for this assertion
      .mockResolvedValueOnce(rows());

    const result = await resolveDiffRange("2019.4.40f1", "2022.3.50f1", ["LTS"]);
    // The intermediate minors MUST be present — without them the diff
    // window loses every 2020/2021 release.
    expect(result?.includedMinorLines).toEqual(["2022.3", "2021.3", "2020.3", "2019.4"]);

    // And the range-scan call must pass that same set into minor_line = ANY(...)
    // — without it the diff would still resolve to a 2019.4-only window.
    const [, scanParams] = mocks.query.mock.calls[2];
    expect(scanParams[3]).toEqual(["2022.3", "2021.3", "2020.3", "2019.4"]);
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

// ─── packageVersionsAtBoundary ────────────────────────────────

describe("packageVersionsAtBoundary", () => {
  test("includes the unity_compatibility tuple predicate when editor minors are supplied", async () => {
    // Regression guard for commit 3dddbdf. Without this predicate the
    // by-package lane recommends whatever package_version was published
    // most recently regardless of which editor it targets — e.g.
    // cinemachine 2.10.7 leaks into a 6000.x boundary because Unity
    // shipped a 2.x patch *after* 3.x branched. The predicate constrains
    // the candidate set to packages declared compatible with the editor
    // minor line the user actually picked.
    mocks.query.mockResolvedValueOnce(rows());
    await packageVersionsAtBoundary(
      ["com.unity.cinemachine"],
      "2024-01-01T00:00:00Z",
      "2026-04-29T00:00:00Z",
      { fromEditorMinor: "2022.3", toEditorMinor: "6000.3" }
    );

    const [sql, params] = mocks.query.mock.calls[0];
    // Tuple-compare predicate must be there for BOTH boundary subqueries.
    expect(sql).toContain("SPLIT_PART(pv.unity_compatibility, '.', 1)");
    expect(sql).toContain("NULLIF(SPLIT_PART(pv.unity_compatibility, '.', 2)");
    // The editor minor parameters land on $4 (from) and $5 (to) — the SQL
    // uses tuple comparison `<=`, so we just confirm the params arrive.
    expect(params[3]).toBe("2022.3");
    expect(params[4]).toBe("6000.3");
  });

  test("degrades the compat predicate to a no-op when editor minors are omitted", async () => {
    // Single-major /compare paths and any callers that don't have the
    // picker context still need a working query — the predicate must
    // become TRUE (via the `editorParam::text = ''` short-circuit)
    // rather than reject every row.
    mocks.query.mockResolvedValueOnce(rows());
    await packageVersionsAtBoundary(
      ["com.unity.inputsystem"],
      "2024-01-01T00:00:00Z",
      "2026-04-29T00:00:00Z"
    );

    const [sql, params] = mocks.query.mock.calls[0];
    // The empty-string short-circuit MUST appear so callers that omit
    // the option don't accidentally filter every package out.
    expect(sql).toContain("::text = ''");
    expect(params[3]).toBe("");
    expect(params[4]).toBe("");
  });

  test("returns immediately for an empty package list (no DB hit)", async () => {
    const out = await packageVersionsAtBoundary([], "2024-01-01", "2026-04-29");
    expect(out.size).toBe(0);
    expect(mocks.query).not.toHaveBeenCalled();
  });
});

// ─── getIssueStatuses ─────────────────────────────────────────

describe("getIssueStatuses", () => {
  test("drops mentions outside relevantMajors before deriving status", async () => {
    // Regression guard for commit 0258419 (compare) + 3dddbdf (issues
    // page). When a user is looking at a 2022.3 → 2022.3 range, a
    // UUM-xxxxx fix that shipped only on 6000.3 must NOT tag the issue
    // as "fixed" — the user can't reach that fix without a major
    // upgrade. Without the relevantMajors filter the function would
    // see the 6000.3 mention and call the issue resolved.
    mocks.query.mockResolvedValueOnce(
      rows(
        { issue_id: "UUM-113215", version: "2022.3.50f1", section: "Known Issues", release_date: "2024-10-08" },
        { issue_id: "UUM-113215", version: "6000.3.0b1", section: "Fixes", release_date: "2025-09-09" }
      )
    );

    const out = await getIssueStatuses(["UUM-113215"], {
      relevantMajors: new Set([2022])
    });

    const status = out.get("UUM-113215");
    expect(status?.kind).toBe("open"); // open, not "resolved"
    if (status?.kind === "open") {
      expect(status.version).toBe("2022.3.50f1");
    }
  });

  test("preserves global mention history when relevantMajors is omitted", async () => {
    // /releases/[version] uses the un-scoped form so an editor on a
    // specific version still sees Unity's authoritative status. This
    // guards against an accidental change that makes the filter
    // always-on.
    mocks.query.mockResolvedValueOnce(
      rows(
        { issue_id: "UUM-113215", version: "2022.3.50f1", section: "Known Issues", release_date: "2024-10-08" },
        { issue_id: "UUM-113215", version: "6000.3.0b1", section: "Fixes", release_date: "2025-09-09" }
      )
    );

    const out = await getIssueStatuses(["UUM-113215"]);
    expect(out.get("UUM-113215")?.kind).toBe("resolved");
  });

  test("returns an empty map for an empty id list (no DB hit)", async () => {
    const out = await getIssueStatuses([]);
    expect(out.size).toBe(0);
    expect(mocks.query).not.toHaveBeenCalled();
  });
});

// ─── listTimelineFeed ─────────────────────────────────────────

describe("listTimelineFeed", () => {
  test("groups same-type updates under a single scraper run and retrieves ingestion runs with their updates", async () => {
    // mock first call (content events)
    mocks.query.mockResolvedValueOnce(
      rows(
        {
          id: 1,
          event_type: "package_version",
          title: "Package A 1.0.0",
          summary: "Updated package A",
          event_time: "2026-05-26T10:00:00Z",
          source_url: "http://example.com/a",
          stable_guid: "guid-1",
          risk_level: null,
          tags: ["tag1"],
          ingestion_run_id: 101
        },
        {
          id: 2,
          event_type: "package_version",
          title: "Package B 2.0.0",
          summary: "Updated package B",
          event_time: "2026-05-26T10:05:00Z",
          source_url: "http://example.com/b",
          stable_guid: "guid-2",
          risk_level: null,
          tags: ["tag2"],
          ingestion_run_id: 101
        },
        {
          id: 3,
          event_type: "unity_release",
          title: "6000.0.1f1",
          summary: "New Unity Editor release",
          event_time: "2026-05-26T09:00:00Z",
          source_url: "http://example.com/unity",
          stable_guid: "guid-3",
          risk_level: "low",
          tags: [],
          ingestion_run_id: null
        }
      )
    );

    // mock second call (ingestion runs)
    mocks.query.mockResolvedValueOnce(
      rows({
        id: "101",
        source_type: "packages",
        job_name: "poll-packages",
        started_at: "2026-05-26T09:55:00Z",
        finished_at: "2026-05-26T10:06:00Z",
        status: "success",
        records_created: 2,
        records_updated: 0,
        records_deleted: 0,
        error_message: null
      })
    );

    // mock third call (updates for run IDs)
    mocks.query.mockResolvedValueOnce(
      rows(
        {
          id: 1,
          event_type: "package_version",
          title: "Package A 1.0.0",
          source_url: "http://example.com/a",
          ingestion_run_id: 101
        },
        {
          id: 2,
          event_type: "package_version",
          title: "Package B 2.0.0",
          source_url: "http://example.com/b",
          ingestion_run_id: 101
        }
      )
    );

    const result = await listTimelineFeed(10);

    // We expect:
    // 1. One grouped package event (from the 2 package_version content events under ingestion_run_id: 101)
    // 2. One ingestion event (for ingestion run 101)
    // 3. One single unity_release content event

    expect(mocks.query).toHaveBeenCalledTimes(3);

    // Check content events query parameters
    const [contentSql, contentParams] = mocks.query.mock.calls[0];
    expect(contentSql).toContain("FROM content_events");
    expect(contentParams).toEqual([20]);

    // Check ingestion runs query parameters
    const [ingestionSql, ingestionParams] = mocks.query.mock.calls[1];
    expect(ingestionSql).toContain("FROM ingestion_runs");
    expect(ingestionParams).toEqual([10]);

    // Check updates query parameters
    const [updatesSql, updatesParams] = mocks.query.mock.calls[2];
    expect(updatesSql).toContain("ingestion_run_id = ANY(");
    expect(updatesParams).toEqual([[101]]);

    expect(result).toHaveLength(3);

    const groupEvent = result[0];
    expect(groupEvent.type).toBe("content");
    expect(groupEvent.id).toBe("content-group-101-package_version");
    expect(groupEvent.eventType).toBe("package_version_group");
    expect(groupEvent.title).toBe("2 Packages Updated");
    expect(groupEvent.isGroup).toBe(true);
    expect(groupEvent.groupItems).toHaveLength(2);
    expect(groupEvent.groupItems![0].title).toBe("Package B 2.0.0");
    expect(groupEvent.groupItems![1].title).toBe("Package A 1.0.0");

    const ingestionEvent = result[1];
    expect(ingestionEvent.type).toBe("ingestion");
    expect(ingestionEvent.id).toBe("ingestion-101");
    expect(ingestionEvent.jobName).toBe("poll-packages");
    expect(ingestionEvent.updates).toHaveLength(2);
    expect(ingestionEvent.updates![0].title).toBe("Package A 1.0.0");

    const singleEvent = result[2];
    expect(singleEvent.type).toBe("content");
    expect(singleEvent.id).toBe("content-3");
    expect(singleEvent.eventType).toBe("unity_release");
    expect(singleEvent.title).toBe("6000.0.1f1");
    expect(singleEvent.riskLevel).toBe("low");
  });
});
