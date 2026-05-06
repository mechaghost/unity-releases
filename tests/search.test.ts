import { describe, expect, test } from "vitest";
import {
  buildReleaseNoteSearchQuery,
  buildReleaseNoteWhereForVersions
} from "../src/lib/search";

describe("release note search SQL", () => {
  test("can build a count query matching explorer filters", () => {
    const query = buildReleaseNoteSearchQuery({
      q: "memory leak",
      version: "6000.3.14f1",
      limit: 20
    });

    expect(query.text).toContain("COUNT(*) OVER() AS total_count");
    expect(query.values).toEqual(["memory leak", "6000.3.14f1", 20, 0]);
  });

  test("can order release detail notes by section and source order", () => {
    const query = buildReleaseNoteSearchQuery({
      version: "6000.5.0b6",
      order: "section"
    });

    expect(query.text).toContain("section ASC, source_order ASC");
  });

  test("expands multi-value array filters into array overlap and IN clauses", () => {
    const query = buildReleaseNoteSearchQuery({
      platform: ["WebGL", "iOS"],
      impactKind: ["fix", "improvement"],
      riskLevel: ["caution", "blocker"],
      packageName: ["com.unity.inputsystem", "com.unity.addressables"],
      limit: 25
    });

    expect(query.text).toContain("platforms && $1");
    expect(query.text).toContain("impact_kind = ANY($2)");
    expect(query.text).toContain("risk_level = ANY($3)");
    expect(query.text).toContain("package_names && $4");
    expect(query.values).toEqual([
      ["WebGL", "iOS"],
      ["fix", "improvement"],
      ["caution", "blocker"],
      ["com.unity.inputsystem", "com.unity.addressables"],
      25,
      0
    ]);
  });

  test("collapses single-element arrays back to scalar predicates", () => {
    const query = buildReleaseNoteSearchQuery({
      platform: ["WebGL"],
      impactKind: ["fix"],
      limit: 10
    });

    expect(query.text).toContain("$1 = ANY(platforms)");
    expect(query.text).toContain("impact_kind = $2");
    expect(query.values).toEqual(["WebGL", "fix", 10, 0]);
  });

  test("ranged query for diffs filters by versions = ANY", () => {
    const query = buildReleaseNoteWhereForVersions(
      ["6000.3.14f1", "6000.3.13f1"],
      { platform: "WebGL" },
      500
    );

    expect(query.text).toContain("$1 = ANY(platforms)");
    expect(query.text).toContain("version = ANY($2)");
    expect(query.values).toEqual(["WebGL", ["6000.3.14f1", "6000.3.13f1"], 500]);
  });
});
