import { createStableGuid, sha256 } from "./hash";
import type { ParsedPackageRegistry } from "../parsers/package-registry";

export type NormalizePackageInput = {
  parsedPackage: ParsedPackageRegistry;
  sourceUrl: string;
  sourceSnapshotId: number;
  ingestionRunId: number;
  parserVersion: string;
};

export function normalizePackageForStorage(input: NormalizePackageInput) {
  const packageRecord = {
    name: input.parsedPackage.name,
    displayName: input.parsedPackage.displayName,
    description: input.parsedPackage.description,
    documentationUrl: input.parsedPackage.documentationUrl,
    keywords: [],
    sourceUrl: input.sourceUrl,
    sourceSnapshotId: input.sourceSnapshotId,
    ingestionRunId: input.ingestionRunId
  };

  const versions = input.parsedPackage.versions.map((version) => ({
    packageName: input.parsedPackage.name,
    version: version.version,
    publishedAt: version.publishedAt,
    unityCompatibility: version.unityCompatibility,
    unityMinVersion: version.unityMinVersion,
    unityMaxVersion: null,
    isPrerelease: version.isPrerelease,
    changelog: version.changelog,
    dependenciesJson: version.dependencies,
    distTagsJson: version.distTags,
    tarballUrl: version.tarballUrl,
    shasum: version.shasum,
    rawMetadataJson: version.raw,
    sourceSnapshotId: input.sourceSnapshotId,
    ingestionRunId: input.ingestionRunId,
    parserVersion: input.parserVersion,
    normalizedSha256: sha256(version)
  }));

  const events = versions.map((version) => ({
    eventType: "package_version",
    title: `${input.parsedPackage.name} ${version.version}`,
    summary: version.changelog ?? `New version ${version.version}`,
    eventTime: version.publishedAt,
    sourceUrl: input.sourceUrl,
    stableGuid: createStableGuid("package_version", `${input.parsedPackage.name}@${version.version}`),
    tags: [input.parsedPackage.name, version.version]
  }));

  return { packageRecord, versions, events };
}
