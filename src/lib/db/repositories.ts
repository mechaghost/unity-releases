import type { PoolClient } from "pg";
import { getPool, query } from "./client";
import {
  buildReleaseNoteFeedQuery,
  buildReleaseNoteSearchQuery,
  type ReleaseNoteSearchFilters
} from "../search";
import type { FetchedSource } from "../ingest/fetch";
import type { normalizePackageForStorage } from "../ingest/packages";
import type { normalizeReleaseForStorage } from "../ingest/releases";
import type { ParsedBlogPost } from "../parsers/rss";

export type FeedEventRow = {
  id: number;
  event_type: string;
  title: string;
  summary: string;
  event_time: string;
  source_url: string;
  stable_guid: string;
  risk_level: string | null;
  tags: string[];
};

export async function searchReleaseNotes(filters: ReleaseNoteSearchFilters) {
  const built = buildReleaseNoteSearchQuery(filters);
  const result = await query(built.text, built.values);
  return result.rows;
}

export async function listReleaseNoteFacets() {
  const result = await query<{
    versions: string[];
    minor_lines: string[];
    streams: string[];
    sections: string[];
    areas: string[];
    platforms: string[];
    impacts: string[];
    risks: string[];
    packages: string[];
  }>(
    `
      SELECT
        COALESCE((SELECT ARRAY_AGG(version ORDER BY release_date DESC NULLS LAST, version DESC) FROM unity_releases), '{}') AS versions,
        COALESCE((SELECT ARRAY_AGG(DISTINCT minor_line ORDER BY minor_line DESC) FROM release_note_items), '{}') AS minor_lines,
        COALESCE((SELECT ARRAY_AGG(DISTINCT stream ORDER BY stream) FROM release_note_items), '{}') AS streams,
        COALESCE((SELECT ARRAY_AGG(DISTINCT section ORDER BY section) FROM release_note_items), '{}') AS sections,
        COALESCE((SELECT ARRAY_AGG(DISTINCT area ORDER BY area) FROM release_note_items WHERE area IS NOT NULL AND area !~ '^\\\\d{4}\\\\.\\\\d+\\\\.\\\\d+[abf]\\\\d+$'), '{}') AS areas,
        COALESCE((SELECT ARRAY_AGG(DISTINCT platform ORDER BY platform) FROM release_note_items, UNNEST(platforms) AS platform), '{}') AS platforms,
        COALESCE((SELECT ARRAY_AGG(DISTINCT impact_kind ORDER BY impact_kind) FROM release_note_items), '{}') AS impacts,
        COALESCE((SELECT ARRAY_AGG(DISTINCT risk_level ORDER BY risk_level) FROM release_note_items), '{}') AS risks,
        COALESCE((SELECT ARRAY_AGG(DISTINCT package_name ORDER BY package_name) FROM release_note_items, UNNEST(package_names) AS package_name), '{}') AS packages
    `
  );
  return (
    result.rows[0] ?? {
      versions: [],
      minor_lines: [],
      streams: [],
      sections: [],
      areas: [],
      platforms: [],
      impacts: [],
      risks: [],
      packages: []
    }
  );
}

export async function listFeedEvents(limit = 50): Promise<FeedEventRow[]> {
  const result = await query<FeedEventRow>(
    `
      SELECT id, event_type, title, summary, event_time, source_url, stable_guid, risk_level, tags
      FROM content_events
      ORDER BY event_time DESC
      LIMIT $1
    `,
    [limit]
  );
  return result.rows;
}

export async function listFeedEventsByType(eventType: string, limit = 30): Promise<FeedEventRow[]> {
  const result = await query<FeedEventRow>(
    `
      SELECT id, event_type, title, summary, event_time, source_url, stable_guid, risk_level, tags
      FROM content_events
      WHERE event_type = $1
      ORDER BY event_time DESC
      LIMIT $2
    `,
    [eventType, limit]
  );
  return result.rows;
}

export async function listWatchFeedEvents(filters: ReleaseNoteSearchFilters, limit = 50): Promise<FeedEventRow[]> {
  if (!hasReleaseNoteFilters(filters)) {
    return listFeedEvents(limit);
  }

  const built = buildReleaseNoteFeedQuery({ ...filters, limit });
  const result = await query<FeedEventRow>(built.text, built.values);
  return result.rows;
}

function hasReleaseNoteFilters(filters: ReleaseNoteSearchFilters): boolean {
  return Boolean(
    filters.q ||
      filters.version ||
      filters.minorLine ||
      filters.stream ||
      filters.section ||
      filters.area ||
      filters.platform ||
      filters.impactKind ||
      filters.riskLevel ||
      filters.packageName ||
      filters.issueId
  );
}

export async function listReleases(limit = 50) {
  const result = await query(
    `
      SELECT *
      FROM unity_releases
      ORDER BY release_date DESC NULLS LAST, version DESC
      LIMIT $1
    `,
    [limit]
  );
  return result.rows;
}

export async function getRelease(version: string) {
  const result = await query("SELECT * FROM unity_releases WHERE version = $1", [version]);
  return result.rows[0] ?? null;
}

export async function listPackages(limit = 100) {
  const result = await query(
    `
      SELECT p.*, pv.version AS latest_version, pv.published_at AS latest_published_at
      FROM packages p
      LEFT JOIN LATERAL (
        SELECT version, published_at
        FROM package_versions
        WHERE package_id = p.id
        ORDER BY published_at DESC NULLS LAST, version DESC
        LIMIT 1
      ) pv ON true
      ORDER BY p.name ASC
      LIMIT $1
    `,
    [limit]
  );
  return result.rows;
}

export async function getPackage(name: string) {
  const pkg = await query("SELECT * FROM packages WHERE name = $1", [name]);
  if (!pkg.rows[0]) {
    return null;
  }
  const versions = await query(
    `
      SELECT *
      FROM package_versions
      WHERE package_id = $1
      ORDER BY published_at DESC NULLS LAST, version DESC
    `,
    [pkg.rows[0].id]
  );
  return { package: pkg.rows[0], versions: versions.rows };
}

export async function recordSourceSnapshot(client: PoolClient, sourceType: string, source: FetchedSource) {
  const result = await client.query<{ id: number }>(
    `
      INSERT INTO source_snapshots (
        source_type, source_url, http_status, etag, last_modified, content_sha256, content_text, metadata_json
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (source_url, content_sha256)
      DO UPDATE SET fetched_at = now()
      RETURNING id
    `,
    [
      sourceType,
      source.finalUrl,
      source.status,
      source.etag,
      source.lastModified,
      source.sha256,
      source.text,
      { originalUrl: source.url }
    ]
  );
  return result.rows[0].id;
}

export async function createIngestionRun(client: PoolClient, sourceType: string, jobName: string) {
  const result = await client.query<{ id: number }>(
    `
      INSERT INTO ingestion_runs (source_type, job_name, parser_version)
      VALUES ($1, $2, $3)
      RETURNING id
    `,
    [sourceType, jobName, process.env.PARSER_VERSION ?? "2026-05-04"]
  );
  return result.rows[0].id;
}

export async function finishIngestionRun(
  client: PoolClient,
  id: number,
  status: "success" | "failed",
  counts: { sourceCount?: number; recordsCreated?: number; recordsUpdated?: number; errorMessage?: string }
) {
  await client.query(
    `
      UPDATE ingestion_runs
      SET finished_at = now(),
          status = $2,
          source_count = $3,
          records_created = $4,
          records_updated = $5,
          error_message = $6
      WHERE id = $1
    `,
    [
      id,
      status,
      counts.sourceCount ?? 0,
      counts.recordsCreated ?? 0,
      counts.recordsUpdated ?? 0,
      counts.errorMessage ?? null
    ]
  );
}

export async function withIngestionTransaction<T>(
  sourceType: string,
  jobName: string,
  handler: (client: PoolClient, runId: number) => Promise<T>
) {
  const client = await getPool().connect();
  let runId: number | null = null;
  try {
    await client.query("BEGIN");
    runId = await createIngestionRun(client, sourceType, jobName);
    const result = await handler(client, runId);
    await finishIngestionRun(client, runId, "success", { sourceCount: 1, recordsCreated: 1 });
    await client.query("COMMIT");
    return result;
  } catch (error) {
    if (runId) {
      await finishIngestionRun(client, runId, "failed", {
        errorMessage: error instanceof Error ? error.message : "Unknown error"
      }).catch(() => undefined);
    }
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

type ReleaseBundle = ReturnType<typeof normalizeReleaseForStorage>;
type PackageBundle = ReturnType<typeof normalizePackageForStorage>;

export async function upsertReleaseBundle(client: PoolClient, bundle: ReleaseBundle) {
  const releaseResult = await client.query<{ id: number }>(
    `
      INSERT INTO unity_releases (
        version, major_line, minor_line, patch, suffix_channel, suffix_number, stream, release_date,
        changeset, short_revision, release_page_url, release_notes_url, unity_hub_deep_link,
        raw_metadata_json, source_snapshot_id, ingestion_run_id, parser_version, normalized_sha256
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      ON CONFLICT (version) DO UPDATE SET
        release_date = EXCLUDED.release_date,
        stream = EXCLUDED.stream,
        raw_metadata_json = EXCLUDED.raw_metadata_json,
        source_snapshot_id = EXCLUDED.source_snapshot_id,
        ingestion_run_id = EXCLUDED.ingestion_run_id,
        parser_version = EXCLUDED.parser_version,
        normalized_sha256 = EXCLUDED.normalized_sha256,
        updated_at = now()
      RETURNING id
    `,
    [
      bundle.release.version,
      bundle.release.majorLine,
      bundle.release.minorLine,
      bundle.release.patch,
      bundle.release.suffixChannel,
      bundle.release.suffixNumber,
      bundle.release.stream,
      bundle.release.releaseDate,
      bundle.release.changeset,
      bundle.release.shortRevision,
      bundle.release.releasePageUrl,
      bundle.release.releaseNotesUrl,
      bundle.release.unityHubDeepLink,
      bundle.release.rawMetadataJson,
      bundle.release.sourceSnapshotId,
      bundle.release.ingestionRunId,
      bundle.release.parserVersion,
      bundle.release.normalizedSha256
    ]
  );
  const releaseId = releaseResult.rows[0].id;

  await client.query("DELETE FROM release_sections WHERE unity_release_id = $1", [releaseId]);
  await client.query("DELETE FROM release_note_items WHERE unity_release_id = $1", [releaseId]);
  await client.query("DELETE FROM unity_release_artifacts WHERE unity_release_id = $1", [releaseId]);
  await client.query("DELETE FROM unity_release_modules WHERE unity_release_id = $1", [releaseId]);

  for (const section of bundle.sections) {
    await client.query(
      `
        INSERT INTO release_sections (
          unity_release_id, section, body, parser_confidence, source_order, source_snapshot_id, ingestion_run_id
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `,
      [
        releaseId,
        section.section,
        section.body,
        section.parserConfidence,
        section.sourceOrder,
        section.sourceSnapshotId,
        section.ingestionRunId
      ]
    );
  }

  for (const item of bundle.noteItems) {
    const inserted = await client.query<{ id: number }>(
      `
        INSERT INTO release_note_items (
          unity_release_id, version, major_line, minor_line, stream, release_date, section, area,
          platforms, impact_kind, risk_level, risk_reasons, body, issue_ids, issue_links_json,
          package_names, source_url, source_order, source_snapshot_id, ingestion_run_id,
          parser_version, normalized_sha256
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
        RETURNING id
      `,
      [
        releaseId,
        item.version,
        item.majorLine,
        item.minorLine,
        item.stream,
        item.releaseDate,
        item.section,
        item.area,
        item.platforms,
        item.impactKind,
        item.riskLevel,
        item.riskReasons,
        item.body,
        item.issueIds,
        JSON.stringify(item.issueLinks),
        item.packageNames,
        item.sourceUrl,
        item.sourceOrder,
        item.sourceSnapshotId,
        item.ingestionRunId,
        item.parserVersion,
        item.normalizedSha256
      ]
    );

    for (const issue of item.issueLinks) {
      await client.query(
        `
          INSERT INTO issue_mentions (
            issue_id, issue_url, unity_release_id, release_note_item_id, section, area, platforms, mention_kind
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        `,
        [issue.id, issue.url, releaseId, inserted.rows[0].id, item.section, item.area, item.platforms, item.impactKind]
      );
    }
  }

  for (const artifact of bundle.artifacts) {
    await client.query(
      `
        INSERT INTO unity_release_artifacts (
          unity_release_id, platform, architecture, category, name, url, source_snapshot_id
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT DO NOTHING
      `,
      [
        releaseId,
        artifact.platform,
        artifact.architecture,
        artifact.category,
        artifact.name,
        artifact.url,
        bundle.release.sourceSnapshotId
      ]
    );
  }

  for (const module of bundle.modules) {
    await client.query(
      `
        INSERT INTO unity_release_modules (
          unity_release_id, platform, architecture, module_name, module_category, url, source_snapshot_id
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT DO NOTHING
      `,
      [
        releaseId,
        module.platform,
        module.architecture,
        module.moduleName,
        module.moduleCategory,
        module.url,
        bundle.release.sourceSnapshotId
      ]
    );
  }

  await upsertContentEvent(client, bundle.event, {
    unityReleaseId: releaseId,
    sourceSnapshotId: bundle.release.sourceSnapshotId,
    ingestionRunId: bundle.release.ingestionRunId
  });

  return releaseId;
}

export async function upsertPackageBundle(client: PoolClient, bundle: PackageBundle) {
  const packageResult = await client.query<{ id: number }>(
    `
      INSERT INTO packages (
        name, display_name, description, documentation_url, keywords, source_url, source_snapshot_id, ingestion_run_id
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (name) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        description = EXCLUDED.description,
        documentation_url = EXCLUDED.documentation_url,
        source_snapshot_id = EXCLUDED.source_snapshot_id,
        ingestion_run_id = EXCLUDED.ingestion_run_id,
        updated_at = now()
      RETURNING id
    `,
    [
      bundle.packageRecord.name,
      bundle.packageRecord.displayName,
      bundle.packageRecord.description,
      bundle.packageRecord.documentationUrl,
      bundle.packageRecord.keywords,
      bundle.packageRecord.sourceUrl,
      bundle.packageRecord.sourceSnapshotId,
      bundle.packageRecord.ingestionRunId
    ]
  );
  const packageId = packageResult.rows[0].id;

  for (const version of bundle.versions) {
    const versionResult = await client.query<{ id: number }>(
      `
        INSERT INTO package_versions (
          package_id, version, published_at, unity_compatibility, unity_min_version, unity_max_version,
          is_prerelease, changelog, dependencies_json, dist_tags_json, tarball_url, shasum,
          raw_metadata_json, source_snapshot_id, ingestion_run_id, parser_version, normalized_sha256
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        ON CONFLICT (package_id, version) DO UPDATE SET
          published_at = EXCLUDED.published_at,
          changelog = EXCLUDED.changelog,
          dependencies_json = EXCLUDED.dependencies_json,
          dist_tags_json = EXCLUDED.dist_tags_json,
          source_snapshot_id = EXCLUDED.source_snapshot_id,
          ingestion_run_id = EXCLUDED.ingestion_run_id,
          parser_version = EXCLUDED.parser_version,
          normalized_sha256 = EXCLUDED.normalized_sha256,
          updated_at = now()
        RETURNING id
      `,
      [
        packageId,
        version.version,
        version.publishedAt,
        version.unityCompatibility,
        version.unityMinVersion,
        version.unityMaxVersion,
        version.isPrerelease,
        version.changelog,
        version.dependenciesJson,
        version.distTagsJson,
        version.tarballUrl,
        version.shasum,
        version.rawMetadataJson,
        version.sourceSnapshotId,
        version.ingestionRunId,
        version.parserVersion,
        version.normalizedSha256
      ]
    );

    const event = bundle.events.find((candidate) => candidate.title.endsWith(` ${version.version}`));
    if (event) {
      await upsertContentEvent(client, event, {
        packageVersionId: versionResult.rows[0].id,
        sourceSnapshotId: version.sourceSnapshotId,
        ingestionRunId: version.ingestionRunId
      });
    }
  }

  return packageId;
}

export async function upsertBlogPosts(
  client: PoolClient,
  posts: ParsedBlogPost[],
  sourceSnapshotId: number,
  ingestionRunId: number
) {
  for (const post of posts) {
    const postResult = await client.query<{ id: number }>(
      `
        INSERT INTO blog_posts (guid, title, description, link, published_at, categories, raw_xml_json)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (guid) DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          link = EXCLUDED.link,
          published_at = EXCLUDED.published_at,
          categories = EXCLUDED.categories,
          raw_xml_json = EXCLUDED.raw_xml_json,
          updated_at = now()
        RETURNING id
      `,
      [post.guid, post.title, post.description, post.link, post.publishedAt, post.categories, post]
    );

    await upsertContentEvent(
      client,
      {
        eventType: "blog_post",
        title: post.title,
        summary: post.description,
        eventTime: post.publishedAt,
        sourceUrl: post.link,
        stableGuid: post.guid,
        tags: post.categories
      },
      { blogPostId: postResult.rows[0].id, sourceSnapshotId, ingestionRunId }
    );
  }
}

async function upsertContentEvent(
  client: PoolClient,
  event: {
    eventType: string;
    title: string;
    summary: string;
    eventTime: string | null;
    sourceUrl: string;
    stableGuid: string;
    tags: string[];
  },
  refs: {
    unityReleaseId?: number;
    packageVersionId?: number;
    blogPostId?: number;
    hubReleaseId?: number;
    sourceSnapshotId?: number;
    ingestionRunId?: number;
  }
) {
  await client.query(
    `
      INSERT INTO content_events (
        event_type, title, summary, event_time, source_url, stable_guid, tags,
        unity_release_id, package_version_id, blog_post_id, hub_release_id,
        source_snapshot_id, ingestion_run_id
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT (stable_guid) DO UPDATE SET
        title = EXCLUDED.title,
        summary = EXCLUDED.summary,
        event_time = EXCLUDED.event_time,
        tags = EXCLUDED.tags
    `,
    [
      event.eventType,
      event.title,
      event.summary.slice(0, 2000),
      event.eventTime ?? new Date().toISOString(),
      event.sourceUrl,
      event.stableGuid,
      event.tags,
      refs.unityReleaseId ?? null,
      refs.packageVersionId ?? null,
      refs.blogPostId ?? null,
      refs.hubReleaseId ?? null,
      refs.sourceSnapshotId ?? null,
      refs.ingestionRunId ?? null
    ]
  );
}
