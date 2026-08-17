import { describe, expect, test, vi } from "vitest";

import {
  isWindows,
  JOB_ORDER,
  npmRunCommand,
  runAllJobs,
  type JobDefinition,
  type SpawnJob
} from "../../src/jobs/poll-all";

const JOBS: JobDefinition[] = [
  { name: "editor", npmScript: "ingest:editor" },
  { name: "packages", npmScript: "ingest:packages" },
  { name: "news", npmScript: "ingest:news" }
];

describe("npm child-process invocation", () => {
  // Every job failed in ~4ms on Windows: first `spawn npm ENOENT` (npm is
  // a .cmd shim and shell-less spawn only resolves real executables), then
  // `spawn EINVAL` once the shim was named (post-CVE-2024-27980 Node
  // refuses .cmd without a shell). Railway is Linux and the unit tests
  // inject a fake spawner, so nothing caught it.
  test("routes through cmd.exe on Windows and spawns npm directly elsewhere", () => {
    const [command, args] = npmRunCommand("ingest:editor");
    if (process.platform === "win32") {
      expect(command).toBe("cmd.exe");
      expect(args).toEqual(["/c", "npm", "run", "ingest:editor"]);
    } else {
      expect(command).toBe("npm");
      expect(args).toEqual(["run", "ingest:editor"]);
    }
  });

  test("leaves the Linux invocation - the only one Railway runs - unchanged", () => {
    expect(isWindows).toBe(process.platform === "win32");
    if (!isWindows) expect(npmRunCommand("check:invariants")[0]).toBe("npm");
  });

  test("every shipped job name is inert as a shell argument", () => {
    for (const job of JOB_ORDER) {
      expect(job.npmScript).toMatch(/^[a-z0-9](?:[a-z0-9:_-]*[a-z0-9])?$/i);
    }
  });
});

describe("JOB_ORDER", () => {
  test("runs editor first so downstream surfaces see fresh release notes", () => {
    expect(JOB_ORDER[0]?.name).toBe("editor");
  });

  test("covers every ingest pipeline that previously had its own cron", () => {
    const names = JOB_ORDER.map((j) => j.name).sort();
    expect(names).toEqual([
      "backfill",
      "discussions",
      "editor",
      "github",
      "invariants",
      "legacy-lts",
      "news",
      "package-docs",
      "packages",
      "resources"
    ]);
  });

  test("runs backfill before discussions so its one-time walk isn't starved", () => {
    const names = JOB_ORDER.map((j) => j.name);
    expect(names.indexOf("backfill")).toBeLessThan(names.indexOf("discussions"));
  });

  test("runs the data-quality gate last, after every writer", () => {
    // It asserts what the other jobs just wrote, so it must see final state.
    expect(JOB_ORDER[JOB_ORDER.length - 1]?.name).toBe("invariants");
  });

  test("npm scripts use a canonical ingest:* / check:* name", () => {
    for (const job of JOB_ORDER) {
      expect(
        job.npmScript.startsWith("ingest:") || job.npmScript.startsWith("check:")
      ).toBe(true);
    }
  });
});

describe("runAllJobs", () => {
  test("runs jobs sequentially in the order they were defined", async () => {
    const calls: string[] = [];
    const spawn: SpawnJob = async (job) => {
      calls.push(job.name);
      return { exitCode: 0 };
    };
    await runAllJobs(JOBS, spawn);
    expect(calls).toEqual(["editor", "packages", "news"]);
  });

  test("returns a green summary when every job succeeds", async () => {
    const spawn: SpawnJob = async () => ({ exitCode: 0 });
    const summary = await runAllJobs(JOBS, spawn);
    expect(summary.total).toBe(3);
    expect(summary.ok).toBe(3);
    expect(summary.failed).toBe(0);
    expect(summary.jobs.every((j) => j.ok)).toBe(true);
    expect(summary.jobs.every((j) => j.exitCode === 0)).toBe(true);
  });

  test("continues past a failing job and marks only that one as failed", async () => {
    const spawn: SpawnJob = async (job) => {
      if (job.name === "packages") return { exitCode: 2 };
      return { exitCode: 0 };
    };
    const summary = await runAllJobs(JOBS, spawn);
    expect(summary.ok).toBe(2);
    expect(summary.failed).toBe(1);
    const packagesResult = summary.jobs.find((j) => j.name === "packages");
    expect(packagesResult?.ok).toBe(false);
    expect(packagesResult?.exitCode).toBe(2);
    // News still ran after the packages failure.
    expect(summary.jobs.map((j) => j.name)).toContain("news");
  });

  test("treats a thrown spawn error as a failure but keeps going", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const spawn: SpawnJob = async (job) => {
      if (job.name === "editor") throw new Error("npm not found");
      return { exitCode: 0 };
    };
    const summary = await runAllJobs(JOBS, spawn);
    expect(summary.failed).toBe(1);
    const editorResult = summary.jobs.find((j) => j.name === "editor");
    expect(editorResult?.ok).toBe(false);
    expect(editorResult?.exitCode).toBe(-1);
    expect(summary.ok).toBe(2);
    errSpy.mockRestore();
  });

  test("records each job's duration so we can spot slow polls in logs", async () => {
    const spawn: SpawnJob = async () =>
      new Promise((resolve) => setTimeout(() => resolve({ exitCode: 0 }), 5));
    const summary = await runAllJobs(JOBS, spawn);
    for (const job of summary.jobs) {
      expect(job.durationMs).toBeGreaterThanOrEqual(0);
    }
    expect(summary.totalDurationMs).toBeGreaterThanOrEqual(0);
  });
});
