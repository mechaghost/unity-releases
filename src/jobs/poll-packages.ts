import { fetchText } from "../lib/ingest/fetch";
import { normalizePackageForStorage } from "../lib/ingest/packages";
import { recordSourceSnapshot, upsertPackageBundle, withIngestionTransaction } from "../lib/db/repositories";
import { parsePackageRegistry } from "../lib/parsers/package-registry";

const DEFAULT_PACKAGES = [
  "com.unity.inputsystem",
  "com.unity.addressables",
  "com.unity.render-pipelines.universal",
  "com.unity.render-pipelines.high-definition",
  "com.unity.cinemachine",
  "com.unity.burst"
];

async function main() {
  const packages = (process.env.PACKAGE_ALLOWLIST?.split(",") ?? DEFAULT_PACKAGES).map((item) =>
    item.trim()
  );

  for (const packageName of packages.filter(Boolean)) {
    await withIngestionTransaction("package_registry", "poll-packages", async (client, runId) => {
      const sourceUrl = `https://packages.unity.com/${packageName}`;
      const fetched = await fetchText(sourceUrl);
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
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
