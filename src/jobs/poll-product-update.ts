import { pathToFileURL } from "node:url";
import { getPool } from "../lib/db/client";
import { runProductUpdateAdapter } from "../lib/product-updates/runner";
import { findProductUpdateAdapter } from "../lib/product-updates/sources";

export async function runProductUpdateJob(argv = process.argv.slice(2)) {
  const sourceKey = argv.find((value) => !value.startsWith("--"));
  if (!sourceKey) {
    throw new Error(
      "Usage: npm run ingest:product-update -- <source-key> [--target=<key>] [--force] [--dry-run]"
    );
  }
  const adapter = findProductUpdateAdapter(sourceKey);
  if (!adapter) throw new Error(`Unknown Product Updates source: ${sourceKey}`);
  const target = argv
    .find((value) => value.startsWith("--target="))
    ?.slice("--target=".length);
  const results = await runProductUpdateAdapter(adapter, {
    targetKey: target || undefined,
    force: argv.includes("--force"),
    dryRun: argv.includes("--dry-run")
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
