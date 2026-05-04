import { query } from "./client";
import { buildReleaseNoteSearchQuery, type ReleaseNoteSearchFilters } from "../search";

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
