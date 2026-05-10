import { fetchText } from "../lib/ingest/fetch";
import { normalizePackageForStorage } from "../lib/ingest/packages";
import { UNITY_OFFICIAL_PACKAGES } from "../lib/ingest/unity-packages";
import { recordSourceSnapshot, upsertPackageBundle, withIngestionTransaction } from "../lib/db/repositories";
import { parsePackageRegistry } from "../lib/parsers/package-registry";

async function ingestOne(packageName: string): Promise<"ingested" | "missing" | "error"> {
  const sourceUrl = `https://packages.unity.com/${packageName}`;
  const fetched = await fetchText(sourceUrl);

  // 404s are common - the registry has no listing endpoint, so the
  // hand-curated UNITY_OFFICIAL_PACKAGES list will inevitably reference
  // a few packages that have moved or been retired. Skip without failing
  // the run.
  if (fetched.status === 404) {
    console.log(JSON.stringify({ package: packageName, skipped: "not found (404)" }));
    return "missing";
  }
  if (fetched.status >= 400) {
    console.error(JSON.stringify({ package: packageName, error: `HTTP ${fetched.status}` }));
    return "error";
  }

  await withIngestionTransaction("package_registry", "poll-packages", async (client, runId) => {
    const sourceSnapshotId = await recordSourceSnapshot(client, "package_registry", fetched);
    const parsed = parsePackageRegistry(JSON.parse(fetched.text));
    await upsertPackageBundle(
      client,
      normalizePackageForStorage({
        parsedPackage: parsed,
        sourceUrl,
        sourceSnapshotId,
        ingestionRunId: runId,
        parserVersion: process.env.PARSER_VERSION ?? "2026-05-04"
      })
    );
    console.log(
      JSON.stringify({
        package: parsed.name,
        versions: parsed.versions.length,
        latest: parsed.distTags.latest ?? null
      })
    );
  });
  return "ingested";
}

async function main() {
  const packages = (process.env.PACKAGE_ALLOWLIST?.split(",") ?? UNITY_OFFICIAL_PACKAGES)
    .map((item) => item.trim())
    .filter(Boolean);

  const counts = { ingested: 0, missing: 0, error: 0 };

  for (const packageName of packages) {
    try {
      const outcome = await ingestOne(packageName);
      counts[outcome] += 1;
    } catch (error) {
      counts.error += 1;
      console.error(JSON.stringify({
        package: packageName,
        error: error instanceof Error ? error.message : String(error)
      }));
    }
  }

  console.log(JSON.stringify({ summary: counts }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
