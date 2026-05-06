import { describe, expect, test } from "vitest";
import { normalizeReleaseForStorage } from "../../src/lib/ingest/releases";
import { normalizePackageForStorage } from "../../src/lib/ingest/packages";
import { createStableGuid, sha256 } from "../../src/lib/ingest/hash";

describe("ingestion hashing", () => {
  test("creates deterministic hashes and stable event GUIDs", () => {
    expect(sha256("Unity 6")).toHaveLength(64);
    expect(createStableGuid("release", "6000.3.14f1")).toBe(createStableGuid("release", "6000.3.14f1"));
    expect(createStableGuid("release", "6000.3.14f1")).not.toBe(
      createStableGuid("release", "6000.3.15f1")
    );
  });
});

describe("release normalization", () => {
  test("normalizes release metadata and note items for storage", () => {
    const normalized = normalizeReleaseForStorage({
      metadata: {
        version: "6000.3.14f1",
        releaseDate: "2026-04-22T12:21:09.823Z",
        stream: "Update/Supported",
        shortRevision: "d68c3f99a318",
        changeset: "d68c3f99a318",
        releasePageUrl: "https://unity.com/releases/editor/whats-new/6000.3.14f1",
        releaseNotesUrl: "https://storage.googleapis.com/release.md",
        unityHubDeepLink: "unityhub://6000.3.14f1/d68c3f99a318",
        artifacts: [],
        modules: []
      },
      releaseNotesMarkdown:
        "### 6000.3.14f1 Release Notes\n\n#### Fixes\n\n- WebGL: Fixed memory leak. ([UUM-136929](https://issuetracker.unity3d.com/issues/webgl))",
      sourceSnapshotId: 1,
      ingestionRunId: 2,
      parserVersion: "test-parser"
    });

    expect(normalized.release).toMatchObject({
      version: "6000.3.14f1",
      majorLine: "6000",
      minorLine: "6000.3",
      patch: 14,
      suffixChannel: "f",
      suffixNumber: 1,
      normalizedSha256: expect.any(String)
    });
    expect(normalized.noteItems[0]).toMatchObject({
      version: "6000.3.14f1",
      area: "WebGL",
      issueIds: ["UUM-136929"]
    });
    expect(normalized.event).toMatchObject({
      eventType: "unity_release",
      stableGuid: createStableGuid("unity_release", "6000.3.14f1")
    });
  });
});

describe("package normalization", () => {
  test("normalizes parsed package metadata into events", () => {
    const normalized = normalizePackageForStorage({
      parsedPackage: {
        name: "com.unity.inputsystem",
        displayName: "Input System",
        description: null,
        documentationUrl: null,
        distTags: { latest: "1.19.0" },
        versions: [
          {
            version: "1.19.0",
            displayName: "Input System",
            publishedAt: "2026-02-24T05:48:23.303Z",
            unityCompatibility: "2022.3",
            unityMinVersion: "2022.3",
            changelog: "Fixed cursor.",
            dependencies: {},
            distTags: { latest: "1.19.0" },
            tarballUrl: null,
            shasum: null,
            isPrerelease: false,
            raw: {}
          }
        ],
        raw: {}
      },
      sourceUrl: "https://packages.unity.com/com.unity.inputsystem",
      sourceSnapshotId: 1,
      ingestionRunId: 2,
      parserVersion: "test-parser"
    });

    expect(normalized.packageRecord.name).toBe("com.unity.inputsystem");
    expect(normalized.versions[0]).toMatchObject({
      version: "1.19.0",
      normalizedSha256: expect.any(String)
    });
    expect(normalized.events[0]).toMatchObject({
      eventType: "package_version",
      stableGuid: createStableGuid("package_version", "com.unity.inputsystem@1.19.0")
    });
  });
});

