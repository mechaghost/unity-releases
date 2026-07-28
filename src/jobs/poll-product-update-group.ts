import { pathToFileURL } from "node:url";
import { getPool } from "../lib/db/client";
import { runProductUpdateAdapter } from "../lib/product-updates/runner";
import { productUpdateAdaptersForFamily } from "../lib/product-updates/sources";
import { PRODUCT_UPDATE_FAMILIES } from "../lib/product-updates/types";

export async function runProductUpdateGroup(argv = process.argv.slice(2)) {
  const family = argv.find((value) => !value.startsWith("--"));
  if (!family || !PRODUCT_UPDATE_FAMILIES.includes(family as never)) {
    throw new Error(
      `Usage: npm run ingest:product-updates -- <${PRODUCT_UPDATE_FAMILIES.join("|")}> [--force] [--dry-run]`
    );
  }
  const adapters = productUpdateAdaptersForFamily(family);
  const summary: Array<{
    sourceKey: string;
    ok: boolean;
    results?: Awaited<ReturnType<typeof runProductUpdateAdapter>>;
    error?: string;
  }> = [];

  for (const adapter of adapters) {
    try {
      const results = await runProductUpdateAdapter(adapter, {
        force: argv.includes("--force"),
        dryRun: argv.includes("--dry-run")
      });
      summary.push({ sourceKey: adapter.manifest.sourceKey, ok: true, results });
    } catch (error) {
      summary.push({
        sourceKey: adapter.manifest.sourceKey,
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  console.log(
    JSON.stringify({
      event: "product_update_group_complete",
      family,
      summary
    })
  );
  if (summary.some((source) => !source.ok)) process.exitCode = 1;
  return summary;
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
