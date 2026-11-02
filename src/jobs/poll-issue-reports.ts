import { pathToFileURL } from "node:url";
import { getPool, query } from "../lib/db/client";
import { recordSourceSnapshot } from "../lib/db/repositories";
import { scheduledJobMain } from "../lib/ingest/job-health";
import { sha256 } from "../lib/ingest/hash";
import { createTrackerFetcher, TrackerFetchError, TRACKER_REPORT_TIMEOUT_MS } from "../lib/issue-reports/fetch";
import { issueReportCollectionEnabled } from "../lib/issue-reports/flags";
import { issueReportCoverage, saveIssueReport, withReportWrite } from "../lib/issue-reports/repository";
import { normalizeIssueId } from "../lib/parsers/issue-report";

export type CollectionOptions = { issueId?: string; version?: string; minorLines?: string[]; all?: boolean; limit?: number; signal?: AbortSignal };
export async function discoverIssueReports(options: CollectionOptions) {
  const lines = options.minorLines ?? (process.env.ISSUE_REPORT_MINOR_LINES ?? "").split(",").filter(Boolean);
  if (!options.issueId && !options.version && !options.all && !lines.length) {
    throw new Error("Set ISSUE_REPORT_MINOR_LINES or select --issue, --version, or --all explicitly.");
  }
  return query(`INSERT INTO issue_reports (issue_id, source_url)
    SELECT im.issue_id, (array_agg(im.issue_url ORDER BY ur.release_date DESC NULLS LAST)
      FILTER (WHERE im.issue_url IS NOT NULL))[1]
    FROM issue_mentions im JOIN unity_releases ur ON ur.id=im.unity_release_id
    WHERE ($1::text IS NULL OR im.issue_id=$1)
      AND ($2::text IS NULL OR ur.version=$2)
      AND ($3::boolean OR ur.minor_line=ANY($4::text[]))
    GROUP BY im.issue_id HAVING bool_or(im.issue_url IS NOT NULL)
    ON CONFLICT (issue_id) DO NOTHING`,
    [options.issueId ? normalizeIssueId(options.issueId) : null, options.version ?? null,
      Boolean(options.all || options.issueId || options.version), lines]);
}

export async function collectIssueReports(options: CollectionOptions = {}, dependencies: {
  fetchReport?: ReturnType<typeof createTrackerFetcher>;
  budgetMs?: number;
  minimumRemainingMs?: number;
} = {}) {
  options = { ...options, issueId: options.issueId ? normalizeIssueId(options.issueId) : undefined,
    minorLines: options.minorLines ?? (process.env.ISSUE_REPORT_MINOR_LINES ?? "").split(",").filter(Boolean) };
  const limit = Math.min(100, Math.max(1, options.limit ?? 100));
  const lock = await getPool().connect();
  let locked;
  try { locked = await lock.query<{ locked: boolean }>("SELECT pg_try_advisory_lock(187341, 2) AS locked"); }
  catch (error) { lock.release(error instanceof Error ? error : true); throw error; }
  if (!locked.rows[0].locked) { lock.release(); return { skipped: "already running" }; }
  const budgetMs = dependencies.budgetMs ?? 8 * 60_000;
  const signal = AbortSignal.any([AbortSignal.timeout(budgetMs), ...(options.signal ? [options.signal] : [])]);
  const summary = { requested: 0, fetched: 0, unchanged: 0, unavailable: 0, failed: 0, requests: 0, bytes: 0, budgetReached: false, cooldown: false, durationMs: 0 };
  const started = Date.now();
  const fetchReport = dependencies.fetchReport ?? createTrackerFetcher({ signal, onRequest: () => { summary.requests++; } });
  try {
    const cooldown = await query<{ cooling: boolean }>("SELECT cooldown_until > now() AS cooling FROM issue_report_collector_state WHERE singleton");
    if (cooldown.rows[0]?.cooling) return { skipped: "tracker cooldown" };
    await discoverIssueReports(options);
    // Interleave overdue and pending work so a slow retry backlog cannot consume
    // the entire wall-clock budget before a newly referenced report is attempted.
    const due = await query<{ issue_id: string; source_url: string; canonical_url: string | null }>(`
      WITH eligible AS (
        SELECT *, (SELECT max(ur.release_date) FROM issue_mentions im JOIN unity_releases ur ON ur.id=im.unity_release_id
          WHERE im.issue_id=issue_reports.issue_id) AS last_reference_date
        FROM issue_reports WHERE next_attempt_at <= now()
          AND ($1::text IS NULL OR issue_id=$1)
          AND EXISTS (SELECT 1 FROM issue_mentions im JOIN unity_releases ur ON ur.id=im.unity_release_id
            WHERE im.issue_id=issue_reports.issue_id AND ($2::text IS NULL OR ur.version=$2)
              AND ($3::boolean OR ur.minor_line=ANY($4::text[])
                OR ($6::boolean AND issue_reports.last_attempt_at IS NOT NULL)))
      ), numbered AS (
        SELECT *, row_number() OVER (PARTITION BY (last_attempt_at IS NOT NULL)
          ORDER BY CASE WHEN last_attempt_at IS NULL AND last_reference_date >= now()-interval '14 days' THEN 0 ELSE 1 END,
            next_attempt_at, first_seen_at, issue_id) AS n FROM eligible
      ) SELECT issue_id, source_url, canonical_url FROM numbered
      ORDER BY n, (last_attempt_at IS NULL), issue_id LIMIT $5`,
      [options.issueId ?? null, options.version ?? null, Boolean(options.all || options.issueId || options.version),
        options.minorLines, limit, !options.all && !options.issueId && !options.version]);
    let consecutiveParserFailures = 0;
    for (const row of due.rows) {
      // Leave enough time for a whole report, including pacing and redirects.
      // Ordinary batch completion should not manufacture a timeout/retry row.
      if (signal.aborted || Date.now()-started >= budgetMs-(dependencies.minimumRemainingMs ?? TRACKER_REPORT_TIMEOUT_MS)) {
        summary.budgetReached = true; break;
      }
      summary.requested++;
      try {
        const fetched = await fetchReport(row.issue_id, row.source_url, row.canonical_url);
        const changed = await withReportWrite(async client => {
          const snapshotId = await recordSourceSnapshot(client, "issue_report", {
            url: row.source_url, finalUrl: fetched.url, status: fetched.status, etag: null,
            lastModified: null, text: fetched.text, sha256: sha256(fetched.text)
          });
          return saveIssueReport(client, { issueId: row.issue_id, sourceUrl: row.source_url,
            url: fetched.url, report: fetched.report, snapshotId });
        });
        summary.bytes += Buffer.byteLength(fetched.text);
        if (!fetched.report) summary.unavailable++;
        else if (changed) summary.fetched++;
        else summary.unchanged++;
        consecutiveParserFailures = 0;
      } catch (error) {
        if (signal.aborted) summary.budgetReached = true;
        summary.failed++;
        const retryAt = error instanceof TrackerFetchError ? error.retryAt : undefined;
        await query(`UPDATE issue_reports SET last_outcome='failed', last_attempt_at=now(),
          failure_count=failure_count+1, last_error=$2,
          next_attempt_at=coalesce($3::timestamptz, now() + least(86400, 300 * power(2, least(failure_count, 9))) * interval '1 second')
          WHERE issue_id=$1`, [row.issue_id, (error as Error).message.slice(0, 1000), retryAt ?? null]);
        if (retryAt) {
          await query("UPDATE issue_report_collector_state SET cooldown_until=$1 WHERE singleton", [retryAt]);
          summary.cooldown = true;
          break;
        }
        consecutiveParserFailures = error instanceof TrackerFetchError && error.parserFailure ? consecutiveParserFailures + 1 : 0;
        if (consecutiveParserFailures >= 3 || signal.aborted) break;
      }
    }
    summary.durationMs = Date.now() - started;
    const coverage = await issueReportCoverage(options);
    await query("UPDATE issue_report_collector_state SET last_summary=$1 WHERE singleton", [{ ...summary, coverage }]);
    console.log(JSON.stringify({ ...summary, coverage }));
    if (options.signal?.aborted) throw new Error("Issue report collection cancelled");
    if (summary.failed) throw new Error(`Issue report collection failed for ${summary.failed} report(s); successful items were saved.`);
    return { ...summary, coverage };
  } finally {
    await lock.query("SELECT pg_advisory_unlock(187341, 2)").finally(() => lock.release());
  }
}

export function parseCollectionArgs(args: string[]): CollectionOptions & { inventory?: boolean } {
  const options: CollectionOptions & { inventory?: boolean } = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--all") options.all = true;
    else if (args[i] === "--inventory") options.inventory = true;
    else if (args[i] === "--issue" || args[i] === "--version") {
      const flag = args[i]; const value = args[++i];
      if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
      if (flag === "--issue") options.issueId = normalizeIssueId(value);
      else {
        if (!/^\d+\.\d+\.\d+[abfp]\d+$/.test(value)) throw new Error("Invalid release version");
        options.version = value;
      }
    } else throw new Error(`Unknown argument: ${args[i]}`);
  }
  return options;
}

export async function reportInventory() {
  const result = await query(`SELECT ur.minor_line, count(DISTINCT im.issue_id)::int AS referenced,
    count(DISTINCT im.issue_id) FILTER (WHERE r.content_available)::int AS available,
    count(DISTINCT im.issue_id) FILTER (WHERE r.last_outcome='unavailable')::int AS unavailable,
    count(DISTINCT im.issue_id) FILTER (WHERE r.last_outcome='failed')::int AS failed,
    count(DISTINCT im.issue_id) FILTER (WHERE r.issue_id IS NULL OR r.last_outcome='pending')::int AS pending
    FROM issue_mentions im JOIN unity_releases ur ON ur.id=im.unity_release_id
    LEFT JOIN issue_reports r ON r.issue_id=im.issue_id
    GROUP BY ur.minor_line ORDER BY ur.minor_line`);
  console.log(JSON.stringify({ lines: result.rows }, null, 2));
}

export async function main() {
  const options = parseCollectionArgs(process.argv.slice(2));
  if (options.inventory) { await reportInventory(); return; }
  if (!issueReportCollectionEnabled()) { console.log("Issue report collection disabled"); return; }
  await collectIssueReports(options);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const controller = new AbortController();
  process.once("SIGTERM", () => controller.abort());
  process.once("SIGINT", () => controller.abort());
  void (async () => {
    const options = parseCollectionArgs(process.argv.slice(2));
    if (options.inventory) { try { await reportInventory(); } finally { await getPool().end(); } }
    else if (issueReportCollectionEnabled()) await scheduledJobMain("poll-issue-reports", () => collectIssueReports({ ...options, signal: controller.signal }));
    else console.log("Issue report collection disabled");
  })().catch(error => { console.error(error); process.exitCode = 1; });
}
