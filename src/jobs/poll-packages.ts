import { pathToFileURL } from "node:url";
import { scheduledJobMain } from "../lib/ingest/job-health";
import { fetchText } from "../lib/ingest/fetch";
import { normalizePackageForStorage } from "../lib/ingest/packages";
import {
  UNITY_OFFICIAL_PACKAGES,
  UNITY_REGISTRY_WATCHLIST_PACKAGES
} from "../lib/ingest/unity-packages";
import { recordSourceSnapshot, upsertPackageBundle, withIngestionTransaction } from "../lib/db/repositories";
import { parsePackageRegistry } from "../lib/parsers/package-registry";
import { PACKAGE_REGISTRY_PARSER_VERSION } from "../lib/ingest/parser-versions";

const PARSER_VERSION =
  process.env.PARSER_VERSION ?? PACKAGE_REGISTRY_PARSER_VERSION;

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

  const payload: unknown = JSON.parse(fetched.text);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error(`Invalid registry payload for ${packageName}`);
  const registry = payload as Record<string, unknown>;
  if (registry.name !== packageName || !registry.versions || typeof registry.versions !== "object" ||
      Array.isArray(registry.versions) || Object.keys(registry.versions).length === 0 ||
      Object.values(registry.versions).some(version => !version || typeof version !== "object" || Array.isArray(version))) {
    throw new Error(`Invalid registry name or versions for ${packageName}`);
  }
  const parsed = parsePackageRegistry(registry);

  await withIngestionTransaction("package_registry", "poll-packages", async (client, runId) => {
    const sourceSnapshotId = await recordSourceSnapshot(client, "package_registry", fetched);
    await upsertPackageBundle(
      client,
      normalizePackageForStorage({
        parsedPackage: parsed,
        sourceUrl,
        sourceSnapshotId,
        ingestionRunId: runId,
        parserVersion: PARSER_VERSION
      })
    );
    console.log(
      JSON.stringify({
        package: parsed.name,
        versions: parsed.versions.length,
        latest: parsed.distTags.latest ?? null
      })
    );
  }, PARSER_VERSION);
  return "ingested";
}

export async function main() {
  const packages = (
    process.env.PACKAGE_ALLOWLIST?.split(",") ?? [
      ...UNITY_OFFICIAL_PACKAGES,
      ...UNITY_REGISTRY_WATCHLIST_PACKAGES
    ]
  )
    .map((item) => item.trim())
    .filter(Boolean);

  if (packages.length === 0) throw new Error("Package ingestion has no configured targets");
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
  if (counts.error > 0) throw new Error(`Package ingestion failed for ${counts.error} packages`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void scheduledJobMain("poll-packages", main);
}
