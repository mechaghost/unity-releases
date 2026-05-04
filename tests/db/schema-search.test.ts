import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildReleaseNoteSearchQuery } from "../../src/lib/search";

const schema = readFileSync(join(process.cwd(), "src/lib/db/schema.sql"), "utf8");

describe("Postgres schema", () => {
  test("includes audit, release, artifact, module, issue, package, and event tables", () => {
    for (const table of [
      "source_snapshots",
      "ingestion_runs",
      "unity_releases",
      "release_sections",
      "release_note_items",
      "unity_release_artifacts",
      "unity_release_modules",
      "issue_mentions",
      "packages",
      "package_versions",
      "content_events",
      "blog_posts",
      "hub_releases"
    ]) {
      expect(schema).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });

  test("enables Postgres full-text and trigram search indexes", () => {
    expect(schema).toContain("CREATE EXTENSION IF NOT EXISTS pg_trgm");
    expect(schema).toContain("tsvector");
    expect(schema).toContain("USING GIN");
    expect(schema).toContain("gin_trgm_ops");
  });
});

describe("buildReleaseNoteSearchQuery", () => {
  test("builds filtered search SQL with stable parameter order", () => {
    const query = buildReleaseNoteSearchQuery({
      q: "webgl memory leak",
      version: "6000.3.14f1",
      minorLine: "6000.3",
      stream: "Update/Supported",
      section: "Known Issues",
      area: "WebGL",
      platform: "WebGL",
      impactKind: "known_issue",
      riskLevel: "caution",
      packageName: "com.unity.inputsystem",
      issueId: "UUM-136929",
      limit: 25,
      offset: 50
    });

    expect(query.text).toContain("search_vector @@ websearch_to_tsquery('english', $1)");
    expect(query.text).toContain("version = $2");
    expect(query.text).toContain("minor_line = $3");
    expect(query.text).toContain("stream = $4");
    expect(query.text).toContain("section = $5");
    expect(query.text).toContain("area = $6");
    expect(query.text).toContain("$7 = ANY(platforms)");
    expect(query.text).toContain("impact_kind = $8");
    expect(query.text).toContain("risk_level = $9");
    expect(query.text).toContain("$10 = ANY(package_names)");
    expect(query.text).toContain("$11 = ANY(issue_ids)");
    expect(query.values).toEqual([
      "webgl memory leak",
      "6000.3.14f1",
      "6000.3",
      "Update/Supported",
      "Known Issues",
      "WebGL",
      "WebGL",
      "known_issue",
      "caution",
      "com.unity.inputsystem",
      "UUM-136929",
      25,
      50
    ]);
  });

  test("supports empty-query faceted browsing", () => {
    const query = buildReleaseNoteSearchQuery({ minorLine: "6000.3" });

    expect(query.text).not.toContain("websearch_to_tsquery");
    expect(query.text).toContain("minor_line = $1");
    expect(query.values).toEqual(["6000.3", 100, 0]);
  });
});
