import { query } from "./db/client";
import { DOMAINS, type Domain } from "./visualizer-domains";

/**
 * Data layer for `/issues` (Issue Explorer). Issue-centric aggregates
 * over the `issue_mentions` table joined with `unity_releases`. Reuses
 * the curated domain regex set so the heatmap rows match every other
 * domain-axis chart on the site.
 *
 * Backed by the `idx_issue_mentions_section_issue` composite index
 * added in the Phase 1 perf pass; without it these queries seq-scan
 * the 76k-row mention table on every render.
 */

export type IssueStats = {
  /** Distinct issue ids ever mentioned in any indexed release note. */
  total: number;
  /** Issues whose latest mention is in section='Known Issues' AND have
   *  no later mention in section='Fixes'. */
  currentlyOpen: number;
  /** Issues whose earliest section='Fixes' mention is in a release
   *  whose release_date is within the last 30 days. */
  fixedRecently: number;
  /** Issues that had a Fix mention earlier than a later Known Issues
   *  mention — Unity shipped a fix then re-listed it as known. */
  regressed: number;
};

export async function getIssueStats(): Promise<IssueStats> {
  const result = await query<{
    total: string;
    open: string;
    fixed_recent: string;
    regressed: string;
  }>(
    `
      WITH first_known AS (
        SELECT DISTINCT ON (im.issue_id) im.issue_id, ur.release_date
        FROM issue_mentions im
        JOIN unity_releases ur ON ur.id = im.unity_release_id
        WHERE im.section = 'Known Issues'
        ORDER BY im.issue_id, ur.release_date ASC NULLS LAST
      ),
      latest_known AS (
        SELECT DISTINCT ON (im.issue_id) im.issue_id, ur.release_date
        FROM issue_mentions im
        JOIN unity_releases ur ON ur.id = im.unity_release_id
        WHERE im.section = 'Known Issues'
        ORDER BY im.issue_id, ur.release_date DESC NULLS LAST
      ),
      first_fix AS (
        SELECT DISTINCT ON (im.issue_id) im.issue_id, ur.release_date
        FROM issue_mentions im
        JOIN unity_releases ur ON ur.id = im.unity_release_id
        WHERE im.section = 'Fixes'
        ORDER BY im.issue_id, ur.release_date ASC NULLS LAST
      ),
      latest_fix AS (
        SELECT DISTINCT ON (im.issue_id) im.issue_id, ur.release_date
        FROM issue_mentions im
        JOIN unity_releases ur ON ur.id = im.unity_release_id
        WHERE im.section = 'Fixes'
        ORDER BY im.issue_id, ur.release_date DESC NULLS LAST
      )
      SELECT
        (SELECT COUNT(DISTINCT issue_id) FROM issue_mentions)::text AS total,
        (SELECT COUNT(*) FROM latest_known lk
           LEFT JOIN latest_fix lf ON lf.issue_id = lk.issue_id
           WHERE lf.issue_id IS NULL
              OR lk.release_date > lf.release_date)::text AS open,
        (SELECT COUNT(*) FROM first_fix
           WHERE release_date > now() - interval '30 days')::text AS fixed_recent,
        (SELECT COUNT(*) FROM latest_known lk
           JOIN first_fix ff ON ff.issue_id = lk.issue_id
           WHERE lk.release_date > ff.release_date)::text AS regressed
    `
  );
  const row = result.rows[0];
  return {
    total: Number(row?.total ?? 0),
    currentlyOpen: Number(row?.open ?? 0),
    fixedRecently: Number(row?.fixed_recent ?? 0),
    regressed: Number(row?.regressed ?? 0)
  };
}

export type IssueRow = {
  issueId: string;
  status: "open" | "fixed" | "regressed";
  area: string | null;
  introducedVersion: string | null;
  introducedDate: string | null;
  fixedVersion: string | null;
  fixedDate: string | null;
  daysOpen: number | null;
  mentionCount: number;
  /** Body of the first Known-Issues mention — what Unity wrote when
   *  they first called this out. May be a long-form paragraph; the
   *  table view clamps it to 2 lines and the full text is available
   *  on the per-issue detail page. */
  description: string | null;
};

/** The N longest-open issues (open = no Fix mention, or Known Issues
 *  appears after every fix). Sorted by days-open desc. */
export async function getLongestOpenIssues(limit = 10): Promise<IssueRow[]> {
  const result = await query<{
    issue_id: string;
    area: string | null;
    introduced_version: string | null;
    introduced_date: string | null;
    days_open: string | null;
    mention_count: string;
    fixed_version: string | null;
    fixed_date: string | null;
    status: string;
    description: string | null;
  }>(
    `
      WITH first_known AS (
        SELECT DISTINCT ON (im.issue_id) im.issue_id, ur.version, ur.release_date, im.area,
                                          rn.body
        FROM issue_mentions im
        JOIN unity_releases ur ON ur.id = im.unity_release_id
        JOIN release_note_items rn ON rn.id = im.release_note_item_id
        WHERE im.section = 'Known Issues'
        ORDER BY im.issue_id, ur.release_date ASC NULLS LAST
      ),
      latest_known AS (
        SELECT DISTINCT ON (im.issue_id) im.issue_id, ur.release_date
        FROM issue_mentions im
        JOIN unity_releases ur ON ur.id = im.unity_release_id
        WHERE im.section = 'Known Issues'
        ORDER BY im.issue_id, ur.release_date DESC NULLS LAST
      ),
      first_fix AS (
        SELECT DISTINCT ON (im.issue_id) im.issue_id, ur.version, ur.release_date
        FROM issue_mentions im
        JOIN unity_releases ur ON ur.id = im.unity_release_id
        WHERE im.section = 'Fixes'
        ORDER BY im.issue_id, ur.release_date ASC NULLS LAST
      ),
      latest_fix AS (
        SELECT DISTINCT ON (im.issue_id) im.issue_id, ur.release_date
        FROM issue_mentions im
        JOIN unity_releases ur ON ur.id = im.unity_release_id
        WHERE im.section = 'Fixes'
        ORDER BY im.issue_id, ur.release_date DESC NULLS LAST
      ),
      mention_counts AS (
        SELECT issue_id, COUNT(DISTINCT unity_release_id) AS n
        FROM issue_mentions
        GROUP BY issue_id
      )
      SELECT
        fk.issue_id,
        fk.area,
        fk.body              AS description,
        fk.version          AS introduced_version,
        fk.release_date::text AS introduced_date,
        (EXTRACT(EPOCH FROM (now() - fk.release_date)) / 86400)::text AS days_open,
        COALESCE(mc.n, 0)::text AS mention_count,
        ff.version          AS fixed_version,
        ff.release_date::text AS fixed_date,
        CASE
          WHEN ff.issue_id IS NULL THEN 'open'
          WHEN lk.release_date IS NOT NULL AND lf.release_date IS NOT NULL
               AND lk.release_date > lf.release_date THEN 'regressed'
          WHEN lk.release_date IS NOT NULL AND lf.release_date IS NULL THEN 'open'
          ELSE 'open'
        END AS status
      FROM first_known fk
      LEFT JOIN first_fix     ff ON ff.issue_id = fk.issue_id
      LEFT JOIN latest_known  lk ON lk.issue_id = fk.issue_id
      LEFT JOIN latest_fix    lf ON lf.issue_id = fk.issue_id
      LEFT JOIN mention_counts mc ON mc.issue_id = fk.issue_id
      WHERE fk.release_date IS NOT NULL
        AND (ff.issue_id IS NULL OR (lk.release_date IS NOT NULL AND lk.release_date > lf.release_date))
      ORDER BY fk.release_date ASC
      LIMIT $1
    `,
    [limit]
  );
  return result.rows.map((row) => ({
    issueId: row.issue_id,
    status: (row.status as IssueRow["status"]) ?? "open",
    area: row.area,
    introducedVersion: row.introduced_version,
    introducedDate: row.introduced_date,
    fixedVersion: row.fixed_version,
    fixedDate: row.fixed_date,
    daysOpen: row.days_open != null ? Number(row.days_open) : null,
    mentionCount: Number(row.mention_count),
    description: row.description
  }));
}

/** The N most recently introduced issues — issues whose first
 *  Known-Issues mention sits in the latest releases. Answers "what
 *  new problems has Unity flagged lately?" regardless of whether
 *  there's already a Fix shipped. Status column on the table tells
 *  the user whether each issue is still open. */
export async function getNewestIssues(limit = 10): Promise<IssueRow[]> {
  const result = await query<{
    issue_id: string;
    area: string | null;
    introduced_version: string | null;
    introduced_date: string | null;
    days_open: string | null;
    mention_count: string;
    fixed_version: string | null;
    fixed_date: string | null;
    status: string;
    description: string | null;
  }>(
    `
      WITH first_known AS (
        SELECT DISTINCT ON (im.issue_id) im.issue_id, ur.version, ur.release_date, im.area,
                                          rn.body
        FROM issue_mentions im
        JOIN unity_releases ur ON ur.id = im.unity_release_id
        JOIN release_note_items rn ON rn.id = im.release_note_item_id
        WHERE im.section = 'Known Issues'
        ORDER BY im.issue_id, ur.release_date ASC NULLS LAST
      ),
      latest_known AS (
        SELECT DISTINCT ON (im.issue_id) im.issue_id, ur.release_date
        FROM issue_mentions im
        JOIN unity_releases ur ON ur.id = im.unity_release_id
        WHERE im.section = 'Known Issues'
        ORDER BY im.issue_id, ur.release_date DESC NULLS LAST
      ),
      first_fix AS (
        SELECT DISTINCT ON (im.issue_id) im.issue_id, ur.version, ur.release_date
        FROM issue_mentions im
        JOIN unity_releases ur ON ur.id = im.unity_release_id
        WHERE im.section = 'Fixes'
        ORDER BY im.issue_id, ur.release_date ASC NULLS LAST
      ),
      latest_fix AS (
        SELECT DISTINCT ON (im.issue_id) im.issue_id, ur.release_date
        FROM issue_mentions im
        JOIN unity_releases ur ON ur.id = im.unity_release_id
        WHERE im.section = 'Fixes'
        ORDER BY im.issue_id, ur.release_date DESC NULLS LAST
      ),
      mention_counts AS (
        SELECT issue_id, COUNT(DISTINCT unity_release_id) AS n
        FROM issue_mentions
        GROUP BY issue_id
      )
      SELECT
        fk.issue_id,
        fk.area,
        fk.body              AS description,
        fk.version          AS introduced_version,
        fk.release_date::text AS introduced_date,
        CASE
          WHEN ff.release_date IS NOT NULL
            THEN (EXTRACT(EPOCH FROM (ff.release_date - fk.release_date)) / 86400)::text
          ELSE (EXTRACT(EPOCH FROM (now() - fk.release_date)) / 86400)::text
        END AS days_open,
        COALESCE(mc.n, 0)::text AS mention_count,
        ff.version          AS fixed_version,
        ff.release_date::text AS fixed_date,
        CASE
          WHEN ff.issue_id IS NULL THEN 'open'
          WHEN lk.release_date IS NOT NULL AND lf.release_date IS NOT NULL
               AND lk.release_date > lf.release_date THEN 'regressed'
          WHEN ff.issue_id IS NOT NULL THEN 'fixed'
          ELSE 'open'
        END AS status
      FROM first_known fk
      LEFT JOIN first_fix     ff ON ff.issue_id = fk.issue_id
      LEFT JOIN latest_known  lk ON lk.issue_id = fk.issue_id
      LEFT JOIN latest_fix    lf ON lf.issue_id = fk.issue_id
      LEFT JOIN mention_counts mc ON mc.issue_id = fk.issue_id
      WHERE fk.release_date IS NOT NULL
      ORDER BY fk.release_date DESC, fk.issue_id ASC
      LIMIT $1
    `,
    [limit]
  );
  return result.rows.map((row) => ({
    issueId: row.issue_id,
    status: (row.status as IssueRow["status"]) ?? "open",
    area: row.area,
    introducedVersion: row.introduced_version,
    introducedDate: row.introduced_date,
    fixedVersion: row.fixed_version,
    fixedDate: row.fixed_date,
    daysOpen: row.days_open != null ? Number(row.days_open) : null,
    mentionCount: Number(row.mention_count),
    description: row.description
  }));
}

/** The N issues mentioned in the most distinct release versions —
 *  surfaces "Unity keeps re-listing this" cases plus the most
 *  frequently fixed-and-reintroduced regressions. */
export async function getMostMentionedIssues(limit = 10): Promise<IssueRow[]> {
  const result = await query<{
    issue_id: string;
    area: string | null;
    mention_count: string;
    introduced_version: string | null;
    introduced_date: string | null;
    fixed_version: string | null;
    fixed_date: string | null;
    days_open: string | null;
    status: string;
    description: string | null;
  }>(
    `
      WITH mention_counts AS (
        SELECT issue_id, COUNT(DISTINCT unity_release_id) AS n
        FROM issue_mentions
        GROUP BY issue_id
        ORDER BY n DESC
        LIMIT $1
      ),
      first_known AS (
        SELECT DISTINCT ON (im.issue_id) im.issue_id, ur.version, ur.release_date, im.area, rn.body
        FROM issue_mentions im
        JOIN unity_releases ur ON ur.id = im.unity_release_id
        JOIN release_note_items rn ON rn.id = im.release_note_item_id
        WHERE im.section = 'Known Issues' AND im.issue_id IN (SELECT issue_id FROM mention_counts)
        ORDER BY im.issue_id, ur.release_date ASC NULLS LAST
      ),
      latest_known AS (
        SELECT DISTINCT ON (im.issue_id) im.issue_id, ur.release_date
        FROM issue_mentions im
        JOIN unity_releases ur ON ur.id = im.unity_release_id
        WHERE im.section = 'Known Issues' AND im.issue_id IN (SELECT issue_id FROM mention_counts)
        ORDER BY im.issue_id, ur.release_date DESC NULLS LAST
      ),
      first_fix AS (
        SELECT DISTINCT ON (im.issue_id) im.issue_id, ur.version, ur.release_date
        FROM issue_mentions im
        JOIN unity_releases ur ON ur.id = im.unity_release_id
        WHERE im.section = 'Fixes' AND im.issue_id IN (SELECT issue_id FROM mention_counts)
        ORDER BY im.issue_id, ur.release_date ASC NULLS LAST
      ),
      latest_fix AS (
        SELECT DISTINCT ON (im.issue_id) im.issue_id, ur.release_date
        FROM issue_mentions im
        JOIN unity_releases ur ON ur.id = im.unity_release_id
        WHERE im.section = 'Fixes' AND im.issue_id IN (SELECT issue_id FROM mention_counts)
        ORDER BY im.issue_id, ur.release_date DESC NULLS LAST
      ),
      any_area AS (
        SELECT DISTINCT ON (issue_id) issue_id, area
        FROM issue_mentions
        WHERE area IS NOT NULL AND issue_id IN (SELECT issue_id FROM mention_counts)
        ORDER BY issue_id
      ),
      any_body AS (
        -- Fallback body for issues with no Known-Issues mention (e.g.
        -- pure-fix UUM ids that show up in the most-mentioned list).
        -- Picks the earliest-dated mention regardless of section.
        SELECT DISTINCT ON (im.issue_id) im.issue_id, rn.body
        FROM issue_mentions im
        JOIN release_note_items rn ON rn.id = im.release_note_item_id
        JOIN unity_releases ur ON ur.id = im.unity_release_id
        WHERE im.issue_id IN (SELECT issue_id FROM mention_counts)
        ORDER BY im.issue_id, ur.release_date ASC NULLS LAST
      )
      SELECT
        mc.issue_id,
        COALESCE(fk.area, aa.area) AS area,
        COALESCE(fk.body, ab.body) AS description,
        mc.n::text AS mention_count,
        fk.version              AS introduced_version,
        fk.release_date::text   AS introduced_date,
        ff.version              AS fixed_version,
        ff.release_date::text   AS fixed_date,
        CASE
          WHEN fk.release_date IS NOT NULL
            THEN (EXTRACT(EPOCH FROM (COALESCE(ff.release_date, now()) - fk.release_date)) / 86400)::text
          ELSE NULL
        END AS days_open,
        CASE
          WHEN ff.issue_id IS NULL THEN 'open'
          WHEN lk.release_date IS NOT NULL AND lf.release_date IS NOT NULL
               AND lk.release_date > lf.release_date THEN 'regressed'
          WHEN ff.issue_id IS NOT NULL THEN 'fixed'
          ELSE 'open'
        END AS status
      FROM mention_counts mc
      LEFT JOIN first_known fk  ON fk.issue_id = mc.issue_id
      LEFT JOIN any_area aa     ON aa.issue_id = mc.issue_id
      LEFT JOIN any_body ab     ON ab.issue_id = mc.issue_id
      LEFT JOIN first_fix ff    ON ff.issue_id = mc.issue_id
      LEFT JOIN latest_known lk ON lk.issue_id = mc.issue_id
      LEFT JOIN latest_fix lf   ON lf.issue_id = mc.issue_id
      ORDER BY mc.n DESC, mc.issue_id ASC
    `,
    [limit]
  );
  return result.rows.map((row) => ({
    issueId: row.issue_id,
    status: (row.status as IssueRow["status"]) ?? "open",
    area: row.area,
    introducedVersion: row.introduced_version,
    introducedDate: row.introduced_date,
    fixedVersion: row.fixed_version,
    fixedDate: row.fixed_date,
    daysOpen: row.days_open != null ? Number(row.days_open) : null,
    mentionCount: Number(row.mention_count),
    description: row.description
  }));
}

export const ISSUE_SEARCH_STATUSES = ["all", "open", "fixed", "regressed"] as const;
export type IssueSearchStatus = (typeof ISSUE_SEARCH_STATUSES)[number];

export const ISSUE_SEARCH_SORT_KEYS = [
  "date-desc",
  "days-desc",
  "days-asc",
  "mentions-desc",
  "mentions-asc"
] as const;
export type IssueSearchSort = (typeof ISSUE_SEARCH_SORT_KEYS)[number];

export type IssueSearchPage = {
  rows: IssueRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  status: IssueSearchStatus;
  sort: IssueSearchSort;
};

/** Whitelist-driven ORDER BY snippets. ORDER BY can't be parameterized
 *  via pg `$N`, so the caller's choice MUST come from the enum above
 *  before reaching this function. */
const SORT_SQL: Record<IssueSearchSort, string> = {
  "date-desc": "COALESCE(introduced_date_ts, fixed_date_ts) DESC NULLS LAST, issue_id ASC",
  "days-desc": "days_open DESC NULLS LAST, issue_id ASC",
  "days-asc": "days_open ASC NULLS LAST, issue_id ASC",
  "mentions-desc": "mention_count DESC, issue_id ASC",
  "mentions-asc": "mention_count ASC, issue_id ASC"
};

/**
 * Free-text search across issue ids + their first Known-Issues body.
 * Server-paginated — total count comes back so the caller can render
 * a "showing X-Y of Z" line and Prev/Next links.
 *
 * - Query is matched ILIKE on `issue_id` AND on `body`, so "UUM-22444"
 *   finds the exact id and "addressables" finds every issue whose
 *   body mentions Addressables.
 * - Empty / whitespace-only query short-circuits to a zero page so
 *   callers don't need to guard.
 * - Reuses the same IssueRow shape the existing tables render so the
 *   results card can drop into the existing IssueTable component.
 */
export async function searchIssues(
  rawQuery: string,
  options: {
    page?: number;
    pageSize?: number;
    status?: IssueSearchStatus;
    sort?: IssueSearchSort;
  } = {}
): Promise<IssueSearchPage> {
  const page = Math.max(1, Math.floor(options.page ?? 1));
  const pageSize = Math.max(1, Math.min(100, Math.floor(options.pageSize ?? 25)));
  const status: IssueSearchStatus = (ISSUE_SEARCH_STATUSES as readonly string[]).includes(
    options.status ?? "all"
  )
    ? (options.status as IssueSearchStatus) ?? "all"
    : "all";
  const sort: IssueSearchSort = (ISSUE_SEARCH_SORT_KEYS as readonly string[]).includes(
    options.sort ?? "date-desc"
  )
    ? (options.sort as IssueSearchSort) ?? "date-desc"
    : "date-desc";
  const empty: IssueSearchPage = {
    rows: [],
    total: 0,
    page,
    pageSize,
    totalPages: 0,
    status,
    sort
  };
  const q = rawQuery.trim();
  if (q.length === 0) return empty;
  // Match ILIKE %q% with PG escape for the LIKE wildcards.
  const pattern = `%${q.replace(/[\\%_]/g, (c) => "\\" + c)}%`;
  const offset = (page - 1) * pageSize;
  const statusFilter = status === "all" ? "" : `WHERE status = '${status}'`;
  const orderBy = SORT_SQL[sort];

  // Shared CTE block driving both the count and the paginated row
  // query. Keeping the same CTE definitions in both means the row
  // query's status_val and the count's status_val agree.
  const baseCTE = `
    WITH matched AS (
      SELECT DISTINCT im.issue_id
      FROM issue_mentions im
      LEFT JOIN release_note_items rn ON rn.id = im.release_note_item_id
      WHERE im.issue_id ILIKE $1 ESCAPE '\\' OR rn.body ILIKE $1 ESCAPE '\\'
    ),
    first_known AS (
      SELECT DISTINCT ON (im.issue_id) im.issue_id, ur.version, ur.release_date, im.area, rn.body
      FROM issue_mentions im
      JOIN unity_releases ur ON ur.id = im.unity_release_id
      JOIN release_note_items rn ON rn.id = im.release_note_item_id
      WHERE im.section = 'Known Issues' AND im.issue_id IN (SELECT issue_id FROM matched)
      ORDER BY im.issue_id, ur.release_date ASC NULLS LAST
    ),
    latest_known AS (
      SELECT DISTINCT ON (im.issue_id) im.issue_id, ur.release_date
      FROM issue_mentions im
      JOIN unity_releases ur ON ur.id = im.unity_release_id
      WHERE im.section = 'Known Issues' AND im.issue_id IN (SELECT issue_id FROM matched)
      ORDER BY im.issue_id, ur.release_date DESC NULLS LAST
    ),
    first_fix AS (
      SELECT DISTINCT ON (im.issue_id) im.issue_id, ur.version, ur.release_date
      FROM issue_mentions im
      JOIN unity_releases ur ON ur.id = im.unity_release_id
      WHERE im.section = 'Fixes' AND im.issue_id IN (SELECT issue_id FROM matched)
      ORDER BY im.issue_id, ur.release_date ASC NULLS LAST
    ),
    latest_fix AS (
      SELECT DISTINCT ON (im.issue_id) im.issue_id, ur.release_date
      FROM issue_mentions im
      JOIN unity_releases ur ON ur.id = im.unity_release_id
      WHERE im.section = 'Fixes' AND im.issue_id IN (SELECT issue_id FROM matched)
      ORDER BY im.issue_id, ur.release_date DESC NULLS LAST
    ),
    any_body AS (
      -- Fallback body for matched issues with no Known-Issues mention.
      SELECT DISTINCT ON (im.issue_id) im.issue_id, rn.body, im.area
      FROM issue_mentions im
      JOIN release_note_items rn ON rn.id = im.release_note_item_id
      JOIN unity_releases ur ON ur.id = im.unity_release_id
      WHERE im.issue_id IN (SELECT issue_id FROM matched)
      ORDER BY im.issue_id, ur.release_date ASC NULLS LAST
    ),
    mention_counts AS (
      SELECT issue_id, COUNT(DISTINCT unity_release_id) AS n
      FROM issue_mentions
      WHERE issue_id IN (SELECT issue_id FROM matched)
      GROUP BY issue_id
    ),
    rows AS (
      SELECT
        m.issue_id,
        COALESCE(fk.area, ab.area) AS area,
        COALESCE(fk.body, ab.body) AS description,
        fk.version              AS introduced_version,
        fk.release_date::text   AS introduced_date,
        fk.release_date         AS introduced_date_ts,
        ff.version              AS fixed_version,
        ff.release_date::text   AS fixed_date,
        ff.release_date         AS fixed_date_ts,
        CASE
          WHEN fk.release_date IS NOT NULL
            THEN EXTRACT(EPOCH FROM (COALESCE(ff.release_date, now()) - fk.release_date)) / 86400
          ELSE NULL
        END AS days_open,
        COALESCE(mc.n, 0) AS mention_count,
        CASE
          WHEN ff.issue_id IS NULL AND fk.issue_id IS NOT NULL THEN 'open'
          WHEN lk.release_date IS NOT NULL AND lf.release_date IS NOT NULL
               AND lk.release_date > lf.release_date THEN 'regressed'
          WHEN ff.issue_id IS NOT NULL THEN 'fixed'
          ELSE 'open'
        END AS status
      FROM matched m
      LEFT JOIN first_known fk  ON fk.issue_id = m.issue_id
      LEFT JOIN any_body ab     ON ab.issue_id = m.issue_id
      LEFT JOIN first_fix ff    ON ff.issue_id = m.issue_id
      LEFT JOIN latest_known lk ON lk.issue_id = m.issue_id
      LEFT JOIN latest_fix lf   ON lf.issue_id = m.issue_id
      LEFT JOIN mention_counts mc ON mc.issue_id = m.issue_id
    )
  `;

  // Count + fetch as two queries sharing the same CTE block. The count
  // applies the status filter so pagination math stays consistent
  // (showing X of N) when the user filters to a subset.
  const countResult = await query<{ total: string }>(
    `${baseCTE} SELECT COUNT(*)::text AS total FROM rows ${statusFilter}`,
    [pattern]
  );
  const total = Number(countResult.rows[0]?.total ?? 0);
  if (total === 0) return empty;

  const result = await query<{
    issue_id: string;
    area: string | null;
    introduced_version: string | null;
    introduced_date: string | null;
    days_open: string | null;
    mention_count: string;
    fixed_version: string | null;
    fixed_date: string | null;
    status: string;
    description: string | null;
  }>(
    `
      ${baseCTE}
      SELECT
        issue_id, area, description, introduced_version, introduced_date,
        fixed_version, fixed_date, days_open::text, mention_count::text, status
      FROM rows
      ${statusFilter}
      ORDER BY ${orderBy}
      LIMIT $2 OFFSET $3
    `,
    [pattern, pageSize, offset]
  );

  const resultRows: IssueRow[] = result.rows.map((row) => ({
    issueId: row.issue_id,
    status: (row.status as IssueRow["status"]) ?? "open",
    area: row.area,
    introducedVersion: row.introduced_version,
    introducedDate: row.introduced_date,
    fixedVersion: row.fixed_version,
    fixedDate: row.fixed_date,
    daysOpen: row.days_open != null ? Number(row.days_open) : null,
    mentionCount: Number(row.mention_count),
    description: row.description
  }));
  return {
    rows: resultRows,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    status,
    sort
  };
}

export type IssueHeatmapCell = {
  domain: Domain | "Other";
  status: "open" | "fixed";
  count: number;
};

/** Domain × status counts for the heatmap. Each issue is counted once,
 *  bucketed by:
 *    - domain: from any non-null `area` mention (DOMAIN_CASE regex)
 *    - status: 'open' if no Fix mention, otherwise 'fixed'
 *  Regressed issues count as 'open' here (Unity considers them
 *  unresolved). */
export async function getIssueDomainHeatmap(): Promise<IssueHeatmapCell[]> {
  const domainCase = buildDomainCase("im_area.area");
  const result = await query<{
    domain: string;
    status: string;
    count: string;
  }>(
    `
      WITH issue_status AS (
        SELECT
          issue_id,
          BOOL_OR(section = 'Fixes') AS has_fix,
          BOOL_OR(section = 'Known Issues') AS has_known,
          MAX(CASE WHEN section = 'Fixes' THEN ur.release_date END) AS latest_fix,
          MAX(CASE WHEN section = 'Known Issues' THEN ur.release_date END) AS latest_known
        FROM issue_mentions im
        JOIN unity_releases ur ON ur.id = im.unity_release_id
        GROUP BY issue_id
      ),
      issue_area AS (
        SELECT DISTINCT ON (im.issue_id) im.issue_id, im.area
        FROM issue_mentions im
        WHERE im.area IS NOT NULL
        ORDER BY im.issue_id
      )
      SELECT
        ${domainCase} AS domain,
        CASE
          WHEN NOT iss.has_fix THEN 'open'
          WHEN iss.latest_known IS NOT NULL AND iss.latest_fix IS NOT NULL
               AND iss.latest_known > iss.latest_fix THEN 'open'
          ELSE 'fixed'
        END AS status,
        COUNT(*)::text AS count
      FROM issue_status iss
      LEFT JOIN issue_area im_area ON im_area.issue_id = iss.issue_id
      GROUP BY 1, 2
    `
  );
  return result.rows.map((row) => ({
    domain: (row.domain as Domain | "Other") ?? "Other",
    status: (row.status as "open" | "fixed") ?? "open",
    count: Number(row.count)
  }));
}

/** Builds the same kind of regex CASE expression used elsewhere on the
 *  site but parameterized by the caller's column reference (so we can
 *  apply it to im_area.area rather than the table's bare `area`). */
function buildDomainCase(columnRef: string): string {
  // Mirrors DOMAIN_PATTERNS in src/lib/visualizer.ts. Kept in sync by
  // hand — both files are short and the regex set is canonical.
  const branches: Array<[Domain, string]> = [
    ["Rendering", "^(URP|HDRP|SRP|Rendering|Graphics|Shaders?|Shader Graph|Post[- ]?processing|Lighting|GPU|Render Pipeline|Visual Effect|VFX|Camera)"],
    ["Scripting", "^(Scripting|C#|IL2CPP|Burst|Mono|Job System|DOTS|Entities|ECS|Compiler|Roslyn)"],
    ["Mobile", "^(Android|iOS|Mobile)"],
    ["XR", "^(XR|AR|VR|OpenXR|VisionOS|MR|MARS)"],
    ["Physics", "^(Physics|Physics 2D|Cloth)"],
    ["UI", "^(UI|UI Toolkit|UI Builder|UIElements|IMGUI|UGUI|TextMesh)"],
    ["Networking", "^(Networking|Netcode|Multiplayer|Transport|Relay|Lobby)"],
    ["Editor", "^(Editor|Inspector|Hierarchy|Scene Manag|Project Browser|Preferences|Build Profile)"],
    ["Audio", "^(Audio|Sound|DSP)"],
    ["Animation", "^(Animation|Animator|Timeline|Mecanim)"],
    ["Asset Pipeline", "^(Asset|Import|Asset Bundle|Addressables|AssetDatabase|Prefab|Texture|Mesh|Loading)"],
    ["Input", "^(Input|Input System|Touch|Pointer|Gamepad|Keyboard|Mouse)"]
  ];
  const whens = branches
    .map(([domain, pat]) => `WHEN ${columnRef} ~* '${pat.replace(/'/g, "''")}' THEN '${domain}'`)
    .join(" ");
  return `CASE ${whens} ELSE 'Other' END`;
}

export const ALL_DOMAINS_PLUS_OTHER: ReadonlyArray<Domain | "Other"> = [...DOMAINS, "Other"];
