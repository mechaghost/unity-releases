import type { PoolClient } from "pg";
import { getPool, query } from "../db/client";
import type { ReleaseNoteSearchFilters } from "../search";
import { issueReportSearchEnabled } from "./flags";
import { InvalidQueryError } from "../api";
import { parseCanonicalQuery, validatePhraseSpans } from "./query";
import { reportExcerpt, type IssueReportContext } from "./context";
import { lockIssueReportWrites } from "./locks";
import { ISSUE_REPORT_PARSER_VERSION, type ParsedIssueReport } from "../parsers/issue-report";
import { sha256 } from "../ingest/hash";

export async function prepareReportSearch(filters: ReleaseNoteSearchFilters): Promise<ReleaseNoteSearchFilters> {
  if (!issueReportSearchEnabled() || !filters.q?.includes('"')) return filters;
  const result = await query<{ canonical: string }>("SELECT websearch_to_tsquery('english', $1)::text AS canonical", [filters.q]);
  try {
    const reportQuery = parseCanonicalQuery(result.rows[0].canonical);
    if (reportQuery) validatePhraseSpans(reportQuery);
    return { ...filters, reportQuery };
  } catch (error) { throw new InvalidQueryError((error as Error).message); }
}

export async function attachIssueReports<T extends { issue_ids?: string[] }>(rows: T[], q?: string): Promise<T[]> {
  if (!issueReportSearchEnabled() || !rows.length) return rows;
  const ids = [...new Set(rows.flatMap(row => row.issue_ids ?? []))];
  const reports = ids.length ? (await query<{
    issue_id: string; title: string; canonical_url: string; last_success_at: Date;
    description: string; description_truncated: boolean;
  }>(`SELECT issue_id, title, canonical_url, last_success_at, description, description_truncated
      FROM issue_reports WHERE issue_id = ANY($1::text[]) AND content_available ORDER BY issue_id`, [ids])).rows : [];
  const byId = new Map(reports.map(report => [report.issue_id, {
    issueId: report.issue_id, title: report.title, url: report.canonical_url,
    fetchedAt: report.last_success_at.toISOString(), excerpt: reportExcerpt(report.description, q),
    descriptionTruncated: report.description_truncated
  } satisfies IssueReportContext]));
  return rows.map(row => ({ ...row, issueReports: (row.issue_ids ?? []).flatMap(id => byId.has(id) ? [byId.get(id)!] : []) }));
}

export async function withReportWrite<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await lockIssueReportWrites(client);
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

export async function saveIssueReport(client: PoolClient, input: {
  issueId: string; url: string; sourceUrl: string; report: ParsedIssueReport | null;
  snapshotId: number;
}) {
  const { report } = input;
  const hash = report ? sha256(JSON.stringify(report)) : null;
  const old = await client.query<{ content_sha256: string | null; content_available: boolean }>(
    "SELECT content_sha256, content_available FROM issue_reports WHERE issue_id = $1", [input.issueId]);
  await client.query(`INSERT INTO issue_reports
    (issue_id, source_url, canonical_url, title, description, description_truncated,
     content_sha256, parser_version, source_snapshot_id, content_available,
     last_outcome, last_attempt_at, last_success_at, next_attempt_at, failure_count)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now(),now(),now() + $12::interval,0)
    ON CONFLICT (issue_id) DO UPDATE SET
      canonical_url=EXCLUDED.canonical_url, title=EXCLUDED.title, description=EXCLUDED.description,
      description_truncated=EXCLUDED.description_truncated, content_sha256=EXCLUDED.content_sha256,
      parser_version=EXCLUDED.parser_version, source_snapshot_id=EXCLUDED.source_snapshot_id,
      content_available=EXCLUDED.content_available, last_outcome=EXCLUDED.last_outcome,
      last_attempt_at=now(), last_success_at=CASE WHEN EXCLUDED.content_available THEN now() ELSE issue_reports.last_success_at END,
      next_attempt_at=EXCLUDED.next_attempt_at, failure_count=0, last_error=NULL`,
    [input.issueId, input.sourceUrl, input.url, report?.title ?? null, report?.description ?? null,
      report?.descriptionTruncated ?? false, hash, ISSUE_REPORT_PARSER_VERSION, input.snapshotId,
      Boolean(report), report ? "ready" : "unavailable", report ? "7 days" : "30 days"]);
  const changed = old.rows[0]?.content_sha256 !== hash || old.rows[0]?.content_available !== Boolean(report);
  if (changed) {
    // Both triggers run; the original note content and classification are unchanged.
    await client.query("UPDATE release_note_items SET body = body WHERE issue_ids @> ARRAY[$1]::text[]", [input.issueId]);
  }
  return changed;
}

export async function issueReportCoverage(options: { issueId?: string; version?: string; minorLines?: string[]; all?: boolean } = {}) {
  const result = await query(`SELECT
    count(*)::int AS total,
    count(*) FILTER (WHERE content_available)::int AS available,
    count(*) FILTER (WHERE last_outcome='unavailable')::int AS unavailable,
    count(*) FILTER (WHERE last_outcome='failed')::int AS failed,
    count(*) FILTER (WHERE last_outcome='pending')::int AS pending,
    count(*) FILTER (WHERE next_attempt_at <= now())::int AS due,
    min(first_seen_at) FILTER (WHERE last_outcome='pending') AS oldest_pending,
    min(next_attempt_at) FILTER (WHERE last_attempt_at IS NOT NULL AND next_attempt_at <= now()) AS oldest_due,
    coalesce(bool_or(last_attempt_at IS NOT NULL AND next_attempt_at < now()-interval '48 hours'), false) AS overdue
    FROM issue_reports r WHERE ($1::text IS NULL OR r.issue_id=$1)
      AND EXISTS (SELECT 1 FROM issue_mentions im JOIN unity_releases ur ON ur.id=im.unity_release_id
        WHERE im.issue_id=r.issue_id AND ($2::text IS NULL OR ur.version=$2)
          AND ($3::boolean OR ur.minor_line=ANY($4::text[]) OR ($5::boolean AND r.last_attempt_at IS NOT NULL)))`,
    [options.issueId ?? null, options.version ?? null, Boolean(options.all || options.issueId || options.version),
      options.minorLines ?? (process.env.ISSUE_REPORT_MINOR_LINES ?? "").split(",").filter(Boolean),
      !options.all && !options.issueId && !options.version]);
  return result.rows[0];
}
