import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { getPool } from "../lib/db/client";
import { productUpdateAdaptersForFamily } from "../lib/product-updates/sources";
import { PRODUCT_UPDATE_FAMILIES } from "../lib/product-updates/types";

type SourceProcessResult = {
  ok: boolean;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  durationMs: number;
  output?: unknown;
  error?: string;
};

type GroupSummaryEntry = {
  sourceKey: string;
  ok: boolean;
  status: "success" | "failed" | "skipped-disabled" | "skipped-budget";
  exitCode?: number | null;
  timedOut?: boolean;
  durationMs?: number;
  output?: unknown;
  error?: string;
};

type RunGroupOptions = {
  runSource?: (
    sourceKey: string,
    flags: string[],
    deadlineMs: number
  ) => Promise<SourceProcessResult>;
  now?: () => number;
  concurrency?: number;
  groupDeadlineMs?: number;
  sourceDeadlineMs?: number;
};

const DEFAULT_CONCURRENCY = 2;
const DEFAULT_GROUP_DEADLINE_MS = 20 * 60_000;
const DEFAULT_SOURCE_DEADLINE_MS = 10 * 60_000;
const TERMINATION_GRACE_MS = 5_000;
const MAX_CAPTURED_OUTPUT = 64 * 1024;

export async function runProductUpdateGroup(
  argv = process.argv.slice(2),
  options: RunGroupOptions = {}
) {
  const family = argv.find((value) => !value.startsWith("--"));
  if (!family || !PRODUCT_UPDATE_FAMILIES.includes(family as never)) {
    throw new Error(
      `Usage: npm run ingest:product-updates -- <${PRODUCT_UPDATE_FAMILIES.join("|")}> [--force] [--dry-run]`
    );
  }

  const adapters = productUpdateAdaptersForFamily(family);
  const force = argv.includes("--force");
  const flags = [
    ...(force ? ["--force"] : []),
    ...(argv.includes("--dry-run") ? ["--dry-run"] : [])
  ];
  const now = options.now ?? Date.now;
  const startedAt = now();
  const groupDeadlineMs =
    options.groupDeadlineMs ??
    boundedInteger(
      process.env.PRODUCT_UPDATE_GROUP_DEADLINE_MS,
      DEFAULT_GROUP_DEADLINE_MS,
      10_000,
      60 * 60_000
    );
  const sourceDeadlineMs =
    options.sourceDeadlineMs ??
    boundedInteger(
      process.env.PRODUCT_UPDATE_SOURCE_DEADLINE_MS,
      DEFAULT_SOURCE_DEADLINE_MS,
      10_000,
      30 * 60_000
    );
  const concurrency =
    options.concurrency ??
    boundedInteger(
      process.env.PRODUCT_UPDATE_GROUP_CONCURRENCY,
      DEFAULT_CONCURRENCY,
      1,
      4
    );
  const runSource = options.runSource ?? runSourceProcess;
  const sourceAllowlist = new Set(
    (process.env.PRODUCT_UPDATE_SOURCES ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
  const ingestionEnabled =
    force || process.env.PRODUCT_UPDATE_INGEST_ENABLED === "true";
  const summary = new Array<GroupSummaryEntry>(adapters.length);
  let cursor = 0;

  const worker = async () => {
    while (cursor < adapters.length) {
      const index = cursor;
      cursor += 1;
      const adapter = adapters[index];
      const sourceKey = adapter.manifest.sourceKey;

      if (!ingestionEnabled || (!force && !sourceAllowlist.has(sourceKey))) {
        summary[index] = {
          sourceKey,
          ok: true,
          status: "skipped-disabled"
        };
        continue;
      }

      const remainingMs = groupDeadlineMs - (now() - startedAt);
      if (remainingMs < 1_000) {
        summary[index] = {
          sourceKey,
          ok: true,
          status: "skipped-budget",
          error: "Group execution budget was exhausted before this source started"
        };
        continue;
      }

      try {
        const processResult = await runSource(
          sourceKey,
          flags,
          Math.min(sourceDeadlineMs, remainingMs)
        );
        summary[index] = {
          sourceKey,
          ok: processResult.ok,
          status: processResult.ok ? "success" : "failed",
          exitCode: processResult.exitCode,
          timedOut: processResult.timedOut,
          durationMs: processResult.durationMs,
          ...(processResult.output === undefined
            ? {}
            : { output: processResult.output }),
          ...(processResult.error ? { error: processResult.error } : {})
        };
      } catch (error) {
        summary[index] = {
          sourceKey,
          ok: false,
          status: "failed",
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, Math.max(adapters.length, 1)) },
      () => worker()
    )
  );

  console.log(
    JSON.stringify({
      event: "product_update_group_complete",
      family,
      durationMs: now() - startedAt,
      summary
    })
  );
  if (summary.some((source) => !source.ok)) process.exitCode = 1;
  return summary;
}

async function runSourceProcess(
  sourceKey: string,
  flags: string[],
  deadlineMs: number
): Promise<SourceProcessResult> {
  const startedAt = Date.now();
  const script = fileURLToPath(new URL("./poll-product-update.ts", import.meta.url));
  const child = spawn(
    process.execPath,
    ["--import", "tsx", script, sourceKey, ...flags],
    {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32"
    }
  );
  let stdout = "";
  let stderr = "";
  let timedOut = false;
  const append = (current: string, chunk: Buffer | string) =>
    `${current}${chunk.toString()}`.slice(-MAX_CAPTURED_OUTPUT);
  child.stdout?.on("data", (chunk) => {
    stdout = append(stdout, chunk);
  });
  child.stderr?.on("data", (chunk) => {
    stderr = append(stderr, chunk);
  });

  const timeout = setTimeout(() => {
    timedOut = true;
    terminateProcessGroup(child.pid, "SIGTERM");
    const killTimer = setTimeout(
      () => terminateProcessGroup(child.pid, "SIGKILL"),
      TERMINATION_GRACE_MS
    );
    killTimer.unref();
  }, deadlineMs);
  timeout.unref();

  return await new Promise<SourceProcessResult>((resolve) => {
    child.once("error", (error) => {
      clearTimeout(timeout);
      resolve({
        ok: false,
        exitCode: null,
        signal: null,
        timedOut,
        durationMs: Date.now() - startedAt,
        error: error.message
      });
    });
    child.once("close", (exitCode, signal) => {
      clearTimeout(timeout);
      const output = parseStructuredOutput(stdout);
      const errorText = normalizeChildError(stderr || stdout);
      resolve({
        ok: exitCode === 0 && !timedOut,
        exitCode,
        signal,
        timedOut,
        durationMs: Date.now() - startedAt,
        ...(output === undefined ? {} : { output }),
        ...(exitCode === 0 && !timedOut
          ? {}
          : {
              error: timedOut
                ? `Source exceeded its ${deadlineMs}ms hard deadline`
                : errorText || `Source process exited with code ${exitCode}`
            })
      });
    });
  });
}

function terminateProcessGroup(
  pid: number | undefined,
  signal: NodeJS.Signals
) {
  if (!pid) return;
  try {
    process.kill(process.platform === "win32" ? pid : -pid, signal);
  } catch {
    // The child may have exited between the deadline and signal delivery.
  }
}

function parseStructuredOutput(stdout: string) {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      return JSON.parse(lines[index]) as unknown;
    } catch {
      // Keep looking for the final structured line.
    }
  }
  return undefined;
}

function normalizeChildError(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 2_000);
}

function boundedInteger(
  raw: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number
) {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(Math.max(parsed, minimum), maximum);
}

async function main() {
  try {
    await runProductUpdateGroup();
  } finally {
    await getPool().end().catch(() => undefined);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
