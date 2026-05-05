import { describe, expect, test } from "vitest";
import { buildReleaseNoteFeedQuery, buildReleaseNoteSearchQuery } from "../src/lib/search";

describe("release note search SQL", () => {
  test("can build a filtered RSS/watch query from release notes", () => {
    const query = buildReleaseNoteFeedQuery({
      platform: "WebGL",
      riskLevel: "blocker",
      limit: 25
    });

    expect(query.text).toContain("FROM release_note_items");
    expect(query.text).toContain("$1 = ANY(platforms)");
    expect(query.text).toContain("risk_level = $2");
    expect(query.values).toEqual(["WebGL", "blocker", 25]);
  });

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
});
