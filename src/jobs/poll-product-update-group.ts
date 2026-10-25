import { cronShutdown, runSupervisedProcess } from "../lib/ingest/supervised-process";
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
  status: "success" | "failed" | "skipped-disabled" | "skipped-budget" | "cancelled";
  exitCode?: number | null;
  timedOut?: boolean;
  durationMs?: number;
  output?: unknown;
  error?: string;
};

type RunGroupOptions = {
  signal?: AbortSignal;
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
  const groupDeadlineMs = boundedInteger(
    options.groupDeadlineMs?.toString() ??
      process.env.PRODUCT_UPDATE_GROUP_DEADLINE_MS,
    DEFAULT_GROUP_DEADLINE_MS,
    10_000,
    60 * 60_000
  );
  const sourceDeadlineMs = boundedInteger(
    options.sourceDeadlineMs?.toString() ??
      process.env.PRODUCT_UPDATE_SOURCE_DEADLINE_MS,
    DEFAULT_SOURCE_DEADLINE_MS,
    10_000,
    30 * 60_000
  );
  const concurrency = boundedInteger(
    options.concurrency?.toString() ??
      process.env.PRODUCT_UPDATE_GROUP_CONCURRENCY,
    DEFAULT_CONCURRENCY,
    1,
    4
  );
  const runSource = options.runSource ?? ((key, flags, deadline) => runSourceProcess(key, flags, deadline, { signal: options.signal }));
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
    while (cursor < adapters.length && !options.signal?.aborted) {
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
          ok: false,
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

  if (options.signal?.aborted) {
    for (let index = 0; index < adapters.length; index++) {
      summary[index] ??= {
        sourceKey: adapters[index].manifest.sourceKey,
        ok: false,
        status: "cancelled",
        error: "Group stopped before this source started"
      };
    }
  }

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

export async function runSourceProcess(
  sourceKey: string,
  flags: string[],
  deadlineMs: number,
  testOptions: {
    nodeArgs?: string[];
    terminationGraceMs?: number;
    signal?: AbortSignal;
  } = {}
): Promise<SourceProcessResult> {
  const startedAt = Date.now();
  const script = fileURLToPath(new URL("./poll-product-update.ts", import.meta.url));
  const result = await runSupervisedProcess(
    process.execPath,
    testOptions.nodeArgs ?? ["--import", "tsx", script, sourceKey, ...flags],
    { timeoutMs: deadlineMs, graceMs: testOptions.terminationGraceMs ?? TERMINATION_GRACE_MS, signal: testOptions.signal }
  );
  const ok = result.exitCode === 0 && !result.timedOut && !result.cancelled;
  const output = parseStructuredOutput(result.stdout);
  return {
    ok, exitCode: result.exitCode, signal: result.signal, timedOut: result.timedOut,
    durationMs: Date.now() - startedAt,
    ...(output === undefined ? {} : { output }),
    ...(ok ? {} : { error: result.cancelled ? "Source cancelled during shutdown"
      : result.timedOut ? `Source exceeded its ${deadlineMs}ms hard deadline`
      : normalizeChildError(result.stderr || result.stdout) || `Source process exited with code ${result.exitCode}` })
  };
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
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(Math.max(parsed, minimum), maximum);
}

async function main() {
  const shutdown = cronShutdown();
  try {
    await runProductUpdateGroup(process.argv.slice(2), { signal: shutdown.signal });
  } finally {
    shutdown.dispose();
    await getPool().end().catch(() => undefined);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
