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
import type { GithubRepoInput, GithubEventInput } from "../ingest/github";

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
  ingestion_run_id?: number | null;
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

export type ArtifactStats = {
  /** Total Unity editor versions indexed. */
  editorReleases: number;
  /** Editor releases bucketed by stream (LTS/STABLE/BETA/ALPHA). */
  editorReleasesByStream: Array<{ stream: string; count: number }>;
  /** Total parsed release-note rows across every version. */
  releaseNoteItems: number;
  /** Distinct UUM issue ids mentioned in release notes. */
  trackedIssues: number;
  /** Curated packages in the catalogue. */
  trackedPackages: number;
  /** Total package versions across all curated packages. */
  packageVersions: number;
  /** Unity blog/news posts mirrored. */
  newsPosts: number;
  /** Unity 6 resources (ebooks/videos/etc) mirrored. */
  resources: number;
  /** Most recent editor release date - "latest tracked" for the stats hero. */
  latestReleaseDate: string | null;
  /** Most recent editor version (string, e.g. "6000.3.15f1"). */
  latestReleaseVersion: string | null;
};

/** One-shot aggregation of "what does this site actually track?" Reads
 *  every artifact table in a single query bundle so the /stats page
 *  doesn't pay the latency of 8 round-trips. */
export async function getArtifactStats(): Promise<ArtifactStats> {
  const result = await query<{
    editor_releases: string;
    release_note_items: string;
    tracked_issues: string;
    tracked_packages: string;
    package_versions: string;
    news_posts: string;
    resources: string;
    latest_release_date: string | null;
    latest_release_version: string | null;
  }>(`
    SELECT
      (SELECT COUNT(*) FROM unity_releases)                                AS editor_releases,
      (SELECT COUNT(*) FROM release_note_items)                            AS release_note_items,
      (SELECT COUNT(DISTINCT issue_id) FROM issue_mentions)                AS tracked_issues,
      (SELECT COUNT(*) FROM packages)                                      AS tracked_packages,
      (SELECT COUNT(*) FROM package_versions)                              AS package_versions,
      (SELECT COUNT(*) FROM content_events WHERE event_type = 'blog_post') AS news_posts,
      (SELECT COUNT(*) FROM resources)                                     AS resources,
      (SELECT MAX(release_date) FROM unity_releases)                       AS latest_release_date,
      (SELECT version FROM unity_releases
        ORDER BY release_date DESC NULLS LAST, version DESC LIMIT 1)       AS latest_release_version
  `);

  const streamRows = await query<{ stream: string; count: string }>(`
    SELECT stream, COUNT(*)::bigint AS count
    FROM unity_releases
    GROUP BY stream
    ORDER BY COUNT(*) DESC
  `);

  const row = result.rows[0] ?? null;
  if (!row) {
    return emptyArtifactStats();
  }

  return {
    editorReleases: Number(row.editor_releases),
    editorReleasesByStream: streamRows.rows.map((r) => ({
      stream: r.stream,
      count: Number(r.count)
    })),
    releaseNoteItems: Number(row.release_note_items),
    trackedIssues: Number(row.tracked_issues),
    trackedPackages: Number(row.tracked_packages),
    packageVersions: Number(row.package_versions),
    newsPosts: Number(row.news_posts),
    resources: Number(row.resources),
    latestReleaseDate: row.latest_release_date,
    latestReleaseVersion: row.latest_release_version
  };
}

function emptyArtifactStats(): ArtifactStats {
  return {
    editorReleases: 0,
    editorReleasesByStream: [],
    releaseNoteItems: 0,
    trackedIssues: 0,
    trackedPackages: 0,
    packageVersions: 0,
    newsPosts: 0,
    resources: 0,
    latestReleaseDate: null,
    latestReleaseVersion: null
  };
}

export type TrafficStats = {
  /** Total pageviews in each rolling window. */
  pageViews24h: number;
  pageViews7d: number;
  pageViews30d: number;
  /** Top paths by view count in the last 7 days. */
  topPaths7d: Array<{ path: string; views: number }>;
  /** Total events recorded across all kinds in the last 30 days. */
  events30d: number;
  /** Event counts by type in the last 30 days. */
  eventsByType30d: Array<{ eventType: string; count: number }>;
};

/** Pulls site traffic + interaction stats. Returns zeros for any
 *  window with no data so the /stats page can render cleanly on a
 *  fresh deploy. */
export async function getTrafficStats(): Promise<TrafficStats> {
  const totals = await query<{
    views_24h: string;
    views_7d: string;
    views_30d: string;
    events_30d: string;
  }>(`
    SELECT
      (SELECT COUNT(*) FROM page_views  WHERE viewed_at   > now() - INTERVAL '1 day')   AS views_24h,
      (SELECT COUNT(*) FROM page_views  WHERE viewed_at   > now() - INTERVAL '7 days')  AS views_7d,
      (SELECT COUNT(*) FROM page_views  WHERE viewed_at   > now() - INTERVAL '30 days') AS views_30d,
      (SELECT COUNT(*) FROM site_events WHERE occurred_at > now() - INTERVAL '30 days') AS events_30d
  `);

  const top = await query<{ path: string; views: string }>(`
    SELECT path, COUNT(*)::bigint AS views
    FROM page_views
    WHERE viewed_at > now() - INTERVAL '7 days'
    GROUP BY path
    ORDER BY views DESC, path ASC
    LIMIT 15
  `);

  const byType = await query<{ event_type: string; count: string }>(`
    SELECT event_type, COUNT(*)::bigint AS count
    FROM site_events
    WHERE occurred_at > now() - INTERVAL '30 days'
    GROUP BY event_type
    ORDER BY count DESC, event_type ASC
  `);

  const row = totals.rows[0];
  return {
    pageViews24h: Number(row?.views_24h ?? 0),
    pageViews7d: Number(row?.views_7d ?? 0),
    pageViews30d: Number(row?.views_30d ?? 0),
    topPaths7d: top.rows.map((r) => ({ path: r.path, views: Number(r.views) })),
    events30d: Number(row?.events_30d ?? 0),
    eventsByType30d: byType.rows.map((r) => ({
      eventType: r.event_type,
      count: Number(r.count)
    }))
  };
}

/** Top issue ids by mention count, used by the sitemap so search
 *  engines can discover the most-referenced `/issues/UUM-xxxxx` pages
 *  without crawling every release page first. Ordered by mention
 *  count desc, then by issue id for a stable build output. */
export async function listTopIssueIds(limit = 500): Promise<string[]> {
  const result = await query<{ issue_id: string }>(
    `
      SELECT issue_id
      FROM issue_mentions
      GROUP BY issue_id
      ORDER BY COUNT(*) DESC, issue_id ASC
      LIMIT $1
    `,
    [limit]
  );
  return result.rows.map((r) => r.issue_id);
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
        pv.unity_compatibility AS latest_unity_compatibility,
        puv.unity_minor AS unified_unity_minor,
        puv.aligned_version AS unified_version
      FROM packages p
      LEFT JOIN LATERAL (
        SELECT version, published_at, is_prerelease, unity_compatibility
        FROM package_versions
        WHERE package_id = p.id
        ORDER BY published_at DESC NULLS LAST, version DESC
        LIMIT 1
      ) pv ON true
      LEFT JOIN package_unified_versions puv ON puv.package_name = p.name
      ORDER BY p.name ASC
      LIMIT $1
    `,
    [limit]
  );
  return result.rows;
}

export type EditorBundledVersion = {
  toVersion: string;
  editorVersion: string;
  releaseDate: string | null;
};

/**
 * For each package, the version it currently ships bundled with the Editor,
 * reconciled from release notes. Prefers final/patch builds (suffix_channel
 * f/p) over alpha/beta, then the most recent release, so the headline number
 * matches what a stable Unity 6 user actually has. Keyed by package name.
 */
export async function getEditorBundledVersions(): Promise<Map<string, EditorBundledVersion>> {
  const result = await query<{
    package_name: string;
    to_version: string;
    editor_version: string;
    release_date: string | null;
  }>(
    `
      SELECT DISTINCT ON (epv.package_name)
        epv.package_name,
        epv.to_version,
        epv.editor_version,
        r.release_date
      FROM editor_package_versions epv
      JOIN unity_releases r ON r.id = epv.unity_release_id
      WHERE epv.to_version IS NOT NULL
        -- Only Unity 6 editors: these packages are Unity-6-bound, and a
        -- recent legacy-LTS patch (2022.3.x) must not outrank a 6000.x build
        -- and report the wrong (legacy) bundled version.
        AND r.version LIKE '6000.%'
      ORDER BY
        epv.package_name,
        (r.suffix_channel IN ('f', 'p')) DESC,
        r.release_date DESC NULLS LAST,
        epv.editor_version DESC
    `
  );
  const map = new Map<string, EditorBundledVersion>();
  for (const row of result.rows) {
    map.set(row.package_name, {
      toVersion: row.to_version,
      editorVersion: row.editor_version,
      releaseDate: row.release_date
    });
  }
  return map;
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

  // Map each package version to the editor build that bundled it, reconciled
  // from the editors' "Package changes" notes. Prefer a stable (f/p) build
  // over a beta/alpha, then the earliest such build - betas predate their
  // stable, so "earliest by date" alone skews the mapping to previews. Gives
  // the exact Unity version a package version shipped with. Empty until editor
  // ingest populates editor_package_versions.
  const bundled = await query<{ package_version: string; editor_version: string }>(
    `
      SELECT DISTINCT ON (epv.to_version)
        epv.to_version AS package_version,
        epv.editor_version
      FROM editor_package_versions epv
      JOIN unity_releases r ON r.id = epv.unity_release_id
      WHERE epv.package_name = $1 AND epv.to_version IS NOT NULL
      ORDER BY
        epv.to_version,
        (r.suffix_channel IN ('f', 'p')) DESC,
        r.release_date ASC NULLS LAST,
        epv.editor_version ASC
    `,
    [name]
  );
  const bundledByVersion = new Map(
    bundled.rows.map((row) => [row.package_version, row.editor_version])
  );
  const versionsWithEditor = versions.rows.map((v) => ({
    ...v,
    bundled_in_editor: bundledByVersion.get((v as { version: string }).version) ?? null
  }));

  // Unity 6.4+ unified versioning: if this package is renumbered to match the
  // Editor (e.g. entities -> 6.4.0) the registry version list below is the old
  // line; this row carries the Editor-aligned version so the dialog can frame
  // the two schemes.
  const unified = await query<{ unity_minor: string; aligned_version: string }>(
    `SELECT unity_minor, aligned_version FROM package_unified_versions WHERE package_name = $1`,
    [name]
  );

  return {
    package: pkg.rows[0],
    versions: versionsWithEditor,
    unified: unified.rows[0] ?? null
  };
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
  await client.query("DELETE FROM editor_package_versions WHERE unity_release_id = $1", [releaseId]);
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

  for (const change of bundle.packageChanges) {
    await client.query(
      `
        INSERT INTO editor_package_versions (
          unity_release_id, editor_version, package_name, from_version, to_version,
          change_kind, source_snapshot_id, ingestion_run_id
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (unity_release_id, package_name, change_kind) DO UPDATE SET
          from_version = EXCLUDED.from_version,
          to_version = EXCLUDED.to_version,
          editor_version = EXCLUDED.editor_version,
          source_snapshot_id = EXCLUDED.source_snapshot_id,
          ingestion_run_id = EXCLUDED.ingestion_run_id
      `,
      [
        releaseId,
        change.editorVersion,
        change.packageName,
        change.fromVersion,
        change.toVersion,
        change.changeKind,
        change.sourceSnapshotId,
        change.ingestionRunId
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

export type IngestionRunRow = {
  id: string;
  source_type: string;
  job_name: string;
  started_at: Date | string;
  finished_at: Date | string | null;
  status: string;
  parser_version: string;
  source_count: number;
  records_created: number;
  records_updated: number;
  records_deleted: number;
  error_message: string | null;
};

export type TimelineEvent =
  | {
      type: "content";
      id: string;
      eventType: string;
      title: string;
      summary: string;
      timestamp: string;
      sourceUrl: string;
      tags: string[];
      riskLevel: string | null;
      isGroup?: boolean;
      groupItems?: Array<{
        id: string;
        title: string;
        summary: string;
        sourceUrl: string;
        tags: string[];
      }>;
    }
  | {
      type: "ingestion";
      id: string;
      jobName: string;
      sourceType: string;
      timestamp: string;
      finishedAt: string | null;
      status: string;
      recordsCreated: number;
      recordsUpdated: number;
      recordsDeleted: number;
      errorMessage: string | null;
      updates?: Array<{
        id: string;
        eventType: string;
        title: string;
        sourceUrl: string;
      }>;
    };

export async function listTimelineFeed(limit = 100): Promise<TimelineEvent[]> {
  const contentPromise = query<FeedEventRow>(
    `SELECT id, event_type, title, summary, event_time, source_url, stable_guid, risk_level, tags, ingestion_run_id
     FROM content_events
     ORDER BY event_time DESC
     LIMIT $1`,
    [limit * 2]
  );

  const ingestionPromise = query<IngestionRunRow>(
    `SELECT id::text, source_type, job_name, started_at, finished_at, status, records_created, records_updated, records_deleted, error_message
     FROM ingestion_runs
     ORDER BY started_at DESC
     LIMIT $1`,
    [limit]
  );

  const [contentResult, ingestionResult] = await Promise.all([contentPromise, ingestionPromise]);

  const runIds = ingestionResult.rows.map((row) => Number(row.id)).filter((id) => !isNaN(id));
  const updatesByRunId: Record<number, Array<{ id: string; eventType: string; title: string; sourceUrl: string }>> = {};

  if (runIds.length > 0) {
    try {
      const updatesResult = await query<{
        id: number;
        event_type: string;
        title: string;
        source_url: string;
        ingestion_run_id: number;
      }>(
        `SELECT id, event_type, title, source_url, ingestion_run_id
         FROM content_events
         WHERE ingestion_run_id = ANY($1::bigint[])`,
        [runIds]
      );

      for (const row of updatesResult.rows) {
        if (!updatesByRunId[row.ingestion_run_id]) {
          updatesByRunId[row.ingestion_run_id] = [];
        }
        updatesByRunId[row.ingestion_run_id].push({
          id: `content-${row.id}`,
          eventType: row.event_type,
          title: row.title,
          sourceUrl: row.source_url
        });
      }
    } catch (err) {
      console.error("Failed to query ingestion run updates:", err);
    }
  }

  // Group content events by ingestion_run_id and event_type
  const groupedContent: Record<string, FeedEventRow[]> = {};
  const ungroupedContent: FeedEventRow[] = [];

  for (const row of contentResult.rows) {
    if (row.ingestion_run_id) {
      const key = `${row.ingestion_run_id}-${row.event_type}`;
      if (!groupedContent[key]) {
        groupedContent[key] = [];
      }
      groupedContent[key].push(row);
    } else {
      ungroupedContent.push(row);
    }
  }

  const contentEvents: TimelineEvent[] = [];

  // Grouped content processing
  for (const key in groupedContent) {
    const rows = groupedContent[key];
    if (rows.length === 1) {
      ungroupedContent.push(rows[0]);
    } else {
      const first = rows[0];
      const eventType = first.event_type;
      
      rows.sort((a, b) => new Date(b.event_time).getTime() - new Date(a.event_time).getTime());
      
      const tagsSet = new Set<string>();
      rows.forEach(r => (r.tags || []).forEach(t => tagsSet.add(t)));

      let groupTitle = "";
      if (eventType === "package_version") {
        groupTitle = `${rows.length} Packages Updated`;
      } else if (eventType === "blog_post") {
        groupTitle = `${rows.length} Blog Posts Published`;
      } else {
        groupTitle = `${rows.length} ${eventType} Updates`;
      }

      contentEvents.push({
        type: "content" as const,
        id: `content-group-${first.ingestion_run_id}-${eventType}`,
        eventType: `${eventType}_group`,
        title: groupTitle,
        summary: `Grouped updates from scraper job.`,
        timestamp: new Date(rows[0].event_time).toISOString(),
        sourceUrl: first.source_url,
        tags: Array.from(tagsSet),
        riskLevel: null,
        isGroup: true,
        groupItems: rows.map(r => ({
          id: String(r.id),
          title: r.title,
          summary: r.summary,
          sourceUrl: r.source_url,
          tags: r.tags || []
        }))
      });
    }
  }

  // Process ungrouped items
  for (const row of ungroupedContent) {
    contentEvents.push({
      type: "content" as const,
      id: `content-${row.id}`,
      eventType: row.event_type,
      title: row.title,
      summary: row.summary,
      timestamp: row.event_time ? new Date(row.event_time).toISOString() : new Date().toISOString(),
      sourceUrl: row.source_url,
      tags: row.tags || [],
      riskLevel: row.risk_level
    });
  }

  const events: TimelineEvent[] = [
    ...contentEvents,
    ...ingestionResult.rows.map((row) => {
      const runIdNum = Number(row.id);
      return {
        type: "ingestion" as const,
        id: `ingestion-${row.id}`,
        jobName: row.job_name,
        sourceType: row.source_type,
        timestamp: row.started_at ? new Date(row.started_at).toISOString() : new Date().toISOString(),
        finishedAt: row.finished_at ? new Date(row.finished_at).toISOString() : null,
        status: row.status,
        recordsCreated: Number(row.records_created || 0),
        recordsUpdated: Number(row.records_updated || 0),
        recordsDeleted: Number(row.records_deleted || 0),
        errorMessage: row.error_message,
        updates: updatesByRunId[runIdNum] || []
      };
    })
  ];

  return events
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

// =====================================================================
// Unity Discussions repository functions
// =====================================================================

export type DiscourseStaffUserInput = {
  discourseUserId: number;
  username: string;
  displayName?: string | null;
  avatarTemplate?: string | null;
  userTitle?: string | null;
  trustLevel?: number | null;
  primaryGroupName?: string | null;
  flairGroupId?: number | null;
  lastPostedAt?: string | null;
  lastSeenAt?: string | null;
  addedToGroupAt?: string | null;
  activeInGroup?: boolean;
  rawMetadata?: Record<string, unknown>;
  sourceSnapshotId?: number | null;
  ingestionRunId: number;
  parserVersion: string;
};

export type DiscourseCategoryInput = {
  discourseCategoryId: number;
  slug: string;
  name: string;
  parentDiscourseCategoryId?: number | null;
  description?: string | null;
  color?: string | null;
  textColor?: string | null;
  rawMetadata?: Record<string, unknown>;
  sourceSnapshotId?: number | null;
  ingestionRunId: number;
  parserVersion: string;
};

export type DiscoursePostInput = {
  discoursePostId: number;
  discourseTopicId: number;
  postNumber: number;
  topicSlug: string | null;
  topicTitle: string | null;
  staffUserDbId: number | null;
  discourseUserId: number;
  username: string;
  wasStaffAtPost: boolean;
  discourseCategoryId: number | null;
  tags: string[];
  raw: string;
  cooked: string;
  excerpt: string | null;
  rawSha256: string;
  discourseVersion: number;
  editReason: string | null;
  discourseCreatedAt: string;
  discourseUpdatedAt: string;
  lastEditedAt: string | null;
  replyCount: number;
  reads: number | null;
  score: number | null;
  incomingLinkCount: number;
  rawMetadata: Record<string, unknown>;
  sourceSnapshotId: number | null;
  ingestionRunId: number;
  parserVersion: string;
};

export type DiscoursePostRevisionInput = {
  discoursePostDbId: number;
  discoursePostId: number;
  discourseVersion: number;
  raw: string;
  rawSha256: string;
  editReason: string | null;
  observedUpdatedAt: string;
  sourceSnapshotId: number | null;
  ingestionRunId: number;
  parserVersion: string;
};

/** Snapshot of every tracked post's current (version, raw_sha256,
 *  updated_at) so the ingester can do change-detection in O(N) without
 *  a per-post round-trip. Keyed by discourse_post_id. */
export type DiscoursePostFreshness = {
  id: number;
  discourseVersion: number;
  rawSha256: string;
  discourseUpdatedAt: string;
};

export async function getDiscoursePostFreshness(): Promise<Map<number, DiscoursePostFreshness>> {
  const result = await query<{
    id: string;
    discourse_post_id: string;
    discourse_version: number;
    raw_sha256: string;
    discourse_updated_at: string;
  }>(`
    SELECT id, discourse_post_id, discourse_version, raw_sha256, discourse_updated_at
    FROM discourse_posts
  `);
  const map = new Map<number, DiscoursePostFreshness>();
  for (const row of result.rows) {
    map.set(Number(row.discourse_post_id), {
      id: Number(row.id),
      discourseVersion: row.discourse_version,
      rawSha256: row.raw_sha256,
      discourseUpdatedAt: new Date(row.discourse_updated_at).toISOString()
    });
  }
  return map;
}

export async function upsertDiscourseStaffUsers(
  client: PoolClient,
  users: DiscourseStaffUserInput[]
): Promise<void> {
  for (const u of users) {
    await client.query(
      `
        INSERT INTO discourse_staff_users (
          discourse_user_id, username, display_name, avatar_template, user_title,
          trust_level, primary_group_name, flair_group_id,
          last_posted_at, last_seen_at, added_to_group_at,
          active_in_group, last_polled_at, raw_metadata_json,
          source_snapshot_id, ingestion_run_id, parser_version
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now(),$13,$14,$15,$16)
        ON CONFLICT (discourse_user_id) DO UPDATE SET
          username = EXCLUDED.username,
          display_name = EXCLUDED.display_name,
          avatar_template = EXCLUDED.avatar_template,
          user_title = EXCLUDED.user_title,
          trust_level = EXCLUDED.trust_level,
          primary_group_name = EXCLUDED.primary_group_name,
          flair_group_id = EXCLUDED.flair_group_id,
          last_posted_at = EXCLUDED.last_posted_at,
          last_seen_at = EXCLUDED.last_seen_at,
          added_to_group_at = COALESCE(discourse_staff_users.added_to_group_at, EXCLUDED.added_to_group_at),
          active_in_group = EXCLUDED.active_in_group,
          last_polled_at = now(),
          raw_metadata_json = EXCLUDED.raw_metadata_json,
          source_snapshot_id = EXCLUDED.source_snapshot_id,
          ingestion_run_id = EXCLUDED.ingestion_run_id,
          parser_version = EXCLUDED.parser_version,
          updated_at = now()
      `,
      [
        u.discourseUserId,
        u.username,
        u.displayName ?? null,
        u.avatarTemplate ?? null,
        u.userTitle ?? null,
        u.trustLevel ?? null,
        u.primaryGroupName ?? null,
        u.flairGroupId ?? null,
        u.lastPostedAt ?? null,
        u.lastSeenAt ?? null,
        u.addedToGroupAt ?? null,
        u.activeInGroup ?? true,
        JSON.stringify(u.rawMetadata ?? {}),
        u.sourceSnapshotId ?? null,
        u.ingestionRunId,
        u.parserVersion
      ]
    );
  }
}

/** Mark every staff user NOT in the latest roster walk as
 *  inactive_in_group=false. We keep the row so historical post
 *  attribution survives; we just stop polling them. Returns the
 *  number of users newly marked inactive. */
export async function markMissingDiscourseStaffUsersInactive(
  client: PoolClient,
  currentDiscourseUserIds: number[]
): Promise<number> {
  if (currentDiscourseUserIds.length === 0) return 0;
  const result = await client.query<{ count: string }>(
    `
      WITH marked AS (
        UPDATE discourse_staff_users
        SET active_in_group = false, updated_at = now()
        WHERE active_in_group = true
          AND discourse_user_id <> ALL($1::bigint[])
        RETURNING id
      )
      SELECT COUNT(*)::text AS count FROM marked
    `,
    [currentDiscourseUserIds]
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function upsertDiscourseCategories(
  client: PoolClient,
  categories: DiscourseCategoryInput[]
): Promise<void> {
  for (const c of categories) {
    await client.query(
      `
        INSERT INTO discourse_categories (
          discourse_category_id, slug, name, parent_discourse_category_id,
          description, color, text_color, raw_metadata_json,
          source_snapshot_id, ingestion_run_id, parser_version
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT (discourse_category_id) DO UPDATE SET
          slug = EXCLUDED.slug,
          name = EXCLUDED.name,
          parent_discourse_category_id = EXCLUDED.parent_discourse_category_id,
          description = EXCLUDED.description,
          color = EXCLUDED.color,
          text_color = EXCLUDED.text_color,
          raw_metadata_json = EXCLUDED.raw_metadata_json,
          source_snapshot_id = EXCLUDED.source_snapshot_id,
          ingestion_run_id = EXCLUDED.ingestion_run_id,
          parser_version = EXCLUDED.parser_version,
          updated_at = now()
      `,
      [
        c.discourseCategoryId,
        c.slug,
        c.name,
        c.parentDiscourseCategoryId ?? null,
        c.description ?? null,
        c.color ?? null,
        c.textColor ?? null,
        JSON.stringify(c.rawMetadata ?? {}),
        c.sourceSnapshotId ?? null,
        c.ingestionRunId,
        c.parserVersion
      ]
    );
  }
}

/** Compare freshness state against the incoming post; write a revision
 *  row when the version bumped or raw_sha256 differs. ON CONFLICT
 *  (discourse_post_id, discourse_version) DO NOTHING makes re-polls
 *  idempotent. Returns whether a new revision row was written - the
 *  caller uses this to decide whether to bump last_edited_at on the
 *  live row. */
export async function insertDiscoursePostRevisionIfChanged(
  client: PoolClient,
  previous: { discourseVersion: number; rawSha256: string } | null,
  next: DiscoursePostRevisionInput
): Promise<boolean> {
  if (
    previous &&
    previous.discourseVersion === next.discourseVersion &&
    previous.rawSha256 === next.rawSha256
  ) {
    return false;
  }
  const result = await client.query(
    `
      INSERT INTO discourse_post_revisions (
        discourse_post_db_id, discourse_post_id, discourse_version,
        raw, raw_sha256, edit_reason, observed_updated_at,
        source_snapshot_id, ingestion_run_id, parser_version
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (discourse_post_id, discourse_version) DO NOTHING
    `,
    [
      next.discoursePostDbId,
      next.discoursePostId,
      next.discourseVersion,
      next.raw,
      next.rawSha256,
      next.editReason,
      next.observedUpdatedAt,
      next.sourceSnapshotId,
      next.ingestionRunId,
      next.parserVersion
    ]
  );
  return (result.rowCount ?? 0) > 0;
}

/** Returns { id, wasInsert }. `id` is the discourse_posts.id surrogate
 *  PK so the caller can use it as discoursePostDbId in a revision
 *  insert without an extra round-trip. */
export async function upsertDiscoursePost(
  client: PoolClient,
  post: DiscoursePostInput
): Promise<{ id: number; wasInsert: boolean }> {
  const result = await client.query<{ id: string; was_insert: boolean }>(
    `
      INSERT INTO discourse_posts (
        discourse_post_id, discourse_topic_id, post_number,
        topic_slug, topic_title,
        staff_user_id, discourse_user_id, username, was_staff_at_post,
        discourse_category_id, tags,
        raw, cooked, excerpt, raw_sha256,
        discourse_version, edit_reason,
        discourse_created_at, discourse_updated_at, last_edited_at,
        reply_count, reads, score, incoming_link_count,
        is_deleted, deleted_at,
        raw_metadata_json,
        source_snapshot_id, ingestion_run_id, parser_version
      )
      VALUES (
        $1,$2,$3, $4,$5, $6,$7,$8,$9, $10,$11,
        $12,$13,$14,$15, $16,$17,
        $18,$19,$20, $21,$22,$23,$24,
        false, NULL,
        $25, $26,$27,$28
      )
      ON CONFLICT (discourse_post_id) DO UPDATE SET
        discourse_topic_id = EXCLUDED.discourse_topic_id,
        post_number = EXCLUDED.post_number,
        topic_slug = EXCLUDED.topic_slug,
        topic_title = EXCLUDED.topic_title,
        staff_user_id = EXCLUDED.staff_user_id,
        discourse_user_id = EXCLUDED.discourse_user_id,
        username = EXCLUDED.username,
        -- was_staff_at_post is a snapshot from FIRST insert - never
        -- overwrite, so a later non-staff sighting doesn't relabel.
        was_staff_at_post = discourse_posts.was_staff_at_post,
        discourse_category_id = EXCLUDED.discourse_category_id,
        tags = EXCLUDED.tags,
        raw = EXCLUDED.raw,
        cooked = EXCLUDED.cooked,
        excerpt = EXCLUDED.excerpt,
        raw_sha256 = EXCLUDED.raw_sha256,
        discourse_version = EXCLUDED.discourse_version,
        -- edit_reason + last_edited_at: COALESCE so a non-editing poll
        -- (where the post payload doesn't supply a reason / edit
        -- timestamp) doesn't blow away the last known good values.
        -- The ingester only sets these to non-null when it detects a
        -- real edit (version bump or raw_sha256 differs); otherwise
        -- it passes null and the existing value is preserved.
        edit_reason = COALESCE(EXCLUDED.edit_reason, discourse_posts.edit_reason),
        discourse_updated_at = EXCLUDED.discourse_updated_at,
        last_edited_at = COALESCE(EXCLUDED.last_edited_at, discourse_posts.last_edited_at),
        reply_count = EXCLUDED.reply_count,
        reads = EXCLUDED.reads,
        score = EXCLUDED.score,
        incoming_link_count = EXCLUDED.incoming_link_count,
        -- An upsert never un-tombstones a soft-deleted row implicitly.
        -- That's a job for a separate revive path (not implemented).
        is_deleted = discourse_posts.is_deleted,
        raw_metadata_json = EXCLUDED.raw_metadata_json,
        source_snapshot_id = EXCLUDED.source_snapshot_id,
        ingestion_run_id = EXCLUDED.ingestion_run_id,
        parser_version = EXCLUDED.parser_version,
        updated_at = now()
      RETURNING id::text, (xmax = 0) AS was_insert
    `,
    [
      post.discoursePostId,
      post.discourseTopicId,
      post.postNumber,
      post.topicSlug,
      post.topicTitle,
      post.staffUserDbId,
      post.discourseUserId,
      post.username,
      post.wasStaffAtPost,
      post.discourseCategoryId,
      post.tags,
      post.raw,
      post.cooked,
      post.excerpt,
      post.rawSha256,
      post.discourseVersion,
      post.editReason,
      post.discourseCreatedAt,
      post.discourseUpdatedAt,
      post.lastEditedAt,
      post.replyCount,
      post.reads,
      post.score,
      post.incomingLinkCount,
      JSON.stringify(post.rawMetadata ?? {}),
      post.sourceSnapshotId,
      post.ingestionRunId,
      post.parserVersion
    ]
  );
  const row = result.rows[0];
  if (!row) throw new Error(`upsertDiscoursePost returned no row`);
  return { id: Number(row.id), wasInsert: row.was_insert };
}

/** Soft-delete: a /posts/:id.json 404 means the upstream post is gone.
 *  We keep the row so URLs resolve and historical attribution stands;
 *  the page just renders a tombstone. Returns whether the row was
 *  already tombstoned. */
export async function tombstoneDiscoursePost(
  client: PoolClient,
  discoursePostId: number,
  ingestionRunId: number
): Promise<{ alreadyDeleted: boolean }> {
  const result = await client.query<{ was_deleted: boolean }>(
    `
      UPDATE discourse_posts
      SET is_deleted = true,
          deleted_at = COALESCE(deleted_at, now()),
          ingestion_run_id = $2,
          updated_at = now()
      WHERE discourse_post_id = $1
      RETURNING (deleted_at < now()) AS was_deleted
    `,
    [discoursePostId, ingestionRunId]
  );
  return { alreadyDeleted: (result.rows[0]?.was_deleted ?? false) === true };
}

/** Resolve a staff user's surrogate PK by discourse_user_id, returning
 *  null if we haven't ingested them yet. The ingester uses this to set
 *  staff_user_id on discourse_posts. Bulk lookups should call this in
 *  parallel with the per-user fetch. */
export async function findDiscourseStaffUserDbId(
  discourseUserId: number
): Promise<number | null> {
  const r = await query<{ id: string }>(
    `SELECT id FROM discourse_staff_users WHERE discourse_user_id = $1`,
    [discourseUserId]
  );
  return r.rows[0] ? Number(r.rows[0].id) : null;
}

// ---------------------- READ PATH FOR /discussions --------------------

export type DiscoursePostListFilters = {
  q?: string;
  categoryIds?: number[];
  tags?: string[];
  usernames?: string[];
  editedOnly?: boolean;
  /** Only topic-starter posts (Discourse post_number = 1) — i.e. threads
   *  staff actually opened, which is where product announcements, betas,
   *  and release posts live (vs. staff replies inside other threads). */
  firstPostOnly?: boolean;
  /** Include posts from automation accounts (see AUTOMATED_DISCOURSE_USERNAMES).
   *  Default false: the issue-tracker bot starts topics daily and floods
   *  the recency-sorted first page, and its content duplicates /issues.
   *  An explicit username filter overrides this (asking for the bot by
   *  name should show the bot). */
  includeAutomated?: boolean;
  sort?: "recent" | "newest" | "popular" | "edited";
  includeDeleted?: boolean;
  page?: number;
  perPage?: number;
};

/** Discourse accounts in the unity_staff group that are automation, not
 *  people. Their posts mirror content the site already surfaces
 *  first-class (the Issue Tracker bot duplicates /issues). */
export const AUTOMATED_DISCOURSE_USERNAMES = ["issue-tracker"];

export type DiscoursePostListItem = {
  id: number;
  discoursePostId: number;
  discourseTopicId: number;
  postNumber: number;
  topicSlug: string | null;
  topicTitle: string | null;
  username: string;
  userTitle: string | null;
  avatarTemplate: string | null;
  discourseCategoryId: number | null;
  categoryName: string | null;
  categorySlug: string | null;
  tags: string[];
  excerpt: string | null;
  discourseCreatedAt: string;
  discourseUpdatedAt: string;
  lastEditedAt: string | null;
  editReason: string | null;
  replyCount: number;
  incomingLinkCount: number;
  score: number | null;
  isDeleted: boolean;
  postUrl: string;
};

export type DiscoursePostListResult = {
  total: number;
  items: DiscoursePostListItem[];
};

const DEFAULT_PER_PAGE = 30;
const MAX_PER_PAGE = 100;
const DISCOURSE_BASE = "https://discussions.unity.com";

function clampPerPage(value?: number): number {
  if (!value || !Number.isFinite(value) || value <= 0) return DEFAULT_PER_PAGE;
  return Math.min(MAX_PER_PAGE, Math.floor(value));
}

function clampPage(value?: number): number {
  if (!value || !Number.isFinite(value) || value <= 0) return 1;
  return Math.floor(value);
}

function discoursePostUrl(topicSlug: string | null, topicId: number, postNumber: number): string {
  const slug = topicSlug?.replace(/[^a-z0-9-]/gi, "") || "topic";
  return `${DISCOURSE_BASE}/t/${slug}/${topicId}/${postNumber}`;
}

export async function listDiscoursePosts(
  filters: DiscoursePostListFilters
): Promise<DiscoursePostListResult> {
  const perPage = clampPerPage(filters.perPage);
  const page = clampPage(filters.page);
  const offset = (page - 1) * perPage;

  const wheres: string[] = ["dp.was_staff_at_post = true"];
  const values: unknown[] = [];
  if (!filters.includeDeleted) wheres.push("dp.is_deleted = false");
  if (filters.q && filters.q.trim().length > 0) {
    values.push(filters.q.trim());
    wheres.push(`dp.search_vector @@ websearch_to_tsquery('english', $${values.length})`);
  }
  if (filters.categoryIds && filters.categoryIds.length > 0) {
    values.push(filters.categoryIds);
    wheres.push(`dp.discourse_category_id = ANY($${values.length}::int[])`);
  }
  if (filters.tags && filters.tags.length > 0) {
    values.push(filters.tags);
    wheres.push(`dp.tags && $${values.length}::text[]`);
  }
  if (filters.usernames && filters.usernames.length > 0) {
    values.push(filters.usernames);
    wheres.push(`dp.username = ANY($${values.length}::text[])`);
  } else if (!filters.includeAutomated) {
    // Hide automation accounts unless the caller opted in or asked for
    // a specific author (the branch above) - the issue-tracker bot
    // otherwise owns the recency-sorted first page.
    values.push(AUTOMATED_DISCOURSE_USERNAMES);
    wheres.push(`dp.username <> ALL($${values.length}::text[])`);
  }
  if (filters.editedOnly) {
    wheres.push("dp.last_edited_at IS NOT NULL");
  }
  if (filters.firstPostOnly) {
    wheres.push("dp.post_number = 1");
  }
  const whereSql = wheres.length > 0 ? `WHERE ${wheres.join(" AND ")}` : "";

  let orderSql: string;
  switch (filters.sort) {
    case "newest":
      orderSql = "dp.discourse_created_at DESC NULLS LAST, dp.discourse_post_id DESC";
      break;
    case "popular":
      orderSql = "COALESCE(dp.reply_count, 0) DESC, dp.discourse_updated_at DESC";
      break;
    case "edited":
      orderSql = "dp.last_edited_at DESC NULLS LAST, dp.discourse_updated_at DESC";
      break;
    default:
      orderSql = "dp.discourse_updated_at DESC, dp.discourse_post_id DESC";
  }

  values.push(perPage, offset);
  const result = await query<{
    total_count: string;
    id: string;
    discourse_post_id: string;
    discourse_topic_id: string;
    post_number: number;
    topic_slug: string | null;
    topic_title: string | null;
    username: string;
    user_title: string | null;
    avatar_template: string | null;
    discourse_category_id: number | null;
    category_name: string | null;
    category_slug: string | null;
    tags: string[];
    excerpt: string | null;
    discourse_created_at: string;
    discourse_updated_at: string;
    last_edited_at: string | null;
    edit_reason: string | null;
    reply_count: number;
    incoming_link_count: number;
    score: string | null;
    is_deleted: boolean;
  }>(
    `
      SELECT
        COUNT(*) OVER() AS total_count,
        dp.id::text, dp.discourse_post_id::text, dp.discourse_topic_id::text,
        dp.post_number, dp.topic_slug, dp.topic_title,
        dp.username, su.user_title, su.avatar_template,
        dp.discourse_category_id, dc.name AS category_name, dc.slug AS category_slug,
        dp.tags, dp.excerpt,
        dp.discourse_created_at, dp.discourse_updated_at, dp.last_edited_at, dp.edit_reason,
        dp.reply_count, dp.incoming_link_count, dp.score::text, dp.is_deleted
      FROM discourse_posts dp
      LEFT JOIN discourse_staff_users su ON su.id = dp.staff_user_id
      LEFT JOIN discourse_categories dc ON dc.discourse_category_id = dp.discourse_category_id
      ${whereSql}
      ORDER BY ${orderSql}
      LIMIT $${values.length - 1} OFFSET $${values.length}
    `,
    values
  );

  const items: DiscoursePostListItem[] = result.rows.map((row) => ({
    id: Number(row.id),
    discoursePostId: Number(row.discourse_post_id),
    discourseTopicId: Number(row.discourse_topic_id),
    postNumber: row.post_number,
    topicSlug: row.topic_slug,
    topicTitle: row.topic_title,
    username: row.username,
    userTitle: row.user_title,
    avatarTemplate: row.avatar_template,
    discourseCategoryId: row.discourse_category_id,
    categoryName: row.category_name,
    categorySlug: row.category_slug,
    tags: row.tags ?? [],
    excerpt: row.excerpt,
    discourseCreatedAt: new Date(row.discourse_created_at).toISOString(),
    discourseUpdatedAt: new Date(row.discourse_updated_at).toISOString(),
    lastEditedAt: row.last_edited_at ? new Date(row.last_edited_at).toISOString() : null,
    editReason: row.edit_reason,
    replyCount: row.reply_count,
    incomingLinkCount: row.incoming_link_count,
    score: row.score == null ? null : Number(row.score),
    isDeleted: row.is_deleted,
    postUrl: discoursePostUrl(row.topic_slug, Number(row.discourse_topic_id), row.post_number)
  }));

  return {
    total: Number(result.rows[0]?.total_count ?? 0),
    items
  };
}

export type DiscourseFacets = {
  categories: Array<{ discourseCategoryId: number; slug: string; name: string; count: number }>;
  tags: Array<{ tag: string; count: number }>;
  authors: Array<{ username: string; userTitle: string | null; count: number }>;
};

/** Facet aggregates for the filter chips on /discussions. Capped so a
 *  long-tail author or rarely-used tag doesn't bloat the page. */
export async function listDiscourseFilterFacets(opts: {
  categoryLimit?: number;
  tagLimit?: number;
  authorLimit?: number;
} = {}): Promise<DiscourseFacets> {
  const categoryLimit = opts.categoryLimit ?? 25;
  const tagLimit = opts.tagLimit ?? 30;
  const authorLimit = opts.authorLimit ?? 40;

  const [categoriesResult, tagsResult, authorsResult] = await Promise.all([
    query<{ discourse_category_id: number; slug: string; name: string; count: string }>(
      `
        SELECT dp.discourse_category_id, dc.slug, dc.name, COUNT(*)::text AS count
        FROM discourse_posts dp
        JOIN discourse_categories dc ON dc.discourse_category_id = dp.discourse_category_id
        WHERE dp.was_staff_at_post = true AND dp.is_deleted = false
        GROUP BY dp.discourse_category_id, dc.slug, dc.name
        ORDER BY COUNT(*) DESC, dc.name ASC
        LIMIT $1
      `,
      [categoryLimit]
    ),
    query<{ tag: string; count: string }>(
      `
        SELECT tag, COUNT(*)::text AS count
        FROM (
          SELECT unnest(tags) AS tag
          FROM discourse_posts
          WHERE was_staff_at_post = true AND is_deleted = false
        ) t
        GROUP BY tag
        ORDER BY COUNT(*) DESC, tag ASC
        LIMIT $1
      `,
      [tagLimit]
    ),
    query<{ username: string; user_title: string | null; count: string }>(
      `
        SELECT dp.username, su.user_title, COUNT(*)::text AS count
        FROM discourse_posts dp
        LEFT JOIN discourse_staff_users su ON su.discourse_user_id = dp.discourse_user_id
        WHERE dp.was_staff_at_post = true AND dp.is_deleted = false
        GROUP BY dp.username, su.user_title
        ORDER BY COUNT(*) DESC, dp.username ASC
        LIMIT $1
      `,
      [authorLimit]
    )
  ]);

  return {
    categories: categoriesResult.rows.map((r) => ({
      discourseCategoryId: r.discourse_category_id,
      slug: r.slug,
      name: r.name,
      count: Number(r.count)
    })),
    tags: tagsResult.rows.map((r) => ({ tag: r.tag, count: Number(r.count) })),
    authors: authorsResult.rows.map((r) => ({
      username: r.username,
      userTitle: r.user_title,
      count: Number(r.count)
    }))
  };
}

export type DiscoursePostStats = {
  totalPosts: number;
  editedPosts: number;
  deletedPosts: number;
  trackedStaff: number;
  activeStaff: number;
  trackedCategories: number;
  latestPostAt: string | null;
};

export async function getDiscoursePostStats(): Promise<DiscoursePostStats> {
  const result = await query<{
    total_posts: string;
    edited_posts: string;
    deleted_posts: string;
    tracked_staff: string;
    active_staff: string;
    tracked_categories: string;
    latest_post_at: string | null;
  }>(`
    SELECT
      (SELECT COUNT(*) FROM discourse_posts WHERE was_staff_at_post = true)                                AS total_posts,
      (SELECT COUNT(*) FROM discourse_posts WHERE was_staff_at_post = true AND last_edited_at IS NOT NULL) AS edited_posts,
      (SELECT COUNT(*) FROM discourse_posts WHERE was_staff_at_post = true AND is_deleted = true)          AS deleted_posts,
      (SELECT COUNT(*) FROM discourse_staff_users)                                                          AS tracked_staff,
      (SELECT COUNT(*) FROM discourse_staff_users WHERE active_in_group = true)                             AS active_staff,
      (SELECT COUNT(*) FROM discourse_categories)                                                           AS tracked_categories,
      (SELECT MAX(discourse_created_at) FROM discourse_posts WHERE was_staff_at_post = true)                AS latest_post_at
  `);
  const row = result.rows[0];
  return {
    totalPosts: Number(row?.total_posts ?? 0),
    editedPosts: Number(row?.edited_posts ?? 0),
    deletedPosts: Number(row?.deleted_posts ?? 0),
    trackedStaff: Number(row?.tracked_staff ?? 0),
    activeStaff: Number(row?.active_staff ?? 0),
    trackedCategories: Number(row?.tracked_categories ?? 0),
    latestPostAt: row?.latest_post_at ? new Date(row.latest_post_at).toISOString() : null
  };
}

// ─────────────────────────────────────────────────────────────────────
// Unity GitHub repository functions (github.com/Unity-Technologies)
// ─────────────────────────────────────────────────────────────────────

export async function upsertGithubRepo(
  client: PoolClient,
  repo: GithubRepoInput,
  runId: number,
  snapshotId: number | null
): Promise<"inserted" | "updated"> {
  const result = await client.query<{ inserted: boolean }>(
    `
      INSERT INTO github_repos (
        github_repo_id, name, full_name, owner, description, html_url, homepage,
        stargazers_count, forks_count, open_issues_count, watchers_count,
        language, topics, license_spdx, is_archived, is_fork, is_template,
        default_branch, size_kb, is_notable,
        repo_created_at, repo_updated_at, repo_pushed_at,
        last_synced_at, source_snapshot_id, ingestion_run_id, updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::text[],$14,$15,$16,$17,$18,$19,$20,
        $21,$22,$23, now(), $24, $25, now()
      )
      ON CONFLICT (github_repo_id) DO UPDATE SET
        name = EXCLUDED.name,
        full_name = EXCLUDED.full_name,
        description = EXCLUDED.description,
        html_url = EXCLUDED.html_url,
        homepage = EXCLUDED.homepage,
        stargazers_count = EXCLUDED.stargazers_count,
        forks_count = EXCLUDED.forks_count,
        open_issues_count = EXCLUDED.open_issues_count,
        watchers_count = EXCLUDED.watchers_count,
        language = EXCLUDED.language,
        topics = EXCLUDED.topics,
        license_spdx = EXCLUDED.license_spdx,
        is_archived = EXCLUDED.is_archived,
        is_fork = EXCLUDED.is_fork,
        is_template = EXCLUDED.is_template,
        default_branch = EXCLUDED.default_branch,
        size_kb = EXCLUDED.size_kb,
        is_notable = EXCLUDED.is_notable,
        repo_created_at = EXCLUDED.repo_created_at,
        repo_updated_at = EXCLUDED.repo_updated_at,
        repo_pushed_at = EXCLUDED.repo_pushed_at,
        last_synced_at = now(),
        source_snapshot_id = EXCLUDED.source_snapshot_id,
        ingestion_run_id = EXCLUDED.ingestion_run_id,
        updated_at = now()
      RETURNING (xmax = 0) AS inserted
    `,
    [
      repo.githubRepoId, repo.name, repo.fullName, repo.owner, repo.description, repo.htmlUrl, repo.homepage,
      repo.stargazersCount, repo.forksCount, repo.openIssuesCount, repo.watchersCount,
      repo.language, repo.topics, repo.licenseSpdx, repo.isArchived, repo.isFork, repo.isTemplate,
      repo.defaultBranch, repo.sizeKb, repo.isNotable,
      repo.repoCreatedAt, repo.repoUpdatedAt, repo.repoPushedAt,
      snapshotId, runId
    ]
  );
  return result.rows[0]?.inserted ? "inserted" : "updated";
}

export async function upsertGithubEvent(
  client: PoolClient,
  event: GithubEventInput,
  runId: number
): Promise<boolean> {
  const result = await client.query<{ inserted: boolean }>(
    `
      INSERT INTO github_events (
        github_event_id, event_type, repo_full_name, repo_github_id,
        actor_login, actor_avatar_url, summary, ref, html_url,
        head_commit_message, event_created_at, ingestion_run_id
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      -- Backfill the commit message / release tag onto rows ingested before
      -- those columns existed, without disturbing anything else. The org
      -- events feed re-serves the same recent events, so this fills them in
      -- on the next run rather than only catching brand-new events.
      ON CONFLICT (github_event_id) DO UPDATE SET
        head_commit_message = COALESCE(EXCLUDED.head_commit_message, github_events.head_commit_message),
        ref = COALESCE(EXCLUDED.ref, github_events.ref)
      RETURNING (xmax = 0) AS inserted
    `,
    [
      event.githubEventId, event.eventType, event.repoFullName, event.repoGithubId,
      event.actorLogin, event.actorAvatarUrl, event.summary, event.ref, event.htmlUrl,
      event.headCommitMessage, event.eventCreatedAt, runId
    ]
  );
  return result.rows[0]?.inserted === true;
}

export type RepoLatestActivity = {
  commitMessage: string | null;
  commitAt: string | null;
  releaseTag: string | null;
  releaseUrl: string | null;
};

/** Latest commit message (from PushEvents) and latest release tag (from
 *  ReleaseEvents) for a set of repos, derived from the activity we already
 *  ingest — no extra GitHub calls. Keyed by repo full_name. */
export async function getReposLatestActivity(
  fullNames: string[]
): Promise<Map<string, RepoLatestActivity>> {
  const map = new Map<string, RepoLatestActivity>();
  if (fullNames.length === 0) return map;
  const [pushes, releases] = await Promise.all([
    query<{ repo_full_name: string; head_commit_message: string | null; event_created_at: string }>(
      `
        SELECT DISTINCT ON (repo_full_name) repo_full_name, head_commit_message, event_created_at
        FROM github_events
        WHERE event_type = 'PushEvent' AND head_commit_message IS NOT NULL
          AND repo_full_name = ANY($1::text[])
        ORDER BY repo_full_name, event_created_at DESC
      `,
      [fullNames]
    ),
    query<{ repo_full_name: string; ref: string | null; html_url: string | null }>(
      `
        SELECT DISTINCT ON (repo_full_name) repo_full_name, ref, html_url
        FROM github_events
        WHERE event_type = 'ReleaseEvent' AND repo_full_name = ANY($1::text[])
        ORDER BY repo_full_name, event_created_at DESC
      `,
      [fullNames]
    )
  ]);
  for (const r of pushes.rows) {
    map.set(r.repo_full_name, {
      commitMessage: r.head_commit_message,
      commitAt: r.event_created_at ? new Date(r.event_created_at).toISOString() : null,
      releaseTag: null,
      releaseUrl: null
    });
  }
  for (const r of releases.rows) {
    const existing = map.get(r.repo_full_name) ?? {
      commitMessage: null,
      commitAt: null,
      releaseTag: null,
      releaseUrl: null
    };
    existing.releaseTag = r.ref;
    existing.releaseUrl = r.html_url;
    map.set(r.repo_full_name, existing);
  }
  return map;
}

export type GithubRepoListFilters = {
  q?: string;
  language?: string;
  topic?: string;
  includeArchived?: boolean;
  includeForks?: boolean;
  notableOnly?: boolean;
  sort?: "stars" | "newest" | "updated" | "forks";
  direction?: "asc" | "desc";
  page?: number;
  perPage?: number;
};

export type GithubRepoListItem = {
  id: number;
  githubRepoId: number;
  name: string;
  fullName: string;
  description: string | null;
  htmlUrl: string;
  homepage: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  language: string | null;
  topics: string[];
  licenseSpdx: string | null;
  isArchived: boolean;
  isFork: boolean;
  isNotable: boolean;
  repoCreatedAt: string | null;
  repoPushedAt: string | null;
  latestCommitMessage: string | null;
  latestCommitUrl: string | null;
};

export type GithubRepoListResult = { total: number; items: GithubRepoListItem[] };

const GITHUB_DEFAULT_PER_PAGE = 30;
const GITHUB_MAX_PER_PAGE = 100;

export async function listGithubRepos(filters: GithubRepoListFilters): Promise<GithubRepoListResult> {
  const perPage = Math.min(GITHUB_MAX_PER_PAGE, Math.max(1, Math.floor(filters.perPage || GITHUB_DEFAULT_PER_PAGE)));
  const page = Math.max(1, Math.floor(filters.page || 1));
  const offset = (page - 1) * perPage;

  const wheres: string[] = [];
  const values: unknown[] = [];
  if (!filters.includeArchived) wheres.push("gr.is_archived = false");
  if (!filters.includeForks) wheres.push("gr.is_fork = false");
  if (filters.notableOnly) wheres.push("gr.is_notable = true");
  if (filters.q && filters.q.trim()) {
    const term = filters.q.trim();
    values.push(term);
    const tsIdx = values.length;
    values.push(`%${term}%`);
    const likeIdx = values.length;
    // FTS matches whole words in name/topics/description; the ILIKE on
    // full_name also catches partial/substring repo names ("MemorySnapshot"
    // -> "MemorySnapshotDataTools"), which FTS lexemes can't.
    wheres.push(
      `(gr.search_vector @@ websearch_to_tsquery('english', $${tsIdx}) OR gr.full_name ILIKE $${likeIdx})`
    );
  }
  if (filters.language) {
    values.push(filters.language);
    wheres.push(`gr.language = $${values.length}`);
  }
  if (filters.topic) {
    values.push(filters.topic);
    wheres.push(`$${values.length} = ANY(gr.topics)`);
  }
  const whereSql = wheres.length ? `WHERE ${wheres.join(" AND ")}` : "";

  // Direction applies to the primary sort key; the secondary key stays a
  // stable DESC tiebreaker. `dir`/`nulls` are derived constants (never raw
  // input), so they're safe to interpolate.
  const dir = filters.direction === "asc" ? "ASC" : "DESC";
  const nulls = filters.direction === "asc" ? "NULLS FIRST" : "NULLS LAST";
  let orderSql: string;
  switch (filters.sort) {
    case "newest":
      orderSql = `gr.repo_created_at ${dir} ${nulls}, gr.stargazers_count DESC`;
      break;
    case "updated":
      orderSql = `gr.repo_pushed_at ${dir} ${nulls}, gr.stargazers_count DESC`;
      break;
    case "forks":
      orderSql = `gr.forks_count ${dir}, gr.stargazers_count DESC`;
      break;
    default:
      orderSql = `gr.stargazers_count ${dir}, gr.repo_pushed_at DESC NULLS LAST`;
  }

  values.push(perPage, offset);
  const result = await query<{
    total_count: string;
    id: string;
    github_repo_id: string;
    name: string;
    full_name: string;
    description: string | null;
    html_url: string;
    homepage: string | null;
    stargazers_count: number;
    forks_count: number;
    open_issues_count: number;
    language: string | null;
    topics: string[];
    license_spdx: string | null;
    is_archived: boolean;
    is_fork: boolean;
    is_notable: boolean;
    repo_created_at: string | null;
    repo_pushed_at: string | null;
    latest_commit_message: string | null;
    latest_commit_url: string | null;
  }>(
    `
      SELECT
        COUNT(*) OVER() AS total_count,
        gr.id::text, gr.github_repo_id::text, gr.name, gr.full_name, gr.description,
        gr.html_url, gr.homepage, gr.stargazers_count, gr.forks_count, gr.open_issues_count,
        gr.language, gr.topics, gr.license_spdx, gr.is_archived, gr.is_fork, gr.is_notable,
        gr.repo_created_at, gr.repo_pushed_at,
        gr.latest_commit_message, gr.latest_commit_url
      FROM github_repos gr
      ${whereSql}
      ORDER BY ${orderSql}
      LIMIT $${values.length - 1} OFFSET $${values.length}
    `,
    values
  );

  const items: GithubRepoListItem[] = result.rows.map((r) => ({
    id: Number(r.id),
    githubRepoId: Number(r.github_repo_id),
    name: r.name,
    fullName: r.full_name,
    description: r.description,
    htmlUrl: r.html_url,
    homepage: r.homepage,
    stars: r.stargazers_count,
    forks: r.forks_count,
    openIssues: r.open_issues_count,
    language: r.language,
    topics: r.topics ?? [],
    licenseSpdx: r.license_spdx,
    isArchived: r.is_archived,
    isFork: r.is_fork,
    isNotable: r.is_notable,
    repoCreatedAt: r.repo_created_at ? new Date(r.repo_created_at).toISOString() : null,
    repoPushedAt: r.repo_pushed_at ? new Date(r.repo_pushed_at).toISOString() : null,
    latestCommitMessage: r.latest_commit_message,
    latestCommitUrl: r.latest_commit_url
  }));

  return { total: Number(result.rows[0]?.total_count ?? 0), items };
}

/** Store the latest commit (message + url + date) on a repo row. */
export async function updateRepoLatestCommit(
  client: PoolClient,
  githubRepoId: number,
  commit: { message: string; committedAt: string | null; url: string }
): Promise<void> {
  await client.query(
    `
      UPDATE github_repos
      SET latest_commit_message = $2,
          latest_commit_at = $3,
          latest_commit_url = $4
      WHERE github_repo_id = $1
    `,
    [githubRepoId, commit.message, commit.committedAt, commit.url]
  );
}

export type GithubRepoFacets = {
  languages: Array<{ language: string; count: number }>;
  topics: Array<{ topic: string; count: number }>;
};

export async function listGithubRepoFacets(opts: { languageLimit?: number; topicLimit?: number } = {}): Promise<GithubRepoFacets> {
  const [languages, topics] = await Promise.all([
    query<{ language: string; count: string }>(
      `
        SELECT language, COUNT(*)::text AS count
        FROM github_repos
        WHERE is_archived = false AND is_fork = false AND language IS NOT NULL
        GROUP BY language
        ORDER BY COUNT(*) DESC, language ASC
        LIMIT $1
      `,
      [opts.languageLimit ?? 25]
    ),
    query<{ topic: string; count: string }>(
      `
        SELECT topic, COUNT(*)::text AS count
        FROM (
          SELECT unnest(topics) AS topic FROM github_repos
          WHERE is_archived = false AND is_fork = false
        ) t
        GROUP BY topic
        ORDER BY COUNT(*) DESC, topic ASC
        LIMIT $1
      `,
      [opts.topicLimit ?? 30]
    )
  ]);
  return {
    languages: languages.rows.map((r) => ({ language: r.language, count: Number(r.count) })),
    topics: topics.rows.map((r) => ({ topic: r.topic, count: Number(r.count) }))
  };
}

export type GithubEventItem = {
  id: number;
  eventType: string;
  repoFullName: string;
  repoName: string;
  actorLogin: string | null;
  actorAvatarUrl: string | null;
  summary: string;
  htmlUrl: string | null;
  eventCreatedAt: string;
};

export async function listGithubEvents(limit = 40): Promise<GithubEventItem[]> {
  const capped = Math.min(100, Math.max(1, Math.floor(limit)));
  const result = await query<{
    id: string;
    event_type: string;
    repo_full_name: string;
    actor_login: string | null;
    actor_avatar_url: string | null;
    summary: string;
    html_url: string | null;
    event_created_at: string;
  }>(
    `
      SELECT id::text, event_type, repo_full_name, actor_login, actor_avatar_url,
             summary, html_url, event_created_at
      FROM github_events
      -- Drop dependency-bot noise (renovate[bot], dependabot[bot], …) which
      -- otherwise floods the feed; keep releases regardless of actor since
      -- those are often published by CI bots.
      WHERE event_type = 'ReleaseEvent'
         OR actor_login IS NULL
         OR actor_login NOT ILIKE '%[bot]%'
      ORDER BY event_created_at DESC, id DESC
      LIMIT $1
    `,
    [capped]
  );
  return result.rows.map((r) => ({
    id: Number(r.id),
    eventType: r.event_type,
    repoFullName: r.repo_full_name,
    repoName: r.repo_full_name.includes("/") ? r.repo_full_name.split("/").slice(1).join("/") : r.repo_full_name,
    actorLogin: r.actor_login,
    actorAvatarUrl: r.actor_avatar_url,
    summary: r.summary,
    htmlUrl: r.html_url,
    eventCreatedAt: new Date(r.event_created_at).toISOString()
  }));
}

export type GithubStats = {
  totalRepos: number;
  activeRepos: number;
  totalStars: number;
  notableRepos: number;
  languages: number;
  latestPushAt: string | null;
  latestEventAt: string | null;
};

export async function getGithubStats(): Promise<GithubStats> {
  const result = await query<{
    total_repos: string;
    active_repos: string;
    total_stars: string;
    notable_repos: string;
    languages: string;
    latest_push: string | null;
    latest_event: string | null;
  }>(`
    SELECT
      (SELECT COUNT(*) FROM github_repos)                                                   AS total_repos,
      (SELECT COUNT(*) FROM github_repos WHERE is_archived = false AND is_fork = false)     AS active_repos,
      (SELECT COALESCE(SUM(stargazers_count), 0) FROM github_repos WHERE is_fork = false)   AS total_stars,
      (SELECT COUNT(*) FROM github_repos WHERE is_notable = true)                           AS notable_repos,
      (SELECT COUNT(DISTINCT language) FROM github_repos WHERE language IS NOT NULL)         AS languages,
      (SELECT MAX(repo_pushed_at) FROM github_repos)                                        AS latest_push,
      (SELECT MAX(event_created_at) FROM github_events)                                     AS latest_event
  `);
  const row = result.rows[0];
  return {
    totalRepos: Number(row?.total_repos ?? 0),
    activeRepos: Number(row?.active_repos ?? 0),
    totalStars: Number(row?.total_stars ?? 0),
    notableRepos: Number(row?.notable_repos ?? 0),
    languages: Number(row?.languages ?? 0),
    latestPushAt: row?.latest_push ? new Date(row.latest_push).toISOString() : null,
    latestEventAt: row?.latest_event ? new Date(row.latest_event).toISOString() : null
  };
}
