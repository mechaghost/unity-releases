import { describe, expect, test } from "vitest";
import { sha256 } from "../../src/lib/ingest/hash";
import { reclassifyStoredReleaseNote } from "../../src/lib/ingest/reclassification";

const note = {
  version: "6000.3.14f1",
  section: "Fixes",
  area: "Accessibility",
  platforms: [] as string[],
  impactKind: "fix",
  riskLevel: "info",
  riskReasons: ["section:Fixes", "impact:fix"],
  body: "Fixed a potential crash when using the Accessibility APIs.",
  issueIds: ["UUM-132644"],
  issueLinks: [] as Array<{ id: string; url: string }>,
  packageNames: [] as string[],
  sourceUrl: "https://unity.com/releases/editor/whats-new/6000.3.14f1",
  sourceOrder: 24,
  normalizedSha256: "stale"
};

describe("release-note reclassification", () => {
  test("updates every classification-dependent field and its content hash", () => {
    const result = reclassifyStoredReleaseNote(note);

    expect(result).toEqual({
      impactKind: "fix",
      riskLevel: "review",
      riskReasons: ["section:Fixes", "impact:fix"],
      normalizedSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      changed: true
    });
    expect(result.normalizedSha256).toBe(
      sha256({
        version: note.version,
        section: note.section,
        area: note.area,
        platforms: note.platforms,
        impactKind: "fix",
        riskLevel: "review",
        riskReasons: result.riskReasons,
        body: note.body,
        issueIds: note.issueIds,
        issueLinks: note.issueLinks,
        packageNames: note.packageNames,
        sourceUrl: note.sourceUrl,
        sourceOrder: note.sourceOrder
      })
    );
  });

  test("repairs a stale hash even when the classification is unchanged", () => {
    const first = reclassifyStoredReleaseNote({
      ...note,
      riskLevel: "review"
    });
    const second = reclassifyStoredReleaseNote({
      ...note,
      riskLevel: first.riskLevel,
      riskReasons: first.riskReasons,
      normalizedSha256: first.normalizedSha256
    });

    expect(first.changed).toBe(true);
    expect(second.changed).toBe(false);
    expect(second).toEqual({ ...first, changed: false });
  });

  test("rebuilds platform-aware reasons deterministically", () => {
    const result = reclassifyStoredReleaseNote({
      ...note,
      section: "Known Issues",
      platforms: ["Android", "iOS"],
      impactKind: "known_issue",
      riskLevel: "caution",
      riskReasons: []
    });

    expect(result.riskReasons).toEqual([
      "section:Known Issues",
      "impact:known_issue",
      "platform:Android",
      "platform:iOS"
    ]);
    expect(
      reclassifyStoredReleaseNote({
        ...note,
        section: "Known Issues",
        platforms: ["Android", "iOS"],
        impactKind: result.impactKind,
        riskLevel: result.riskLevel,
        riskReasons: result.riskReasons,
        normalizedSha256: result.normalizedSha256
      })
    ).toEqual({ ...result, changed: false });
  });

  test("reconstructs the stripped area prefix before classifying", () => {
    const result = reclassifyStoredReleaseNote({
      ...note,
      section: "Features",
      area: "Licensing",
      impactKind: "feature",
      riskLevel: "info",
      body: "Added offline activation support."
    });

    expect(result).toMatchObject({
      impactKind: "install_risk",
      riskLevel: "review",
      riskReasons: ["section:Features", "impact:install_risk"]
    });
  });
});
