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
});
