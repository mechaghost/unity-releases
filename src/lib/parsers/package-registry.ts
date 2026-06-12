export type ParsedPackageRegistry = {
  name: string;
  displayName: string | null;
  description: string | null;
  documentationUrl: string | null;
  distTags: Record<string, string>;
  versions: ParsedPackageVersion[];
  raw: unknown;
};

export type ParsedPackageVersion = {
  version: string;
  displayName: string | null;
  publishedAt: string | null;
  unityCompatibility: string | null;
  unityMinVersion: string | null;
  changelog: string | null;
  dependencies: Record<string, string>;
  distTags: Record<string, string>;
  tarballUrl: string | null;
  shasum: string | null;
  isPrerelease: boolean;
  raw: unknown;
};

type RegistryPayload = {
  name?: string;
  displayName?: string;
  description?: string;
  documentationUrl?: string;
  versions?: Record<string, Record<string, unknown>>;
  time?: Record<string, string>;
  "dist-tags"?: Record<string, string>;
};

export function parsePackageRegistry(payload: RegistryPayload): ParsedPackageRegistry {
  const versions = Object.entries(payload.versions ?? {}).map(([version, data]) => {
    const dist = valueAsRecord(data.dist);
    const upm = valueAsRecord(data._upm);
    const dependencies = valueAsStringRecord(data.dependencies);

    return {
      version,
      displayName: valueAsString(data.displayName),
      publishedAt: payload.time?.[version] ?? null,
      unityCompatibility: combineUnityVersion(data.unity, data.unityRelease),
      unityMinVersion: combineUnityVersion(data.unity, data.unityRelease),
      changelog: valueAsString(upm.changelog),
      dependencies,
      distTags: payload["dist-tags"] ?? {},
      tarballUrl: valueAsString(dist.tarball),
      shasum: valueAsString(dist.shasum),
      isPrerelease: /(?:-|\.)(?:pre|preview|exp|alpha|beta|rc|a|b)\b/i.test(version),
      raw: data
    };
  });

  return {
    name: payload.name ?? "",
    displayName: payload.displayName ?? firstDefined(versions.map((version) => version.displayName)),
    description: payload.description ?? null,
    documentationUrl: payload.documentationUrl ?? null,
    distTags: payload["dist-tags"] ?? {},
    versions,
    raw: payload
  };
}

function firstDefined<T>(values: Array<T | null | undefined>): T | null {
  return values.find((value): value is T => value != null) ?? null;
}

// Unity package manifests split the minimum editor version across two
// fields: `unity` is the minor line ("6000.0") and the optional
// `unityRelease` is the patch + suffix ("16f1"). Join them into the exact
// version ("6000.0.16f1") when the patch is present; otherwise the minor
// line is all Unity declares.
function combineUnityVersion(unity: unknown, unityRelease: unknown): string | null {
  const base = valueAsString(unity);
  if (!base) return null;
  const release = valueAsString(unityRelease);
  return release ? `${base}.${release}` : base;
}

function valueAsRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function valueAsString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function valueAsStringRecord(value: unknown): Record<string, string> {
  const record = valueAsRecord(value);
  return Object.fromEntries(
    Object.entries(record).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  );
}
