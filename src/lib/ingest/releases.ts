import { sha256, createStableGuid } from "./hash";
import { parseReleaseNotes } from "../parsers/release-notes";
import { parseUnityVersion } from "../parsers/version";
import type { ReleasePageMetadata } from "../parsers/release-page";

export type NormalizeReleaseInput = {
  metadata: ReleasePageMetadata;
  releaseNotesMarkdown: string;
  sourceSnapshotId: number;
  ingestionRunId: number;
  parserVersion: string;
};

export function normalizeReleaseForStorage(input: NormalizeReleaseInput) {
  const parsedVersion = parseUnityVersion(input.metadata.version);
  const parsedNotes = parseReleaseNotes(input.releaseNotesMarkdown, {
    version: input.metadata.version,
    sourceUrl: input.metadata.releasePageUrl
  });
  const normalizedSha256 = sha256({
    metadata: input.metadata,
    releaseNotesMarkdown: input.releaseNotesMarkdown
  });

  const release = {
    version: input.metadata.version,
    majorLine: parsedVersion.majorLine,
    minorLine: parsedVersion.minorLine,
    patch: parsedVersion.patch,
    suffixChannel: parsedVersion.suffixChannel,
    suffixNumber: parsedVersion.suffixNumber,
    stream: input.metadata.stream,
    releaseDate: input.metadata.releaseDate,
    changeset: input.metadata.changeset,
    shortRevision: input.metadata.shortRevision,
    releasePageUrl: input.metadata.releasePageUrl,
    releaseNotesUrl: input.metadata.releaseNotesUrl,
    unityHubDeepLink: input.metadata.unityHubDeepLink,
    rawMetadataJson: input.metadata,
    sourceSnapshotId: input.sourceSnapshotId,
    ingestionRunId: input.ingestionRunId,
    parserVersion: input.parserVersion,
    normalizedSha256
  };

  const noteItems = parsedNotes.items.map((item) => ({
    ...item,
    majorLine: parsedVersion.majorLine,
    minorLine: parsedVersion.minorLine,
    stream: input.metadata.stream,
    releaseDate: input.metadata.releaseDate,
    sourceSnapshotId: input.sourceSnapshotId,
    ingestionRunId: input.ingestionRunId,
    parserVersion: input.parserVersion,
    normalizedSha256: sha256(item)
  }));

  const sections = parsedNotes.sections.map((section) => ({
    ...section,
    sourceSnapshotId: input.sourceSnapshotId,
    ingestionRunId: input.ingestionRunId
  }));

  const packageChanges = parsedNotes.packageChanges.map((change) => ({
    ...change,
    editorVersion: input.metadata.version,
    sourceSnapshotId: input.sourceSnapshotId,
    ingestionRunId: input.ingestionRunId
  }));

  return {
    release,
    sections,
    noteItems,
    packageChanges,
    artifacts: input.metadata.artifacts,
    modules: input.metadata.modules,
    event: {
      eventType: "unity_release",
      title: `Unity ${input.metadata.version}`,
      summary: `${input.metadata.version} release notes and known issues`,
      eventTime: input.metadata.releaseDate,
      sourceUrl: input.metadata.releasePageUrl,
      stableGuid: createStableGuid("unity_release", input.metadata.version),
      tags: [parsedVersion.majorLine, parsedVersion.minorLine, input.metadata.stream]
    }
  };
}
