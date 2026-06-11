import { describe, expect, test } from "vitest";
import { parseReleaseNotes } from "../../src/lib/parsers/release-notes";

const SAMPLE_NOTES = `### Known Issues in 6000.3.14f1

- 6000.3.0a5: URP Decals become invisible when over 1000 units away from the camera
    ([UUM-138945](https://issuetracker.unity3d.com/issues/urp-decals-become-invisible))

- WebGL: Detached AudioSource is not released from browser memory
    ([UUM-136929](https://issuetracker.unity3d.com/issues/detached-audio-source))

### 6000.3.14f1 Release Notes

#### Features

- UI Toolkit: Introduced a UXML upgrade framework for applying automated UXML upgrades.

#### API Changes

- Editor: Changed: Expose JobHandle.GetHashCode and Equals operators.

#### Fixes

- Graphics: Preventive JPEG decoder measure for LJT-01-003 vulnerability. ([UUM-129186](https://issuetracker.unity3d.com/issues/jpeg-decoder))

#### Package changes in 6000.3.14f1

- com.unity.recorder: 5.1.5 to 5.1.6
`;

describe("parseReleaseNotes", () => {
  test("parses release-note sections into searchable items", () => {
    const parsed = parseReleaseNotes(SAMPLE_NOTES, {
      version: "6000.3.14f1",
      sourceUrl: "https://unity.com/releases/editor/whats-new/6000.3.14f1"
    });

    expect(parsed.items).toHaveLength(6);
    expect(parsed.sections.map((section) => section.section)).toEqual([
      "Known Issues",
      "Features",
      "API Changes",
      "Fixes",
      "Package Changes"
    ]);
  });

  test("extracts area, issue IDs, issue links, platforms, and package names", () => {
    const parsed = parseReleaseNotes(SAMPLE_NOTES, {
      version: "6000.3.14f1",
      sourceUrl: "https://unity.com/releases/editor/whats-new/6000.3.14f1"
    });

    const webgl = parsed.items.find((item) => item.issueIds.includes("UUM-136929"));
    const packageChange = parsed.items.find((item) => item.section === "Package Changes");

    expect(webgl).toMatchObject({
      area: "WebGL",
      platforms: ["WebGL"],
      impactKind: "known_issue",
      riskLevel: "caution"
    });
    expect(webgl?.issueLinks[0]).toEqual({
      id: "UUM-136929",
      url: "https://issuetracker.unity3d.com/issues/detached-audio-source"
    });
    expect(packageChange?.packageNames).toEqual(["com.unity.recorder"]);
  });

  test("classifies API changes and security-related fixes", () => {
    const parsed = parseReleaseNotes(SAMPLE_NOTES, {
      version: "6000.3.14f1",
      sourceUrl: "https://unity.com/releases/editor/whats-new/6000.3.14f1"
    });

    const apiChange = parsed.items.find((item) => item.section === "API Changes");
    const jpegFix = parsed.items.find((item) => item.issueIds.includes("UUM-129186"));

    expect(apiChange).toMatchObject({
      impactKind: "api_change",
      riskLevel: "review"
    });
    expect(jpegFix).toMatchObject({
      area: "Graphics",
      impactKind: "security_related_fix",
      riskLevel: "review"
    });
  });

  test("extracts package version changes from bare 'Package changes' bullets", () => {
    const parsed = parseReleaseNotes(SAMPLE_NOTES, {
      version: "6000.3.14f1",
      sourceUrl: "https://unity.com/releases/editor/whats-new/6000.3.14f1"
    });

    expect(parsed.packageChanges).toContainEqual({
      packageName: "com.unity.recorder",
      fromVersion: "5.1.5",
      toVersion: "5.1.6",
      changeKind: "updated"
    });
  });

  test("extracts full versions from the linked 'Packages updated' form", () => {
    // The real GCS notes format: `- pkg: [from](url@maj.min) to [to](url)`.
    // The full version lives in the link text; the @maj.min in the URL is
    // truncated and must be ignored.
    const notes = `### 6000.0.23f1 Release Notes

#### Package changes in 6000.0.23f1

#### Packages updated

- com.unity.render-pipelines.universal: [16.0.3](https://docs.unity3d.com/Packages/com.unity.render-pipelines.universal@16.0//changelog/CHANGELOG.html) to [17.0.3](https://docs.unity3d.com/Packages/com.unity.render-pipelines.universal@17.0//changelog/CHANGELOG.html)

- com.unity.collections: [1.2.4](https://docs.unity3d.com/Packages/com.unity.collections@1.2//changelog/CHANGELOG.html) to [2.5.1](https://docs.unity3d.com/Packages/com.unity.collections@2.5//changelog/CHANGELOG.html)
`;
    const parsed = parseReleaseNotes(notes, {
      version: "6000.0.23f1",
      sourceUrl: "https://unity.com/releases/editor/whats-new/6000.0.23f1"
    });

    expect(parsed.packageChanges).toEqual([
      {
        packageName: "com.unity.render-pipelines.universal",
        fromVersion: "16.0.3",
        toVersion: "17.0.3",
        changeKind: "updated"
      },
      {
        packageName: "com.unity.collections",
        fromVersion: "1.2.4",
        toVersion: "2.5.1",
        changeKind: "updated"
      }
    ]);
  });

  test("collapses duplicate 'Packages updated' blocks to one change per package", () => {
    const notes = `### Final 6000.0.23f1 Package changes

#### Packages updated

- com.unity.splines: [2.6.1](https://docs.unity3d.com/Packages/com.unity.splines@2.6//changelog/CHANGELOG.html) to [2.7.2](https://docs.unity3d.com/Packages/com.unity.splines@2.7//changelog/CHANGELOG.html)

### Package changes in 6000.0.23f1

#### Packages updated

- com.unity.splines: [2.6.1](https://docs.unity3d.com/Packages/com.unity.splines@2.6//changelog/CHANGELOG.html) to [2.7.2](https://docs.unity3d.com/Packages/com.unity.splines@2.7//changelog/CHANGELOG.html)
`;
    const parsed = parseReleaseNotes(notes, {
      version: "6000.0.23f1",
      sourceUrl: "https://unity.com/releases/editor/whats-new/6000.0.23f1"
    });

    const splines = parsed.packageChanges.filter(
      (change) => change.packageName === "com.unity.splines"
    );
    expect(splines).toHaveLength(1);
    expect(splines[0].toVersion).toBe("2.7.2");
  });
});
