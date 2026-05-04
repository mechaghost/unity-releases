import { fetchText } from "../lib/ingest/fetch";
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
    const fetched = await fetchText(`https://packages.unity.com/${packageName}`);
    const parsed = parsePackageRegistry(JSON.parse(fetched.text));
    console.log(
      JSON.stringify({
        package: parsed.name,
        versions: parsed.versions.length,
        latest: parsed.distTags.latest ?? null
      })
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
