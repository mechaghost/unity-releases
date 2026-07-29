import type { PoolClient } from "pg";
import { describe, expect, test, vi } from "vitest";
import {
  upsertPackageBundle,
  upsertReleaseBundle
} from "../../src/lib/db/repositories";
import { normalizePackageForStorage } from "../../src/lib/ingest/packages";
import {
  EDITOR_RELEASE_PARSER_VERSION,
  LEGACY_LTS_PARSER_VERSION,
  PACKAGE_REGISTRY_PARSER_VERSION
} from "../../src/lib/ingest/parser-versions";
import { normalizeReleaseForStorage } from "../../src/lib/ingest/releases";

function fakeClient() {
  return {
    query: vi.fn(async () => ({
      rows: [{ id: 1 }],
      rowCount: 1
    }))
  } as unknown as PoolClient;
}

function sqlCalls(client: PoolClient) {
  return vi
    .mocked(client.query)
    .mock.calls.map(([sql]) => String(sql));
}

describe("core ingestion upsert contracts", () => {
  test("release conflicts refresh every normalized release field and event reference", async () => {
    const client = fakeClient();
    const bundle = normalizeReleaseForStorage({
      metadata: {
        version: "6000.3.14f1",
        releaseDate: "2026-04-22T12:21:09.823Z",
        stream: "Update/Supported",
        shortRevision: "d68c3f99a318",
        changeset: "d68c3f99a318",
        releasePageUrl:
          "https://unity.com/releases/editor/whats-new/6000.3.14f1",
        releaseNotesUrl: "https://storage.googleapis.com/release.md",
        unityHubDeepLink: "unityhub://6000.3.14f1/d68c3f99a318",
        artifacts: [],
        modules: []
      },
      releaseNotesMarkdown:
        "### 6000.3.14f1 Release Notes\n\n#### Fixes\n\n- WebGL: Fixed memory leak.",
      sourceSnapshotId: 11,
      ingestionRunId: 12,
      parserVersion: EDITOR_RELEASE_PARSER_VERSION
    });

    await upsertReleaseBundle(client, bundle);

    const calls = sqlCalls(client);
    const releaseSql = calls.find((sql) =>
      sql.includes("INSERT INTO unity_releases")
    );
    expect(releaseSql).toBeDefined();
    expect(releaseSql).toContain("IS DISTINCT FROM");
    for (const column of [
      "major_line",
      "minor_line",
      "patch",
      "suffix_channel",
      "suffix_number",
      "release_date",
      "stream",
      "changeset",
      "short_revision",
      "release_page_url",
      "release_notes_url",
      "unity_hub_deep_link",
      "raw_metadata_json",
      "source_snapshot_id",
      "ingestion_run_id",
      "parser_version",
      "normalized_sha256"
    ]) {
      expect(releaseSql).toContain(`${column} = EXCLUDED.${column}`);
    }

    const eventSql = calls.find((sql) =>
      sql.includes("INSERT INTO content_events")
    );
    expect(eventSql).toContain(
      "unity_release_id = EXCLUDED.unity_release_id"
    );
    expect(eventSql).toContain(
      "source_snapshot_id = EXCLUDED.source_snapshot_id"
    );
    expect(eventSql).toContain(
      "ingestion_run_id = EXCLUDED.ingestion_run_id"
    );
  });

  test("package conflicts refresh every field covered by the normalized hash", async () => {
    const client = fakeClient();
    const bundle = normalizePackageForStorage({
      parsedPackage: {
        name: "com.unity.inputsystem",
        displayName: "Input System",
        description: "Input support",
        documentationUrl: "https://docs.unity3d.com/Packages/com.unity.inputsystem",
        distTags: { latest: "1.19.0" },
        versions: [
          {
            version: "1.19.0",
            displayName: "Input System",
            publishedAt: "2026-02-24T05:48:23.303Z",
            unityCompatibility: "6000.0.16f1",
            unityMinVersion: "6000.0.16f1",
            changelog: "Fixed cursor.",
            dependencies: { "com.unity.modules.uielements": "1.0.0" },
            distTags: { latest: "1.19.0" },
            tarballUrl: "https://packages.unity.com/inputsystem.tgz",
            shasum: "abc123",
            isPrerelease: false,
            raw: { unity: "6000.0", unityRelease: "16f1" }
          }
        ],
        raw: {}
      },
      sourceUrl: "https://packages.unity.com/com.unity.inputsystem",
      sourceSnapshotId: 21,
      ingestionRunId: 22,
      parserVersion: PACKAGE_REGISTRY_PARSER_VERSION
    });

    await upsertPackageBundle(client, bundle);

    const calls = sqlCalls(client);
    const packageSql = calls.find((sql) =>
      sql.includes("INSERT INTO packages")
    );
    expect(packageSql).toContain("keywords = EXCLUDED.keywords");
    expect(packageSql).toContain("source_url = EXCLUDED.source_url");
    expect(packageSql).toContain("IS DISTINCT FROM");

    const versionSql = calls.find((sql) =>
      sql.includes("INSERT INTO package_versions")
    );
    for (const column of [
      "published_at",
      "unity_compatibility",
      "unity_min_version",
      "unity_max_version",
      "is_prerelease",
      "changelog",
      "dependencies_json",
      "dist_tags_json",
      "tarball_url",
      "shasum",
      "raw_metadata_json",
      "source_snapshot_id",
      "ingestion_run_id",
      "parser_version",
      "normalized_sha256"
    ]) {
      expect(versionSql).toContain(`${column} = EXCLUDED.${column}`);
    }
    expect(versionSql).toContain("IS DISTINCT FROM");

    const eventSql = calls.find((sql) =>
      sql.includes("INSERT INTO content_events")
    );
    expect(eventSql).toContain(
      "package_version_id = EXCLUDED.package_version_id"
    );
  });

  test("current parser versions identify the latest normalized projections", () => {
    expect(EDITOR_RELEASE_PARSER_VERSION).toBe("2026-06-12");
    expect(LEGACY_LTS_PARSER_VERSION).toBe(
      "2026-06-12-legacy-lts"
    );
    expect(PACKAGE_REGISTRY_PARSER_VERSION).toBe("2026-06-12");
  });
});
