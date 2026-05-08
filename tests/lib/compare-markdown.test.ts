import { describe, expect, test } from "vitest";

import { compareToMarkdown } from "../../src/lib/compare-markdown";

const noStatuses = new Map();

describe("compareToMarkdown", () => {
  test("renders the version range header and skips empty lanes", () => {
    const md = compareToMarkdown({
      fromVersion: "6000.0.43f1",
      toVersion: "6000.0.74f1",
      lanes: [],
      issueStatuses: noStatuses
    });
    expect(md).toContain("# Unity 6000.0.43f1 → 6000.0.74f1");
    expect(md).toContain("_No notable changes in this range._");
  });

  test("renders by-issue lanes with deduped bullets and seen-in range", () => {
    const md = compareToMarkdown({
      fromVersion: "6000.0.43f1",
      toVersion: "6000.0.74f1",
      issueStatuses: new Map(),
      lanes: [
        {
          id: "blockers",
          title: "Active known blockers",
          mode: "by-issue",
          totalCount: 1,
          rows: [
            {
              version: "6000.0.61f1",
              body: "Crash on tlsf_free (UUM-141061)",
              issue_ids: ["UUM-141061"],
              release_date: "2026-04-01"
            },
            {
              version: "6000.0.74f1",
              body: "Crash on tlsf_free (UUM-141061)",
              issue_ids: ["UUM-141061"],
              release_date: "2026-04-29"
            }
          ]
        }
      ]
    });
    expect(md).toContain("## Active known blockers (1)");
    expect(md).toContain("- Crash on tlsf_free");
    expect(md).toContain("[UUM-141061](https://issuetracker.unity3d.com/issues/uum-141061)");
    expect(md).toContain("seen 6000.0.61f1 → 6000.0.74f1 (2 mentions)");
  });

  test("appends the derived issue status when provided", () => {
    const md = compareToMarkdown({
      fromVersion: "6000.0.43f1",
      toVersion: "6000.0.74f1",
      issueStatuses: new Map([
        [
          "UUM-100218",
          {
            kind: "regressed" as const,
            knownVersion: "6000.0.64f1",
            knownReleaseDate: "2025-12-10",
            lastFixedVersion: "6000.2.0f1",
            lastFixedReleaseDate: "2025-08-12"
          }
        ]
      ]),
      lanes: [
        {
          id: "known",
          title: "Other known issues",
          mode: "by-issue",
          totalCount: 1,
          rows: [
            {
              version: "6000.0.64f1",
              body: "Silent crash when opening a specific project",
              issue_ids: ["UUM-100218"],
              release_date: "2025-12-10"
            }
          ]
        }
      ]
    });
    expect(md).toContain("(regressed 6000.0.64f1)");
  });

  test("renders by-release lanes with version-prefixed bullets", () => {
    const md = compareToMarkdown({
      fromVersion: "6000.0.43f1",
      toVersion: "6000.0.74f1",
      issueStatuses: noStatuses,
      lanes: [
        {
          id: "fix",
          title: "Fixes",
          mode: "by-release",
          totalCount: 1,
          rows: [
            {
              version: "6000.0.74f1",
              body: "Fixed editor crash on launch",
              issue_ids: [],
              release_date: "2026-04-29"
            }
          ]
        }
      ]
    });
    expect(md).toContain("- **6000.0.74f1** Fixed editor crash on launch");
  });

  test("renders by-package lanes as one bullet per unique package", () => {
    const md = compareToMarkdown({
      fromVersion: "6000.0.43f1",
      toVersion: "6000.0.74f1",
      issueStatuses: noStatuses,
      lanes: [
        {
          id: "package",
          title: "Package updates",
          mode: "by-package",
          totalCount: 2,
          rows: [
            {
              version: "6000.0.74f1",
              body: "",
              issue_ids: [],
              package_names: ["com.unity.inputsystem", "com.unity.addressables"],
              release_date: "2026-04-29"
            },
            {
              version: "6000.0.73f1",
              body: "",
              issue_ids: [],
              package_names: ["com.unity.inputsystem"],
              release_date: "2026-04-22"
            }
          ]
        }
      ]
    });
    expect(md).toContain("- `com.unity.inputsystem` updated in 6000.0.74f1");
    expect(md).toContain("- `com.unity.addressables` updated in 6000.0.74f1");
    // Same package mentioned again should not produce a duplicate bullet.
    expect(md.match(/com\.unity\.inputsystem/g)?.length).toBe(1);
  });

  test("renders every row when rowsPerLane is null (full export)", () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({
      version: `6000.0.${60 + i}f1`,
      body: `Fix ${i}`,
      issue_ids: [],
      release_date: null
    }));
    const md = compareToMarkdown({
      fromVersion: "6000.0.43f1",
      toVersion: "6000.0.74f1",
      issueStatuses: noStatuses,
      rowsPerLane: null,
      lanes: [
        {
          id: "fix",
          title: "Fixes",
          mode: "by-release",
          totalCount: 12,
          rows
        }
      ]
    });
    for (let i = 0; i < 12; i += 1) {
      expect(md).toContain(`Fix ${i}`);
    }
    expect(md).not.toContain("more not shown");
  });

  test("caps each lane at rowsPerLane and notes the truncation", () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      version: `6000.0.7${i}f1`,
      body: `Fix ${i}`,
      issue_ids: [],
      release_date: null
    }));
    const md = compareToMarkdown({
      fromVersion: "6000.0.43f1",
      toVersion: "6000.0.74f1",
      issueStatuses: noStatuses,
      rowsPerLane: 2,
      lanes: [
        {
          id: "fix",
          title: "Fixes",
          mode: "by-release",
          totalCount: 5,
          rows
        }
      ]
    });
    expect(md).toContain("Fix 0");
    expect(md).toContain("Fix 1");
    expect(md).not.toContain("Fix 2");
    expect(md).toContain("_…3 more not shown._");
  });
});
