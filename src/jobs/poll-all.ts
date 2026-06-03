/**
 * Mega-cron entrypoint that runs every ingest job in sequence so we
 * only need one Railway cron service instead of five. Each job runs
 * as its own `npm run ingest:*` child process: that keeps the
 * existing single-purpose scripts untouched, gives each job a clean
 * Node state and DB pool, and isolates failures.
 *
 * Failure semantics: continue on a per-job failure (the news endpoint
 * being flaky shouldn't block fresh package data), but exit non-zero
 * at the end if anything failed so Railway flags the run as failed
 * in its deployment history.
 */
import { spawn } from "node:child_process";

export type JobName =
  | "editor"
  | "packages"
  | "legacy-lts"
  | "news"
  | "resources"
  | "discussions";

export type JobDefinition = {
  name: JobName;
  npmScript: `ingest:${string}`;
};

/**
 * Job order is deliberate, not alphabetical:
 *
 * - editor first because release notes are the spine of every other
 *   surface; a fresh editor poll keeps the diff view current.
 * - packages second so the registry data lines up with the just-polled
 *   release notes that reference it.
 * - legacy-lts third because it's the cheapest read (sitemap diff) and
 *   benefits from happening before news/resources fan out the network.
 * - news/resources next - they're secondary content with low budget.
 * - discussions LAST - the Discourse staff-post fan-out is the
 *   longest single job (~20 min worst case) and the most
 *   network-bound. Running it after the more urgent surfaces means
 *   a Railway max-runtime kill won't block fresh release/package
 *   data.
 */
export const JOB_ORDER: JobDefinition[] = [
  { name: "editor", npmScript: "ingest:editor" },
  { name: "packages", npmScript: "ingest:packages" },
  { name: "legacy-lts", npmScript: "ingest:legacy-lts" },
  { name: "news", npmScript: "ingest:news" },
  { name: "resources", npmScript: "ingest:resources" },
  { name: "discussions", npmScript: "ingest:discussions" }
];

export type JobResult = {
  name: JobName;
  ok: boolean;
  durationMs: number;
  exitCode: number | null;
};

export type RunSummary = {
  total: number;
  ok: number;
  failed: number;
  totalDurationMs: number;
  jobs: JobResult[];
};

export type SpawnJob = (job: JobDefinition) => Promise<{ exitCode: number | null }>;

/** Default spawner: shells out to `npm run <script>` and inherits stdio
 *  so the child's logs appear in Railway's log stream live. */
const defaultSpawn: SpawnJob = (job) =>
  new Promise((resolve, reject) => {
    const proc = spawn("npm", ["run", job.npmScript], {
      stdio: "inherit",
      env: process.env
    });
    proc.on("exit", (exitCode) => resolve({ exitCode }));
    proc.on("error", (err) => reject(err));
  });

/** Pure orchestrator extracted from `main` so tests can inject a fake
 *  spawner and assert ordering, summary shape, and exit-code semantics
 *  without actually shelling out to npm. */
export async function runAllJobs(
  jobs: JobDefinition[] = JOB_ORDER,
  spawnJob: SpawnJob = defaultSpawn
): Promise<RunSummary> {
  const runStart = Date.now();
  const results: JobResult[] = [];
  for (const job of jobs) {
    console.log(JSON.stringify({ event: "job_start", job: job.name }));
    const start = Date.now();
    let exitCode: number | null = null;
    try {
      ({ exitCode } = await spawnJob(job));
    } catch (error) {
      // `spawn` itself failed (npm missing, permission denied, etc).
      // Log and treat as a failure but keep going so the rest of the
      // run can still produce fresh data.
      console.error(
        JSON.stringify({
          event: "job_spawn_error",
          job: job.name,
          error: error instanceof Error ? error.message : String(error)
        })
      );
      exitCode = -1;
    }
    const durationMs = Date.now() - start;
    const ok = exitCode === 0;
    results.push({ name: job.name, ok, durationMs, exitCode });
    console.log(
      JSON.stringify({
        event: "job_end",
        job: job.name,
        ok,
        exitCode,
        durationMs
      })
    );
  }

  const summary: RunSummary = {
    total: results.length,
    ok: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    totalDurationMs: Date.now() - runStart,
    jobs: results
  };
  return summary;
}

async function main() {
  const summary = await runAllJobs();
  console.log(JSON.stringify({ event: "run_summary", ...summary }));
  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

// `import.meta.url === pathToFileURL(process.argv[1])` style guard,
// but kept simple - this file is the cron entrypoint, so just run.
// Skip when imported by tests (they don't pass argv[1] pointing here).
const isDirectRun =
  process.argv[1] && process.argv[1].endsWith("poll-all.ts");
if (isDirectRun) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
