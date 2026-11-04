import { issueReportCollectionEnabled } from "../issue-reports/flags";
import { getPool, query } from "../db/client";

/** Whole scheduled jobs, not successful items within a partly failed batch. */
export const CORE_JOBS = [
  { jobName: "poll-editor", sourceType: "editor_release" },
  { jobName: "poll-legacy-lts", sourceType: "legacy_editor_release" },
  { jobName: "poll-packages", sourceType: "package_registry" },
  { jobName: "poll-package-docs", sourceType: "package_docs" },
  { jobName: "poll-news", sourceType: "blog_rss" },
  { jobName: "poll-resources", sourceType: "resources" },
  { jobName: "poll-github", sourceType: "github" },
  { jobName: "poll-discussions", sourceType: "discussions" }
] as const;

export type JobHealthRow = {
  job_name: string; last_success: string | null; last_run: string | null;
  latest_status: string | null; last_completed_status?: string | null;
};

export function evaluateJobFreshness(rows: JobHealthRow[], now = Date.now()) {
  const jobs = [...CORE_JOBS, ...(issueReportCollectionEnabled() ? [{ jobName: "poll-issue-reports", sourceType: "issue_report" }] : [])];
  return jobs.map(job => {
    const cadenceHours = job.jobName === "poll-issue-reports" ? 0.5 : 12;
    const staleHours = job.jobName === "poll-issue-reports" ? 2 : 36;
    const runningLimitHours = job.jobName === "poll-issue-reports" ? 0.25 : 2;
    const row = rows.find(r => r.job_name === job.jobName);
    const hours = row?.last_success ? (now - new Date(row.last_success).getTime()) / 3_600_000 : Infinity;
    const recentStatus = row?.latest_status === "running" || row?.latest_status === "skipped" ? row.last_completed_status : row?.latest_status;
    const abandoned = row?.latest_status === "running" && (!row.last_run
      || !Number.isFinite(Date.parse(row.last_run))
      || now - Date.parse(row.last_run) > runningLimitHours * 60 * 60_000);
    const status = abandoned || recentStatus === "failed" ? "failed"
      : !row?.last_success ? "never"
      : hours > staleHours ? "stale" : "ok";
    return { ...job, lastSuccessAt: row?.last_success ?? null,
      lastRunAt: row?.last_run ?? null, hoursSinceLastSuccess: hours,
      isStale: status !== "ok", status, cadenceHours, staleHours, runningLimitHours };
  });
}

export async function runScheduledJob(jobName: string, work: () => Promise<unknown>) {
  const { rows } = await query<{ id: string }>(
    "INSERT INTO core_job_runs (job_name) VALUES ($1) RETURNING id::text", [jobName]);
  const id = rows[0].id;
  try {
    const result = await work();
    if (result && typeof result === "object" && "skipped" in result) {
      await query("UPDATE core_job_runs SET status='skipped', finished_at=now(), error_message=$2 WHERE id=$1", [id, String(result.skipped)]);
      return;
    }
    await query("UPDATE core_job_runs SET status='success', finished_at=now() WHERE id=$1", [id]);
  } catch (error) {
    await query("UPDATE core_job_runs SET status='failed', finished_at=now(), error_message=$2 WHERE id=$1",
      [id, error instanceof Error ? error.message : String(error)]).catch(() => undefined);
    throw error;
  }
}

/** CLI ownership: close the pool only after the whole job has settled. */
export async function scheduledJobMain(jobName: string, work: () => Promise<unknown>) {
  try { await runScheduledJob(jobName, work); }
  catch (error) { console.error(error); process.exitCode = 1; }
  finally { if (process.env.DATABASE_URL) await getPool().end(); }
}
