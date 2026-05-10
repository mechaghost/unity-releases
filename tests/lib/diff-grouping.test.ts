import { describe, expect, test } from "vitest";
import {
  aggregateByPackage,
  dedupeByIssue,
  groupByVersion,
  minorLinesBetween,
  shortHash,
  toTime
} from "../../src/lib/diff-grouping";

// ─── toTime ────────────────────────────────────────────────────

describe("toTime", () => {
  test("returns 0 for null / undefined / empty values", () => {
    expect(toTime(null)).toBe(0);
    expect(toTime(undefined)).toBe(0);
    expect(toTime("")).toBe(0);
  });

  test("parses ISO strings", () => {
    expect(toTime("2026-04-22T12:21:09.823Z")).toBe(Date.parse("2026-04-22T12:21:09.823Z"));
  });

  test("returns the millisecond value of a Date", () => {
    const d = new Date("2026-04-22T00:00:00Z");
    expect(toTime(d)).toBe(d.getTime());
  });

  test("returns 0 for unparseable strings", () => {
    expect(toTime("not a date")).toBe(0);
  });
});

// ─── minorLinesBetween ─────────────────────────────────────────

describe("minorLinesBetween", () => {
  test("fills in every minor line between two endpoints on the same major", () => {
    expect(minorLinesBetween("6000.0", "6000.5")).toEqual([
      "6000.0",
      "6000.1",
      "6000.2",
      "6000.3",
      "6000.4",
      "6000.5"
    ]);
  });

  test("returns the same single line when from == to", () => {
    expect(minorLinesBetween("6000.3", "6000.3")).toEqual(["6000.3"]);
  });

  test("treats arguments symmetrically (the order doesn't change the result)", () => {
    expect(minorLinesBetween("6000.5", "6000.0")).toEqual([
      "6000.0",
      "6000.1",
      "6000.2",
      "6000.3",
      "6000.4",
      "6000.5"
    ]);
  });

  test("falls back to the two endpoints when majors differ", () => {
    // We don't try to enumerate across majors - Unity's major bumps
    // (5000 → 6000) carry too much breakage to claim a numerical path.
    expect(minorLinesBetween("5000.10", "6000.0")).toEqual(["5000.10", "6000.0"]);
  });

  test("falls back when either endpoint can't be parsed", () => {
    expect(minorLinesBetween("not-a-version", "6000.0")).toEqual(["not-a-version", "6000.0"]);
    expect(minorLinesBetween("6000.0", "")).toEqual(["6000.0", ""]);
  });
});

// ─── groupByVersion ────────────────────────────────────────────

describe("groupByVersion", () => {
  test("buckets rows by version, preserving insertion order of first-seen versions", () => {
    const rows = [
      { id: 1, version: "6000.3.14f1", release_date: "2026-04-22T00:00:00Z" },
      { id: 2, version: "6000.3.14f1", release_date: "2026-04-22T00:00:00Z" },
      { id: 3, version: "6000.3.13f1", release_date: "2026-04-08T00:00:00Z" },
      { id: 4, version: "6000.3.14f1", release_date: "2026-04-22T00:00:00Z" }
    ];

    const groups = groupByVersion(rows);
    expect(groups.map((g) => g.version)).toEqual(["6000.3.14f1", "6000.3.13f1"]);
    expect(groups[0].rows.map((r) => r.id)).toEqual([1, 2, 4]);
    expect(groups[1].rows.map((r) => r.id)).toEqual([3]);
  });

  test("captures the release date from the first row in each group", () => {
    const rows = [
      { id: 1, version: "v1", release_date: "2026-01-01T00:00:00Z" },
      { id: 2, version: "v1", release_date: "2026-12-31T00:00:00Z" }
    ];
    expect(groupByVersion(rows)[0].releaseDate).toBe("2026-01-01T00:00:00Z");
  });

  test("returns an empty array for an empty input", () => {
    expect(groupByVersion([])).toEqual([]);
  });
});

// ─── dedupeByIssue ─────────────────────────────────────────────

describe("dedupeByIssue", () => {
  function row(overrides: {
    id: number;
    version: string;
    date: string;
    issueIds?: string[];
    body?: string;
  }) {
    return {
      id: overrides.id,
      version: overrides.version,
      release_date: overrides.date,
      body: overrides.body ?? "default body",
      issue_ids: overrides.issueIds ?? []
    };
  }

  test("collapses repeated mentions of the same issue id into one entry", () => {
    const result = dedupeByIssue([
      row({ id: 1, version: "6000.3.14f1", date: "2026-04-22T00:00:00Z", issueIds: ["UUM-100"] }),
      row({ id: 2, version: "6000.3.13f1", date: "2026-04-08T00:00:00Z", issueIds: ["UUM-100"] }),
      row({ id: 3, version: "6000.3.12f1", date: "2026-03-20T00:00:00Z", issueIds: ["UUM-100"] })
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].mentionCount).toBe(3);
    expect(result[0].firstVersion).toBe("6000.3.12f1");
    expect(result[0].lastVersion).toBe("6000.3.14f1");
  });

  test("uses the most recent restatement as the canonical (primary) row", () => {
    const newest = row({
      id: 99,
      version: "6000.3.14f1",
      date: "2026-04-22T00:00:00Z",
      issueIds: ["UUM-1"],
      body: "newest body"
    });
    const result = dedupeByIssue([
      row({
        id: 1,
        version: "6000.3.10f1",
        date: "2026-02-01T00:00:00Z",
        issueIds: ["UUM-1"],
        body: "older body"
      }),
      newest
    ]);
    expect(result[0].primary.id).toBe(99);
    expect(result[0].primary.body).toBe("newest body");
  });

  test("falls back to a body hash when no issue id is present", () => {
    const result = dedupeByIssue([
      row({ id: 1, version: "v1", date: "2026-01-01T00:00:00Z", body: "same text" }),
      row({ id: 2, version: "v2", date: "2026-02-01T00:00:00Z", body: "same text" }),
      row({ id: 3, version: "v3", date: "2026-03-01T00:00:00Z", body: "different text" })
    ]);
    expect(result).toHaveLength(2);
    const sameTextEntry = result.find((r) => r.primary.body === "same text");
    expect(sameTextEntry?.mentionCount).toBe(2);
  });

  test("keeps issue-id entries separate from body-hash entries with the same body", () => {
    // A row with an issue id and a row with the same body but no id are
    // *not* the same fact - Unity sometimes restates an issue without
    // the id and we'd rather show both than hide one.
    const result = dedupeByIssue([
      row({
        id: 1,
        version: "v1",
        date: "2026-01-01T00:00:00Z",
        body: "shared",
        issueIds: ["UUM-1"]
      }),
      row({ id: 2, version: "v2", date: "2026-02-01T00:00:00Z", body: "shared" })
    ]);
    expect(result).toHaveLength(2);
  });

  test("sorts most-recently-last-seen first, breaking ties by mention count", () => {
    const result = dedupeByIssue([
      row({ id: 1, version: "vA", date: "2026-04-01T00:00:00Z", issueIds: ["older"] }),
      row({ id: 2, version: "vB", date: "2026-04-15T00:00:00Z", issueIds: ["newer"] }),
      row({ id: 3, version: "vA", date: "2026-04-01T00:00:00Z", issueIds: ["older"] })
    ]);
    expect(result.map((r) => r.key)).toEqual(["id:newer", "id:older"]);
  });
});

// ─── aggregateByPackage ───────────────────────────────────────

describe("aggregateByPackage", () => {
  function row(o: {
    id: number;
    version: string;
    date: string;
    packages: string[];
    body?: string;
  }) {
    return {
      id: o.id,
      version: o.version,
      release_date: o.date,
      body: o.body ?? "",
      package_names: o.packages
    };
  }

  test("counts mentions per package across the supplied rows", () => {
    const result = aggregateByPackage([
      row({
        id: 1,
        version: "v1",
        date: "2026-01-01T00:00:00Z",
        packages: ["com.unity.inputsystem"]
      }),
      row({
        id: 2,
        version: "v2",
        date: "2026-02-01T00:00:00Z",
        packages: ["com.unity.inputsystem"]
      }),
      row({
        id: 3,
        version: "v1",
        date: "2026-01-01T00:00:00Z",
        packages: ["com.unity.addressables"]
      })
    ]);
    const input = result.find((r) => r.packageName === "com.unity.inputsystem");
    expect(input?.mentionCount).toBe(2);
    expect(input?.firstVersion).toBe("v1");
    expect(input?.lastVersion).toBe("v2");
  });

  test("counts a row mentioning multiple packages once per package", () => {
    const result = aggregateByPackage([
      row({
        id: 1,
        version: "v1",
        date: "2026-01-01T00:00:00Z",
        packages: ["com.unity.inputsystem", "com.unity.addressables"]
      })
    ]);
    expect(result.map((r) => r.packageName).sort()).toEqual([
      "com.unity.addressables",
      "com.unity.inputsystem"
    ]);
    expect(result.every((r) => r.mentionCount === 1)).toBe(true);
  });

  test("ignores rows with no package_names", () => {
    expect(
      aggregateByPackage([row({ id: 1, version: "v1", date: "2026-01-01T00:00:00Z", packages: [] })])
    ).toEqual([]);
  });

  test("uses the body of the most recent mention as the sample", () => {
    const result = aggregateByPackage([
      row({
        id: 1,
        version: "v1",
        date: "2026-01-01T00:00:00Z",
        packages: ["pkg"],
        body: "old body"
      }),
      row({
        id: 2,
        version: "v2",
        date: "2026-04-01T00:00:00Z",
        packages: ["pkg"],
        body: "new body"
      })
    ]);
    expect(result[0].sampleBody).toBe("new body");
  });

  test("sorts by mention count descending", () => {
    const result = aggregateByPackage([
      row({ id: 1, version: "v", date: "2026-01-01T00:00:00Z", packages: ["a"] }),
      row({ id: 2, version: "v", date: "2026-01-01T00:00:00Z", packages: ["b"] }),
      row({ id: 3, version: "v", date: "2026-01-01T00:00:00Z", packages: ["b"] }),
      row({ id: 4, version: "v", date: "2026-01-01T00:00:00Z", packages: ["b"] }),
      row({ id: 5, version: "v", date: "2026-01-01T00:00:00Z", packages: ["c"] }),
      row({ id: 6, version: "v", date: "2026-01-01T00:00:00Z", packages: ["c"] })
    ]);
    expect(result.map((r) => r.packageName)).toEqual(["b", "c", "a"]);
  });
});

// ─── shortHash ─────────────────────────────────────────────────

describe("shortHash", () => {
  test("produces stable hashes for identical inputs", () => {
    expect(shortHash("hello")).toBe(shortHash("hello"));
  });

  test("produces different hashes for different inputs", () => {
    expect(shortHash("hello")).not.toBe(shortHash("hello!"));
  });

  test("is case-sensitive", () => {
    expect(shortHash("Foo")).not.toBe(shortHash("foo"));
  });
});
