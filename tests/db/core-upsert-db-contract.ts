import assert from "node:assert/strict";
import { setupE2eDatabase } from "../e2e/setup-db";
import { scopedDatabaseUrl } from "../e2e/test-database";
import { sha256 } from "../../src/lib/ingest/hash";
import { normalizePackageForStorage } from "../../src/lib/ingest/packages";
import {
  EDITOR_RELEASE_PARSER_VERSION,
  PACKAGE_REGISTRY_PARSER_VERSION
} from "../../src/lib/ingest/parser-versions";
import { normalizeReleaseForStorage } from "../../src/lib/ingest/releases";

async function main() {
  await setupE2eDatabase();
  process.env.DATABASE_URL = scopedDatabaseUrl();

  const [{ getPool, query }, repositories] = await Promise.all([
    import("../../src/lib/db/client"),
    import("../../src/lib/db/repositories")
  ]);
  const client = await getPool().connect();
  const run = await query<{ id: number }>(
    `
      INSERT INTO ingestion_runs (
        source_type, job_name, parser_version, status, finished_at
      )
      VALUES ('data-contract', 'core-upsert-contract', $1, 'success', now())
      RETURNING id
    `,
    [EDITOR_RELEASE_PARSER_VERSION]
  );
  const snapshot = await query<{ id: number }>(
    `
      INSERT INTO source_snapshots (
        source_type, source_url, http_status, content_sha256, content_text
      )
      VALUES ('data-contract', $1, 200, $2, $3)
      RETURNING id
    `,
    [
      "https://example.com/core-upsert-contract",
      sha256("core-upsert-contract-v1"),
      "core-upsert-contract-v1"
    ]
  );
  const runId = Number(run.rows[0].id);
  const snapshotId = Number(snapshot.rows[0].id);

  try {
    const releaseInput = {
      metadata: {
        version: "6000.3.14f1",
        releaseDate: "2026-04-22T12:21:09.823Z",
        stream: "Update/Supported" as const,
        shortRevision: "d68c3f99a318",
        changeset: "d68c3f99a318",
        releasePageUrl:
          "https://unity.com/releases/editor/whats-new/6000.3.14f1",
        releaseNotesUrl: "https://example.com/release-v1.md",
        unityHubDeepLink: "unityhub://6000.3.14f1/d68c3f99a318",
        artifacts: [],
        modules: []
      },
      releaseNotesMarkdown:
        "### 6000.3.14f1 Release Notes\n\n#### Fixes\n\n- WebGL: Fixed memory leak.",
      sourceSnapshotId: snapshotId,
      ingestionRunId: runId,
      parserVersion: EDITOR_RELEASE_PARSER_VERSION
    };
    const releaseBundle = normalizeReleaseForStorage(releaseInput);
    const releaseId = await repositories.upsertReleaseBundle(
      client,
      releaseBundle
    );
    const releaseBeforeReplay = await query<{
      release_state: Record<string, unknown>;
      note_ids: string[];
      event_state: Record<string, unknown>;
    }>(
      `
        SELECT
          to_jsonb(release) AS release_state,
          ARRAY(
            SELECT item.id::text
            FROM release_note_items item
            WHERE item.unity_release_id = release.id
            ORDER BY item.id
          ) AS note_ids,
          (
            SELECT to_jsonb(event)
            FROM content_events event
            WHERE event.unity_release_id = release.id
          ) AS event_state
        FROM unity_releases release
        WHERE release.id = $1
      `,
      [releaseId]
    );
    await query("SELECT pg_sleep(0.01)");
    await repositories.upsertReleaseBundle(client, releaseBundle);
    const releaseAfterReplay = await query<{
      release_state: Record<string, unknown>;
      note_ids: string[];
      event_state: Record<string, unknown>;
    }>(
      `
        SELECT
          to_jsonb(release) AS release_state,
          ARRAY(
            SELECT item.id::text
            FROM release_note_items item
            WHERE item.unity_release_id = release.id
            ORDER BY item.id
          ) AS note_ids,
          (
            SELECT to_jsonb(event)
            FROM content_events event
            WHERE event.unity_release_id = release.id
          ) AS event_state
        FROM unity_releases release
        WHERE release.id = $1
      `,
      [releaseId]
    );
    assert.deepEqual(
      releaseAfterReplay.rows[0],
      releaseBeforeReplay.rows[0],
      "identical release replay must not churn rows or provenance"
    );

    const updatedRelease = normalizeReleaseForStorage({
      ...releaseInput,
      metadata: {
        ...releaseInput.metadata,
        releaseDate: "2026-04-23T12:21:09.823Z",
        shortRevision: "updated-short",
        changeset: "updated-changeset",
        releaseNotesUrl: "https://example.com/release-v2.md",
        unityHubDeepLink: "unityhub://6000.3.14f1/updated-changeset"
      },
      releaseNotesMarkdown:
        "### 6000.3.14f1 Release Notes\n\n#### Fixes\n\n- WebGL: Fixed updated memory leak."
    });
    await repositories.upsertReleaseBundle(client, updatedRelease);
    const storedRelease = await query<{
      release_date: string;
      short_revision: string;
      changeset: string;
      release_notes_url: string;
      unity_hub_deep_link: string;
      body: string;
    }>(
      `
        SELECT
          release.release_date::text,
          release.short_revision,
          release.changeset,
          release.release_notes_url,
          release.unity_hub_deep_link,
          item.body
        FROM unity_releases release
        JOIN release_note_items item ON item.unity_release_id = release.id
        WHERE release.id = $1
      `,
      [releaseId]
    );
    assert.equal(storedRelease.rows[0].short_revision, "updated-short");
    assert.equal(storedRelease.rows[0].changeset, "updated-changeset");
    assert.equal(
      storedRelease.rows[0].release_notes_url,
      "https://example.com/release-v2.md"
    );
    assert.equal(
      storedRelease.rows[0].unity_hub_deep_link,
      "unityhub://6000.3.14f1/updated-changeset"
    );
    assert.equal(storedRelease.rows[0].body, "Fixed updated memory leak.");

    const packageInput = {
      parsedPackage: {
        name: "com.unity.data-contract",
        displayName: "Data Contract",
        description: "Initial package projection",
        documentationUrl: "https://docs.unity3d.com/data-contract",
        distTags: { latest: "1.0.0" },
        versions: [
          {
            version: "1.0.0",
            displayName: "Data Contract",
            publishedAt: null,
            unityCompatibility: "6000.0",
            unityMinVersion: "6000.0",
            changelog: "Initial changelog",
            dependencies: {},
            distTags: { latest: "1.0.0" },
            tarballUrl: "https://example.com/data-contract-v1.tgz",
            shasum: "initial-shasum",
            isPrerelease: false,
            raw: { unity: "6000.0" }
          }
        ],
        raw: {}
      },
      sourceUrl: "https://packages.unity.com/com.unity.data-contract",
      sourceSnapshotId: snapshotId,
      ingestionRunId: runId,
      parserVersion: PACKAGE_REGISTRY_PARSER_VERSION
    };
    const packageBundle = normalizePackageForStorage(packageInput);
    const packageId = await repositories.upsertPackageBundle(
      client,
      packageBundle
    );
    const packageBeforeReplay = await query<{
      package_state: Record<string, unknown>;
      version_state: Record<string, unknown>;
      event_state: Record<string, unknown>;
    }>(
      `
        SELECT
          to_jsonb(package) AS package_state,
          to_jsonb(version) AS version_state,
          to_jsonb(event) AS event_state
        FROM packages package
        JOIN package_versions version ON version.package_id = package.id
        JOIN content_events event ON event.package_version_id = version.id
        WHERE package.id = $1 AND version.version = '1.0.0'
      `,
      [packageId]
    );
    await query("SELECT pg_sleep(0.01)");
    await repositories.upsertPackageBundle(client, packageBundle);
    const packageAfterReplay = await query<{
      package_state: Record<string, unknown>;
      version_state: Record<string, unknown>;
      event_state: Record<string, unknown>;
    }>(
      `
        SELECT
          to_jsonb(package) AS package_state,
          to_jsonb(version) AS version_state,
          to_jsonb(event) AS event_state
        FROM packages package
        JOIN package_versions version ON version.package_id = package.id
        JOIN content_events event ON event.package_version_id = version.id
        WHERE package.id = $1 AND version.version = '1.0.0'
      `,
      [packageId]
    );
    assert.deepEqual(
      packageAfterReplay.rows[0],
      packageBeforeReplay.rows[0],
      "identical package replay must not churn rows or event time"
    );

    const updatedPackage = normalizePackageForStorage({
      ...packageInput,
      parsedPackage: {
        ...packageInput.parsedPackage,
        description: "Updated package projection",
        versions: [
          {
            ...packageInput.parsedPackage.versions[0],
            unityCompatibility: "6000.0.16f1",
            unityMinVersion: "6000.0.16f1",
            changelog: "Updated changelog",
            dependencies: { "com.unity.modules.uielements": "1.0.0" },
            tarballUrl: "https://example.com/data-contract-v2.tgz",
            shasum: "updated-shasum",
            raw: { unity: "6000.0", unityRelease: "16f1" }
          }
        ]
      }
    });
    await repositories.upsertPackageBundle(client, updatedPackage);
    const storedPackage = await query<{
      description: string;
      unity_compatibility: string;
      unity_min_version: string;
      changelog: string;
      dependencies_json: Record<string, string>;
      tarball_url: string;
      shasum: string;
      raw_metadata_json: Record<string, string>;
    }>(
      `
        SELECT
          package.description,
          version.unity_compatibility,
          version.unity_min_version,
          version.changelog,
          version.dependencies_json,
          version.tarball_url,
          version.shasum,
          version.raw_metadata_json
        FROM packages package
        JOIN package_versions version ON version.package_id = package.id
        WHERE package.id = $1 AND version.version = '1.0.0'
      `,
      [packageId]
    );
    assert.equal(storedPackage.rows[0].description, "Updated package projection");
    assert.equal(storedPackage.rows[0].unity_compatibility, "6000.0.16f1");
    assert.equal(storedPackage.rows[0].unity_min_version, "6000.0.16f1");
    assert.equal(storedPackage.rows[0].changelog, "Updated changelog");
    assert.deepEqual(storedPackage.rows[0].dependencies_json, {
      "com.unity.modules.uielements": "1.0.0"
    });
    assert.equal(
      storedPackage.rows[0].tarball_url,
      "https://example.com/data-contract-v2.tgz"
    );
    assert.equal(storedPackage.rows[0].shasum, "updated-shasum");
    assert.deepEqual(storedPackage.rows[0].raw_metadata_json, {
      unity: "6000.0",
      unityRelease: "16f1"
    });
  } finally {
    client.release();
    await getPool().end();
  }

  console.log("Core ingestion upsert database contract passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
