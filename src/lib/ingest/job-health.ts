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
  return CORE_JOBS.map(job => {
    const row = rows.find(r => r.job_name === job.jobName);
    const hours = row?.last_success ? (now - new Date(row.last_success).getTime()) / 3_600_000 : Infinity;
    const recentStatus = row?.latest_status === "running" ? row.last_completed_status : row?.latest_status;
    const abandoned = row?.latest_status === "running" && (!row.last_run
      || !Number.isFinite(Date.parse(row.last_run))
      || now - Date.parse(row.last_run) > 2 * 60 * 60_000);
    const status = abandoned || recentStatus === "failed" ? "failed"
      : !row?.last_success ? "never"
      : hours > 36 ? "stale" : "ok";
    return { ...job, lastSuccessAt: row?.last_success ?? null,
      lastRunAt: row?.last_run ?? null, hoursSinceLastSuccess: hours,
      isStale: status !== "ok", status, cadenceHours: 12 };
  });
}

export async function runScheduledJob(jobName: string, work: () => Promise<unknown>) {
  const { rows } = await query<{ id: string }>(
    "INSERT INTO core_job_runs (job_name) VALUES ($1) RETURNING id::text", [jobName]);
  const id = rows[0].id;
  try {
    await work();
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
