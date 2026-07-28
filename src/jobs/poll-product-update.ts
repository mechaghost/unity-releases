import { pathToFileURL } from "node:url";
import { getPool } from "../lib/db/client";
import { runProductUpdateAdapter } from "../lib/product-updates/runner";
import { findProductUpdateAdapter } from "../lib/product-updates/sources";

export async function runProductUpdateJob(argv = process.argv.slice(2)) {
  const sourceKey =
    argumentValue(argv, "--source") ??
    argv.find((value) => !value.startsWith("--"));
  if (!sourceKey) {
    throw new Error(
      "Usage: npm run ingest:product-update -- [--source] <source-key> [--target=<key>] [--replay=<snapshot-id>] [--force] [--dry-run]"
    );
  }
  const adapter = findProductUpdateAdapter(sourceKey);
  if (!adapter) throw new Error(`Unknown Product Updates source: ${sourceKey}`);
  const target = argumentValue(argv, "--target");
  const replayValue = argumentValue(argv, "--replay");
  const replaySnapshotId = replayValue ? Number(replayValue) : undefined;
  if (
    replayValue &&
    (!Number.isInteger(replaySnapshotId) || (replaySnapshotId ?? 0) <= 0)
  ) {
    throw new Error("--replay must be a positive snapshot id");
  }
  if (
    replaySnapshotId &&
    adapter.manifest.targets.length > 1 &&
    !target
  ) {
    throw new Error("--target is required when replaying a multi-target source");
  }
  const results = await runProductUpdateAdapter(adapter, {
    targetKey: target || undefined,
    force: argv.includes("--force"),
    dryRun: argv.includes("--dry-run"),
    ...(replaySnapshotId ? { replaySnapshotId } : {})
  });
  console.log(
    JSON.stringify({
      event: "product_update_job_complete",
      sourceKey,
      results
    })
  );
  return results;
}

function argumentValue(argv: string[], name: string) {
  const equals = argv.find((value) => value.startsWith(`${name}=`));
  if (equals) return equals.slice(name.length + 1);
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

async function main() {
  try {
    await runProductUpdateJob();
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
