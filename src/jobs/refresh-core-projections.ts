import { pathToFileURL } from "node:url";
import type { PoolClient } from "pg";
import { getPool } from "../lib/db/client";
import {
  upsertReleaseBundle,
  withIngestionTransaction
} from "../lib/db/repositories";
import { sha256 } from "../lib/ingest/hash";
import {
  EDITOR_RELEASE_PARSER_VERSION,
  LEGACY_LTS_PARSER_VERSION
} from "../lib/ingest/parser-versions";
import { normalizeReleaseForStorage } from "../lib/ingest/releases";
import type { ReleasePageMetadata } from "../lib/parsers/release-page";
import { parseUnityVersion } from "../lib/parsers/version";
import { isModernMajor } from "../lib/unity-generation";

const REPAIR_RUN_VERSION = `core-projection-repair:${EDITOR_RELEASE_PARSER_VERSION}`;

type StoredRelease = {
  id: number;
  version: string;
  parser_version: string;
  normalized_sha256: string;
  raw_metadata_json: ReleasePageMetadata;
  source_snapshot_id: number;
  content_text: string;
};

type ProjectionDrift = {
  notesOrSections: boolean;
  packageChanges: boolean;
};

function packageChangeKey(change: {
  packageName: string;
  changeKind: string;
}) {
  return `${change.packageName}:${change.changeKind}`;
}

function comparePackageChanges(
  left: { packageName: string; changeKind: string },
  right: { packageName: string; changeKind: string }
) {
  const leftKey = packageChangeKey(left);
  const rightKey = packageChangeKey(right);
  return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
}

export function compareReleaseProjection(input: {
  parsedItemHashes: string[];
  storedItemHashes: string[];
  parsedSections: unknown[];
  storedSections: unknown[];
  parsedPackageChanges: unknown[];
  storedPackageChanges: unknown[];
}): ProjectionDrift {
  return {
    notesOrSections:
      sha256(input.parsedItemHashes) !== sha256(input.storedItemHashes) ||
      sha256(input.parsedSections) !== sha256(input.storedSections),
    packageChanges:
      sha256(input.parsedPackageChanges) !==
      sha256(input.storedPackageChanges)
  };
}

function parserVersionForRelease(version: string) {
  return isModernMajor(parseUnityVersion(version).major)
    ? EDITOR_RELEASE_PARSER_VERSION
    : LEGACY_LTS_PARSER_VERSION;
}

function canonicalReleaseMetadata(
  raw: ReleasePageMetadata
): ReleasePageMetadata {
  return {
    version: raw.version,
    releaseDate: raw.releaseDate ?? null,
    stream: raw.stream,
    shortRevision: raw.shortRevision ?? null,
    changeset: raw.changeset ?? null,
    releasePageUrl: raw.releasePageUrl,
    releaseNotesUrl: raw.releaseNotesUrl ?? null,
    unityHubDeepLink: raw.unityHubDeepLink ?? null,
    artifacts: (raw.artifacts ?? []).map((artifact) => ({
      platform: artifact.platform,
      architecture: artifact.architecture,
      category: artifact.category,
      name: artifact.name,
      url: artifact.url
    })),
    modules: (raw.modules ?? []).map((module) => ({
      platform: module.platform,
      architecture: module.architecture,
      moduleName: module.moduleName,
      moduleCategory: module.moduleCategory,
      url: module.url
    }))
  };
}

async function storedProjection(
  client: PoolClient,
  releaseId: number
) {
  const items = await client.query<{ normalized_sha256: string }>(
    `
      SELECT normalized_sha256
      FROM release_note_items
      WHERE unity_release_id = $1
      ORDER BY source_order, id
    `,
    [releaseId]
  );
  const sections = await client.query<{
    section: string;
    body: string;
    parser_confidence: string;
    source_order: number;
  }>(
    `
      SELECT section, body, parser_confidence::text, source_order
      FROM release_sections
      WHERE unity_release_id = $1
      ORDER BY source_order, id
    `,
    [releaseId]
  );
  const packageChanges = await client.query<{
    package_name: string;
    from_version: string | null;
    to_version: string | null;
    change_kind: string;
  }>(
    `
      SELECT package_name, from_version, to_version, change_kind
      FROM editor_package_versions
      WHERE unity_release_id = $1
      ORDER BY package_name, change_kind
    `,
    [releaseId]
  );
  return {
    itemHashes: items.rows.map((item) => item.normalized_sha256),
    sections: sections.rows.map((section) => ({
      section: section.section,
      body: section.body,
      parserConfidence: Number(section.parser_confidence),
      sourceOrder: section.source_order
    })),
    packageChanges: packageChanges.rows
      .map((change) => ({
        packageName: change.package_name,
        fromVersion: change.from_version,
        toVersion: change.to_version,
        changeKind: change.change_kind
      }))
      .sort(comparePackageChanges)
  };
}

async function replacePackageChanges(
  client: PoolClient,
  releaseId: number,
  changes: ReturnType<typeof normalizeReleaseForStorage>["packageChanges"],
  runId: number
) {
  await client.query(
    "DELETE FROM editor_package_versions WHERE unity_release_id = $1",
    [releaseId]
  );
  for (const change of changes) {
    await client.query(
      `
        INSERT INTO editor_package_versions (
          unity_release_id, editor_version, package_name, from_version,
          to_version, change_kind, source_snapshot_id, ingestion_run_id
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      `,
      [
        releaseId,
        change.editorVersion,
        change.packageName,
        change.fromVersion,
        change.toVersion,
        change.changeKind,
        change.sourceSnapshotId,
        runId
      ]
    );
  }
}

async function advanceParserProvenance(
  client: PoolClient,
  release: StoredRelease,
  parserVersion: string,
  runId: number
) {
  await client.query(
    `
      UPDATE unity_releases
      SET parser_version = $2,
          ingestion_run_id = $3,
          updated_at = now()
      WHERE id = $1
    `,
    [release.id, parserVersion, runId]
  );
  await client.query(
    `
      UPDATE release_note_items
      SET parser_version = $2,
          source_snapshot_id = $3,
          ingestion_run_id = $4,
          updated_at = now()
      WHERE unity_release_id = $1
    `,
    [release.id, parserVersion, release.source_snapshot_id, runId]
  );
  await client.query(
    `
      UPDATE release_sections
      SET source_snapshot_id = $2,
          ingestion_run_id = $3
      WHERE unity_release_id = $1
    `,
    [release.id, release.source_snapshot_id, runId]
  );
  await client.query(
    `
      UPDATE editor_package_versions
      SET source_snapshot_id = $2,
          ingestion_run_id = $3
      WHERE unity_release_id = $1
    `,
    [release.id, release.source_snapshot_id, runId]
  );
}

export async function runCoreProjectionRefresh() {
  return withIngestionTransaction(
    "data_integrity",
    "refresh-core-projections",
    async (client, runId) => {
      const releases = await client.query<StoredRelease>(
        `
          SELECT
            release.id,
            release.version,
            release.parser_version,
            release.normalized_sha256,
            release.raw_metadata_json,
            release.source_snapshot_id,
            snapshot.content_text
          FROM unity_releases release
          JOIN source_snapshots snapshot
            ON snapshot.id = release.source_snapshot_id
          ORDER BY release.id
        `
      );
      const releaseCount = await client.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM unity_releases"
      );
      const totalReleases = Number(releaseCount.rows[0].count);
      if ((releases.rowCount ?? 0) !== totalReleases) {
        throw new Error(
          `Cannot refresh core projections: ${totalReleases - (releases.rowCount ?? 0)} release(s) have no readable source snapshot`
        );
      }
      const summary = {
        scanned: releases.rowCount ?? 0,
        rebuilt: 0,
        packageChangesRebuilt: 0,
        releaseHashesRepaired: 0,
        provenanceAdvanced: 0,
        alreadyCurrent: 0
      };

      for (const release of releases.rows) {
        const parserVersion = parserVersionForRelease(release.version);
        const bundle = normalizeReleaseForStorage({
          metadata: canonicalReleaseMetadata(release.raw_metadata_json),
          releaseNotesMarkdown: release.content_text,
          sourceSnapshotId: Number(release.source_snapshot_id),
          ingestionRunId: runId,
          parserVersion
        });
        const stored = await storedProjection(client, Number(release.id));
        const parsedPackageChanges = bundle.packageChanges
          .map((change) => ({
            packageName: change.packageName,
            fromVersion: change.fromVersion,
            toVersion: change.toVersion,
            changeKind: change.changeKind
          }))
          .sort(comparePackageChanges);
        const drift = compareReleaseProjection({
          parsedItemHashes: bundle.noteItems.map(
            (item) => item.normalizedSha256
          ),
          storedItemHashes: stored.itemHashes,
          parsedSections: bundle.sections.map((section) => ({
            section: section.section,
            body: section.body,
            parserConfidence: section.parserConfidence,
            sourceOrder: section.sourceOrder
          })),
          storedSections: stored.sections,
          parsedPackageChanges,
          storedPackageChanges: stored.packageChanges
        });

        if (drift.notesOrSections) {
          // Force the repository upsert down its rebuild path even if a
          // current-version row was partially modified outside this job.
          if (release.parser_version === parserVersion) {
            await client.query(
              `
                UPDATE unity_releases
                SET parser_version = parser_version || ':repair-pending'
                WHERE id = $1
              `,
              [release.id]
            );
          }
          await upsertReleaseBundle(client, bundle);
          summary.rebuilt += 1;
          continue;
        }

        const releaseHashDrift =
          release.normalized_sha256 !==
          bundle.release.normalizedSha256;
        if (releaseHashDrift) {
          await client.query(
            `
              UPDATE unity_releases
              SET normalized_sha256 = $2,
                  updated_at = now()
              WHERE id = $1
            `,
            [release.id, bundle.release.normalizedSha256]
          );
          summary.releaseHashesRepaired += 1;
        }

        if (drift.packageChanges) {
          await replacePackageChanges(
            client,
            Number(release.id),
            bundle.packageChanges,
            runId
          );
          summary.packageChangesRebuilt += 1;
        }

        if (
          release.parser_version !== parserVersion ||
          drift.packageChanges
        ) {
          await advanceParserProvenance(
            client,
            release,
            parserVersion,
            runId
          );
          summary.provenanceAdvanced += 1;
        } else if (!releaseHashDrift) {
          summary.alreadyCurrent += 1;
        }
      }

      return summary;
    },
    REPAIR_RUN_VERSION
  );
}

const isDirectRun =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  runCoreProjectionRefresh()
    .then((summary) => {
      console.log(JSON.stringify(summary, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await getPool().end();
    });
}
