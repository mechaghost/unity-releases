import { parseUnityVersion } from "./version";
import type { ReleasePageMetadata, ReleaseArtifact, ReleaseModule } from "./release-page";

export type ApiReleaseModule = {
  id?: unknown;
  name?: unknown;
  category?: unknown;
  url?: unknown;
};

export type ApiReleaseDownload = {
  platform?: unknown;
  architecture?: unknown;
  url?: unknown;
  modules?: unknown;
};

export type ApiRelease = {
  version: string;
  releaseDate?: string;
  shortRevision?: string;
  unityHubDeepLink?: string;
  releaseNotes?: { url?: unknown; type?: unknown };
  downloads?: unknown;
};

export type ApiReleasesResponse = {
  offset: number;
  limit: number;
  total: number;
  results: ApiRelease[];
};

export function extractApiReleaseMetadata(release: ApiRelease): ReleasePageMetadata {
  const parsedVersion = parseUnityVersion(release.version);
  const downloads = asArray(release.downloads).map(asRecord);
  const releaseNotesUrl = asString(release.releaseNotes?.url);
  const shortRevision = asString(release.shortRevision);

  return {
    version: release.version,
    releaseDate: release.releaseDate ?? null,
    stream: parsedVersion.stream,
    shortRevision,
    changeset: shortRevision,
    releasePageUrl: `https://unity.com/releases/editor/whats-new/${release.version}`,
    releaseNotesUrl: releaseNotesUrl || null,
    unityHubDeepLink: release.unityHubDeepLink ?? null,
    artifacts: downloads.map<ReleaseArtifact>((download) => ({
      platform: stringField(download, "platform"),
      architecture: stringField(download, "architecture"),
      category: "EDITOR",
      name: "Unity Editor",
      url: stringField(download, "url")
    })),
    modules: downloads.flatMap<ReleaseModule>((download) =>
      asArray(download.modules).map(asRecord).map((module) => ({
        platform: stringField(download, "platform"),
        architecture: stringField(download, "architecture"),
        moduleName: stringField(module, "name"),
        moduleCategory: stringField(module, "category"),
        url: stringField(module, "url")
      }))
    )
  };
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asArray(value: unknown): unknown[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}
