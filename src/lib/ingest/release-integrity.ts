import type { FetchedSource } from "./fetch";
import type { ReleasePageMetadata } from "../parsers/release-page";
import { parseUnityVersion } from "../parsers/version";
import { isModernMajor } from "../unity-generation";
import type { normalizeReleaseForStorage } from "./releases";

export function assertReleaseSourceOk(source: FetchedSource): void {
  if (source.status !== 200 || !source.text.trim()) {
    throw new Error(`Invalid release source ${source.finalUrl}: HTTP ${source.status} or empty body`);
  }
}

/** A URL/version alone is not evidence of a complete modern release document. */
export function assertReleaseMetadataComplete(metadata: ReleasePageMetadata): void {
  if (!isModernMajor(parseUnityVersion(metadata.version).major)) return;
  const validUrl = (url: string) => /^https?:\/\//.test(url);
  if (!metadata.releaseDate || !Number.isFinite(Date.parse(metadata.releaseDate)) ||
      !metadata.changeset || !metadata.releaseNotesUrl ||
      !validUrl(metadata.releaseNotesUrl) || !metadata.artifacts.length ||
      metadata.artifacts.some((artifact) => !validUrl(artifact.url)) ||
      !metadata.modules.length || metadata.modules.some((module) => !validUrl(module.url))) {
    throw new Error(`Incomplete release metadata for ${metadata.version}; retaining stored data`);
  }
}

/** Last guard before replacing any rows, including callers outside poll-editor. */
export function assertReleaseBundleComplete(bundle: ReturnType<typeof normalizeReleaseForStorage>): void {
  assertReleaseMetadataComplete({
    ...bundle.release.rawMetadataJson, artifacts: bundle.artifacts, modules: bundle.modules
  });
  if (isModernMajor(parseUnityVersion(bundle.release.version).major) && !bundle.noteItems.length) {
    throw new Error(`Empty release notes for ${bundle.release.version}; retaining stored data`);
  }
}
