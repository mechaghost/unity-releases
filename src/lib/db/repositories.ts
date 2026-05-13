import type { PoolClient } from "pg";
import { getPool, query } from "./client";
import {
  buildReleaseNoteSearchQuery,
  buildReleaseNoteWhereForVersions,
  type ReleaseNoteSearchFilters
} from "../search";
import { minorLinesBetween } from "../diff-grouping";
import { compareUnityVersions } from "../parsers/version";
import { deriveIssueStatus, type IssueStatus } from "../issue-status";
import type { FetchedSource } from "../ingest/fetch";
import type { normalizePackageForStorage } from "../ingest/packages";
import type { normalizeReleaseForStorage } from "../ingest/releases";
import type { ParsedBlogPost } from "../parsers/rss";
import type { ParsedResource } from "../ingest/resources";

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

/**
 * Resolve current resolution status for a batch of UUM issue ids by
 * scanning every release-note item that mentions them. Empty input
 * short-circuits to an empty map.
 *
 * Used by pages that render IssuePill chips so each chip can show a
 * fixed/open/regressed indicator at a glance instead of forcing the
 * user to click through.
 */
export async function getIssueStatuses(
  issueIds: string[],
  options: { relevantMajors?: ReadonlySet<number> } = {}
): Promise<Map<string, IssueStatus>> {
  const result = new Map<string, IssueStatus>();
  if (issueIds.length === 0) return result;

  const unique = [...new Set(issueIds)];
  const rows = (
    await query<{ issue_id: string; version: string; section: string; release_date: string | null }>(
      `SELECT iid AS issue_id, r.version, r.section, r.release_date
         FROM release_note_items r,
              unnest(r.issue_ids) AS iid
        WHERE iid = ANY($1)`,
      [unique]
    )
  ).rows;

  const grouped = new Map<string, Array<{ version: string; section: string; release_date: string | null }>>();
  const { relevantMajors } = options;
  for (const row of rows) {
    // Optional scope filter: drop mentions whose major isn't reachable
    // from the caller's context. The compare page passes the set of
    // majors covered by the diff range so a fix in 6000.3.0b1 doesn't
    // tag a 2022.3 issue as "resolved" when the user can't reach Unity
    // 6 without a major upgrade. The single-release-detail page omits
    // this filter and keeps the global mention history.
    if (relevantMajors) {
      const majorStr = row.version.slice(0, row.version.indexOf("."));
      const major = Number(majorStr);
      if (!Number.isFinite(major) || !relevantMajors.has(major)) continue;
    }
    const list = grouped.get(row.issue_id) ?? [];
    list.push({ version: row.version, section: row.section, release_date: row.release_date });
    grouped.set(row.issue_id, list);
  }
  for (const id of unique) {
    result.set(id, deriveIssueStatus(grouped.get(id) ?? []));
  }
  return result;
}

export type IngestionFreshness = {
  /** Source-type of an ingestion run (e.g. "editor_release"). */
  sourceType: string;
  /** Most recent successful ingestion (or null if never). */
  lastSuccessAt: string | null;
  /** Most recent run regardless of status - distinguishes "never" from "stale". */
  lastRunAt: string | null;
  /** Hours since lastSuccessAt; Infinity if never. */
  hoursSinceLastSuccess: number;
  /** True if no successful run in the last 30 days. */
  isStale: boolean;
};

/** Inventory of every ingestion source's last-success timestamps. */
export async function listIngestionFreshness(): Promise<IngestionFreshness[]> {
  const result = await query<{
    source_type: string;
    last_success: string | null;
    last_run: string | null;
  }>(
    `
      SELECT
        source_type,
        MAX(finished_at) FILTER (WHERE status = 'success') AS last_success,
        MAX(finished_at)                                   AS last_run
      FROM ingestion_runs
      GROUP BY source_type
      ORDER BY source_type ASC
    `
  );
  const now = Date.now();
  return result.rows.map((row) => {
    const ts = row.last_success ? new Date(row.last_success).getTime() : null;
    const hours = ts == null ? Infinity : (now - ts) / (1000 * 60 * 60);
    return {
      sourceType: row.source_type,
      lastSuccessAt: row.last_success,
      lastRunAt: row.last_run,
      hoursSinceLastSuccess: hours,
      // "Stale" threshold: 30 days. The polling cadence is up to the operator;
      // a real outage is when nothing has succeeded for the better part of a
      // month. Tighter banners belong in monitoring, not the dashboard.
      isStale: hours > 24 * 30
    };
  });
}

export type DiffRangeBounds = {
  fromVersion: string;
  toVersion: string;
  fromDate: string | null;
  toDate: string | null;
  versions: string[];
  reversed: boolean;
  /** Streams that were actually used to scope the range. */
  includedStreams: string[];
  /** Minor lines included (e.g. "6000.0", "6000.1"). */
  includedMinorLines: string[];
};

/**
 * Resolve the half-open release range (from, to] for a diff.
 *
 * Two filters are applied to avoid bringing in noise that wouldn't matter
 * for an upgrade decision:
 *   1. **Stream filter** - caller-supplied. The compare page passes the
 *      user's sidebar checkboxes here so the entire app honors the same
 *      "what streams am I tracking?" preference.
 *   2. **Minor-line filter** - only include minor lines on the path from
 *      `from` to `to` (so a 6000.3 → 6000.5 diff doesn't pick up 6000.6
 *      alphas that happened to ship during the same calendar window).
 *
 * If from > to, `reversed` is true so the page can label it as a downgrade.
 */
export async function resolveDiffRange(
  fromVersion: string,
  toVersion: string,
  allowedStreams: string[]
): Promise<DiffRangeBounds | null> {
  const result = await query<{
    version: string;
    release_date: string | null;
    stream: string;
    minor_line: string;
  }>(
    `
      SELECT version, release_date, stream, minor_line
      FROM unity_releases
      WHERE version = ANY($1::text[])
    `,
    [[fromVersion, toVersion]]
  );

  const fromRow = result.rows.find((r) => r.version === fromVersion);
  const toRow = result.rows.find((r) => r.version === toVersion);
  if (!fromRow || !toRow) return null;

  const fromDate = fromRow.release_date;
  const toDate = toRow.release_date;

  // Direction is determined by **semver order**, not release_date.
  // 6000.0 LTS gets ongoing patches that ship later than 6000.3 LTS's
  // initial release, so a date-based check would call 6000.0.74f1 →
  // 6000.3.14f1 a "downgrade" even though it's the headline forward path.
  // We fall back to date order only when both versions don't parse.
  let reversed = false;
  try {
    reversed = compareUnityVersions(fromVersion, toVersion) > 0;
  } catch {
    reversed = (fromDate ?? "") > (toDate ?? "");
  }
  // The release_date bounds for the range scan still use chronology
  // (we want the calendar-window of releases between the two), so when
  // we know it's a downgrade we still need the older of the two dates
  // as the lower bound.
  const fromTime = fromDate ? new Date(fromDate).getTime() : 0;
  const toTime = toDate ? new Date(toDate).getTime() : 0;
  const lower = fromTime <= toTime ? fromDate : toDate;
  const upper = fromTime <= toTime ? toDate : fromDate;

  const includedMinorLines = await minorLinesBetweenAcrossMajors(
    fromRow.minor_line,
    toRow.minor_line
  );

  // If the sidebar has unchecked everything we still need a non-empty
  // ANY() argument; an empty array would make the query return no rows.
  // Treat that as "no streams allowed → empty range" by short-circuiting.
  if (allowedStreams.length === 0) {
    return {
      fromVersion,
      toVersion,
      fromDate,
      toDate,
      versions: [],
      reversed,
      includedStreams: [],
      includedMinorLines
    };
  }

  const versions = await query<{ version: string }>(
    `
      SELECT version
      FROM unity_releases
      WHERE release_date IS NOT NULL
        AND release_date > $1::timestamptz
        AND release_date <= $2::timestamptz
        AND stream = ANY($3::text[])
        AND minor_line = ANY($4::text[])
      ORDER BY release_date ASC, version ASC
    `,
    [
      lower ?? new Date(0).toISOString(),
      upper ?? new Date().toISOString(),
      allowedStreams,
      includedMinorLines
    ]
  );

  return {
    fromVersion,
    toVersion,
    fromDate,
    toDate,
    versions: versions.rows.map((r) => r.version),
    reversed,
    includedStreams: allowedStreams,
    includedMinorLines
  };
}

/**
 * Cross-major-aware extension of `minorLinesBetween`. Within a single
 * major it defers to the pure helper. Across majors (e.g. 2019.4 →
 * 2022.3) it queries the DB for every distinct minor_line that exists
 * inside the major range so the diff naturally walks through 2020.3
 * and 2021.3 instead of skipping them. Falls back to the bare
 * endpoint pair if anything fails to parse.
 */
async function minorLinesBetweenAcrossMajors(
  fromMinor: string,
  toMinor: string
): Promise<string[]> {
  const parse = (s: string) => {
    const [maj, min] = s.split(".").map((n) => Number(n));
    return { maj, min };
  };
  const a = parse(fromMinor);
  const b = parse(toMinor);
  if (!Number.isFinite(a.maj) || !Number.isFinite(b.maj)) {
    return [fromMinor, toMinor];
  }
  if (a.maj === b.maj) {
    return minorLinesBetween(fromMinor, toMinor);
  }
  const lo = Math.min(a.maj, b.maj);
  const hi = Math.max(a.maj, b.maj);
  // major_line is TEXT; cast to int for a numeric BETWEEN. Sort by
  // (major::int, second-segment::int) so the returned list is in
  // canonical newest-major-first / lowest-minor-first order. Order
  // doesn't matter for the SQL `= ANY()` filter, but the result also
  // feeds the `includedMinorLines` value on DiffRangeBounds which is
  // visible in UI metadata, and sorting keeps it stable.
  const rows = (
    await query<{ minor_line: string }>(
      `
        SELECT DISTINCT minor_line
        FROM unity_releases
        WHERE major_line::int BETWEEN $1 AND $2
      `,
      [lo, hi]
    )
  ).rows;
  // Sort in JS — Postgres rejects ORDER BY expressions outside the
  // DISTINCT projection.
  const lines = rows
    .map((r) => r.minor_line)
    .sort((a, b) => {
      const ap = a.split(".").map((n) => Number(n));
      const bp = b.split(".").map((n) => Number(n));
      return (bp[0] - ap[0]) || (ap[1] - bp[1]);
    });
  // Guarantee the endpoints are present even if for some reason the DB
  // query missed them (shouldn't happen, but cheap insurance).
  if (!lines.includes(fromMinor)) lines.push(fromMinor);
  if (!lines.includes(toMinor)) lines.push(toMinor);
  return lines;
}

export type PackageBoundary = {
  packageName: string;
  /** Latest package_version published at-or-before the from-date. */
  fromVersion: string | null;
  /** Latest package_version published at-or-before the to-date. */
  toVersion: string | null;
  /** Number of package_versions strictly between (from, to]. */
  interveningCount: number;
};

/**
 * For a list of package names, resolve the package_version that was the
 * "latest available" at each end of the diff window. Lets the package
 * lane show "Input System: 1.10.0 → 1.11.2" instead of just the count
 * of Editor-side mentions.
 *
 * The optional `fromEditorMinor` / `toEditorMinor` arguments thread the
 * picker's actual editor minor lines (e.g. "2022.3", "6000.3") through
 * so the boundary query can exclude package_versions whose minimum
 * `unity_compatibility` is higher than the editor's minor. Without
 * this filter, a 2022.3 → 6000.3 diff renders maintenance patches that
 * happened to be published most recently (e.g. cinemachine 2.10.7 on
 * 2022.3) over the modern line (3.x) for the Unity 6 boundary — i.e.
 * a misleading downgrade arrow. The tuple comparison `(major, minor)`
 * is numeric so it survives minor ≥ 10 ("6000.10" vs "6000.2" beats
 * a lexical compare).
 */
export async function packageVersionsAtBoundary(
  packageNames: string[],
  fromDate: string | Date,
  toDate: string | Date,
  options: { fromEditorMinor?: string | null; toEditorMinor?: string | null } = {}
): Promise<Map<string, PackageBoundary>> {
  const out = new Map<string, PackageBoundary>();
  if (packageNames.length === 0) return out;

  const fromIso =
    fromDate instanceof Date ? fromDate.toISOString() : new Date(fromDate).toISOString();
  const toIso = toDate instanceof Date ? toDate.toISOString() : new Date(toDate).toISOString();
  const lower = fromIso < toIso ? fromIso : toIso;
  const upper = fromIso < toIso ? toIso : fromIso;

  // SQL fragment: keep package_versions whose declared minimum
  // unity_compatibility is ≤ the supplied editor minor line. NULL
  // compatibility is permissive (legacy registry entries). Empty
  // editor minor (caller didn't pass one) becomes a no-op TRUE.
  const compatPredicate = (editorParam: string) => `
    (pv.unity_compatibility IS NULL OR ${editorParam}::text = '' OR (
      (SPLIT_PART(pv.unity_compatibility, '.', 1))::int,
      (NULLIF(SPLIT_PART(pv.unity_compatibility, '.', 2), ''))::int
    ) <= (
      (SPLIT_PART(${editorParam}, '.', 1))::int,
      (NULLIF(SPLIT_PART(${editorParam}, '.', 2), ''))::int
    ))
  `;

  const result = await query<{
    name: string;
    from_version: string | null;
    to_version: string | null;
    intervening: string;
  }>(
    `
      SELECT
        p.name,
        (SELECT version FROM package_versions pv
          WHERE pv.package_id = p.id
            AND pv.published_at IS NOT NULL
            AND pv.published_at <= $2::timestamptz
            AND ${compatPredicate("$4")}
          ORDER BY pv.published_at DESC LIMIT 1) AS from_version,
        (SELECT version FROM package_versions pv
          WHERE pv.package_id = p.id
            AND pv.published_at IS NOT NULL
            AND pv.published_at <= $3::timestamptz
            AND ${compatPredicate("$5")}
          ORDER BY pv.published_at DESC LIMIT 1) AS to_version,
        (SELECT COUNT(*)::text FROM package_versions pv
          WHERE pv.package_id = p.id
            AND pv.published_at IS NOT NULL
            AND pv.published_at > $2::timestamptz
            AND pv.published_at <= $3::timestamptz) AS intervening
      FROM packages p
      WHERE p.name = ANY($1::text[])
    `,
    [packageNames, lower, upper, options.fromEditorMinor ?? "", options.toEditorMinor ?? ""]
  );

  for (const row of result.rows) {
    out.set(row.name, {
      packageName: row.name,
      fromVersion: row.from_version,
      toVersion: row.to_version,
      interveningCount: Number(row.intervening) || 0
    });
  }
  return out;
}

export async function searchReleaseNotesInRange(
  versions: string[],
  filters: ReleaseNoteSearchFilters,
  limit = 5000,
  offset = 0,
  options: { includeTotalCount?: boolean } = {}
) {
  if (versions.length === 0) return [];
  const built = buildReleaseNoteWhereForVersions(versions, filters, limit, offset, options);
  const result = await query(built.text, built.values);
  return result.rows;
}

export type ReleaseRangeFacets = {
  platforms: Array<{ value: string; count: number }>;
  packages: Array<{ value: string; count: number }>;
  areas: Array<{ value: string; count: number }>;
};

/**
 * Facet counts for the filter drawer. Returns the *available* values for
 * each multi-select dimension within the visible scope, plus the count of
 * notes that would match each value, so the drawer can show "iOS (12)".
 *
 * Scoped to the supplied `versions` set so /compare and /releases/[version]
 * both pre-populate accurate option lists.
 */
export async function getReleaseRangeFacets(versions: string[]): Promise<ReleaseRangeFacets> {
  if (versions.length === 0) {
    return { platforms: [], packages: [], areas: [] };
  }
  const platformsP = query<{ value: string; count: string }>(
    `
      SELECT value, COUNT(*)::text AS count
      FROM release_note_items, unnest(platforms) AS value
      WHERE version = ANY($1) AND value IS NOT NULL AND value <> ''
      GROUP BY value
      ORDER BY COUNT(*) DESC, value ASC
      LIMIT 200
    `,
    [versions]
  );
  const packagesP = query<{ value: string; count: string }>(
    `
      SELECT value, COUNT(*)::text AS count
      FROM release_note_items, unnest(package_names) AS value
      WHERE version = ANY($1) AND value IS NOT NULL AND value <> ''
      GROUP BY value
      ORDER BY COUNT(*) DESC, value ASC
      LIMIT 200
    `,
    [versions]
  );
  const areasP = query<{ value: string; count: string }>(
    `
      SELECT area AS value, COUNT(*)::text AS count
      FROM release_note_items
      WHERE version = ANY($1) AND area IS NOT NULL AND area <> ''
      GROUP BY area
      ORDER BY COUNT(*) DESC, area ASC
      LIMIT 200
    `,
    [versions]
  );
  const [platforms, packages, areas] = await Promise.all([platformsP, packagesP, areasP]);
  return {
    platforms: platforms.rows.map((r) => ({ value: r.value, count: Number(r.count) })),
    packages: packages.rows.map((r) => ({ value: r.value, count: Number(r.count) })),
    areas: areas.rows.map((r) => ({ value: r.value, count: Number(r.count) }))
  };
}

export type DiffRangeCounts = {
  totalNotes: number;
  byImpact: Record<string, number>;
  blockerKnownIssues: number;
  topPlatforms: Array<{ platform: string; count: number }>;
  topAreas: Array<{ area: string; count: number }>;
};

/**
 * Single-pass aggregate over the (from, to] range that powers all the
 * "X notes in this diff" numbers and the right-rail facets. Avoids
 * shipping rows back when we only need counts.
 */
export async function diffRangeCounts(
  versions: string[],
  platform?: string
): Promise<DiffRangeCounts> {
  if (versions.length === 0) {
    return { totalNotes: 0, byImpact: {}, blockerKnownIssues: 0, topPlatforms: [], topAreas: [] };
  }

  const platformFilter = platform ? "AND $2 = ANY(platforms)" : "";
  const params: Array<string | string[]> = platform ? [versions, platform] : [versions];

  const [impactResult, blockerResult, platformResult, areaResult] = await Promise.all([
    query<{ impact_kind: string; count: string }>(
      `
        SELECT impact_kind, COUNT(*)::text AS count
        FROM release_note_items
        WHERE version = ANY($1::text[]) ${platformFilter}
        GROUP BY impact_kind
      `,
      params
    ),
    query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM release_note_items
        WHERE version = ANY($1::text[]) ${platformFilter}
          AND impact_kind = 'known_issue' AND risk_level = 'blocker'
      `,
      params
    ),
    query<{ platform: string; count: string }>(
      `
        SELECT platform, COUNT(*)::text AS count
        FROM release_note_items, UNNEST(platforms) AS platform
        WHERE version = ANY($1::text[])
        GROUP BY platform
        ORDER BY 2::int DESC
        LIMIT 12
      `,
      [versions]
    ),
    query<{ area: string; count: string }>(
      `
        SELECT area, COUNT(*)::text AS count
        FROM release_note_items
        WHERE version = ANY($1::text[]) ${platformFilter}
          AND area IS NOT NULL
        GROUP BY area
        ORDER BY 2::int DESC
        LIMIT 12
      `,
      params
    )
  ]);

  const byImpact: Record<string, number> = {};
  let totalNotes = 0;
  for (const row of impactResult.rows) {
    const n = Number(row.count);
    byImpact[row.impact_kind] = n;
    totalNotes += n;
  }

  return {
    totalNotes,
    byImpact,
    blockerKnownIssues: Number(blockerResult.rows[0]?.count ?? 0),
    topPlatforms: platformResult.rows.map((r) => ({ platform: r.platform, count: Number(r.count) })),
    topAreas: areaResult.rows.map((r) => ({ area: r.area, count: Number(r.count) }))
  };
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

/** Map of release version → parsed-note-item count, used by the desktop
 *  releases table to render a "Parsed · N entries" status column without
 *  N+1 queries. Versions with no parsed notes are omitted. */
export async function listReleaseNoteCounts(): Promise<Record<string, number>> {
  const result = await query(
    `
      SELECT version, COUNT(*)::int AS note_count
      FROM release_note_items
      GROUP BY version
    `
  );
  const map: Record<string, number> = {};
  for (const row of result.rows as Array<{ version: string; note_count: number }>) {
    map[row.version] = row.note_count;
  }
  return map;
}

export async function listPackages(limit = 100) {
  const result = await query(
    `
      SELECT
        p.*,
        pv.version AS latest_version,
        pv.published_at AS latest_published_at,
        pv.is_prerelease AS latest_is_prerelease,
        pv.unity_compatibility AS latest_unity_compatibility
      FROM packages p
      LEFT JOIN LATERAL (
        SELECT version, published_at, is_prerelease, unity_compatibility
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

/**
 * Upsert a parsed resource. Used by the `poll-resources` job; called
 * once per resource page. The unique key is `slug` so re-runs update
 * in place.
 */
export async function upsertResource(
  client: PoolClient,
  resource: ParsedResource,
  lastmod: string | null,
  ingestionRunId: number,
  sourceSnapshotId: number | null
) {
  await client.query(
    `
      INSERT INTO resources (
        slug, url, title, summary, og_image, resource_type, industry, topics,
        is_gated, sfdc_form_id, resource_date, read_duration, author,
        lastmod, body_hash, raw_metadata_json, source_snapshot_id, ingestion_run_id
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      ON CONFLICT (slug) DO UPDATE SET
        url = EXCLUDED.url,
        title = EXCLUDED.title,
        summary = EXCLUDED.summary,
        og_image = EXCLUDED.og_image,
        resource_type = EXCLUDED.resource_type,
        industry = EXCLUDED.industry,
        topics = EXCLUDED.topics,
        is_gated = EXCLUDED.is_gated,
        sfdc_form_id = EXCLUDED.sfdc_form_id,
        resource_date = EXCLUDED.resource_date,
        read_duration = EXCLUDED.read_duration,
        author = EXCLUDED.author,
        lastmod = EXCLUDED.lastmod,
        body_hash = EXCLUDED.body_hash,
        raw_metadata_json = EXCLUDED.raw_metadata_json,
        source_snapshot_id = EXCLUDED.source_snapshot_id,
        ingestion_run_id = EXCLUDED.ingestion_run_id,
        updated_at = now()
    `,
    [
      resource.slug,
      resource.url,
      resource.title,
      resource.summary,
      resource.ogImage,
      resource.resourceType,
      resource.industry,
      resource.topics,
      resource.isGated,
      resource.sfdcFormId,
      resource.resourceDate,
      resource.readDuration,
      resource.author,
      lastmod,
      resource.bodyHash,
      resource.rawMetadata,
      sourceSnapshotId,
      ingestionRunId
    ]
  );
}

/** Read the slug → (lastmod, body_hash) map so the poller can skip
 *  pages whose sitemap lastmod hasn't advanced past what we already
 *  have. Returned in a single round-trip. */
export async function getResourceFreshness(): Promise<Map<string, { lastmod: string | null; bodyHash: string | null }>> {
  const result = await query<{ slug: string; lastmod: string | null; body_hash: string | null }>(
    "SELECT slug, lastmod::text AS lastmod, body_hash FROM resources"
  );
  const out = new Map<string, { lastmod: string | null; bodyHash: string | null }>();
  for (const row of result.rows) {
    out.set(row.slug, { lastmod: row.lastmod, bodyHash: row.body_hash });
  }
  return out;
}

export type ResourceListFilters = {
  /** Show case studies / reports / whitepapers (Unity's marketing-narrative
   *  formats). When false (default) those types are filtered out. */
  includeMarketing?: boolean;
  /** Show resources tagged with a non-games industry (Automotive,
   *  Manufacturing, Retail, Multi …) - Unity's enterprise pitch
   *  content. When false (default) those rows are filtered out. */
  includeEnterprise?: boolean;
  /** Restrict to specific resource types (E-book, Video, …). */
  types?: string[];
  /** Free-text search over title + summary. */
  q?: string;
  limit?: number;
  offset?: number;
};

export type ResourceRow = {
  slug: string;
  url: string;
  title: string;
  summary: string;
  og_image: string | null;
  resource_type: string | null;
  industry: string | null;
  topics: string[];
  is_gated: boolean;
  resource_date: string | null;
  read_duration: string | null;
  author: string | null;
};

/** Resource types that Unity uses for marketing-narrative content
 *  (customer wins, exec reports, gated whitepapers). Hidden by default. */
export const RESOURCE_MARKETING_TYPES = ["Case study", "Report", "Whitepaper"];

/**
 * Read resources for the /resources surface. Two independent toggles
 * control "fluff": `includeMarketing` lets case studies / reports /
 * whitepapers through, and `includeEnterprise` lets non-games-industry
 * rows through. Both default to false so the dev-focused view is the
 * landing experience.
 */
export async function listResources(
  filters: ResourceListFilters = {}
): Promise<{ rows: ResourceRow[]; total: number }> {
  const params: unknown[] = [];
  const conds: string[] = [];

  if (!filters.includeMarketing) {
    params.push(RESOURCE_MARKETING_TYPES);
    conds.push(`(resource_type IS NULL OR resource_type <> ALL($${params.length}::text[]))`);
  }
  if (!filters.includeEnterprise) {
    // Hide non-games industries. NULL or 'Other' = games content; anything
    // else (Automotive, Manufacturing, Retail, Multi …) is enterprise pitch.
    conds.push("(industry IS NULL OR industry = 'Other')");
  }

  if (filters.types && filters.types.length > 0) {
    params.push(filters.types);
    conds.push(`resource_type = ANY($${params.length}::text[])`);
  }

  if (filters.q) {
    params.push(`%${filters.q.toLowerCase()}%`);
    conds.push(
      `(LOWER(title) LIKE $${params.length} OR LOWER(summary) LIKE $${params.length})`
    );
  }

  const where = conds.length > 0 ? `WHERE ${conds.join(" AND ")}` : "";
  const limit = filters.limit ?? 100;
  const offset = filters.offset ?? 0;

  const totalResult = await query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM resources ${where}`,
    params
  );
  const total = Number(totalResult.rows[0]?.total ?? 0);

  params.push(limit, offset);
  const result = await query<ResourceRow>(
    `
      SELECT slug, url, title, summary, og_image, resource_type, industry,
             topics, is_gated, resource_date::text AS resource_date,
             read_duration, author
      FROM resources
      ${where}
      ORDER BY resource_date DESC NULLS LAST, slug
      LIMIT $${params.length - 1}
      OFFSET $${params.length}
    `,
    params
  );
  return { rows: result.rows, total };
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
