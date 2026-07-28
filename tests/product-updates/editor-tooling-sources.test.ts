import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { parseUnityCliReleaseNotes, unityCliAdapter } from "../../src/lib/product-updates/sources/unity-cli";
import { parseUnityHubReleaseNotes, unityHubAdapter } from "../../src/lib/product-updates/sources/unity-hub";
import { parseUnityDate } from "../../src/lib/product-updates/sources/html";
import type { ProductUpdateSnapshot } from "../../src/lib/product-updates/types";
import { validateObservations } from "../../src/lib/product-updates/validation";

const hubHtml = readFileSync(
  new URL("../fixtures/product-updates/unity-hub.html", import.meta.url),
  "utf8"
);
const cliHtml = readFileSync(
  new URL("../fixtures/product-updates/unity-cli.html", import.meta.url),
  "utf8"
);

describe("Editor tooling Product Update adapters", () => {
  test("parses Hub versions, nested sections, dates, and platforms", () => {
    const observations = parseUnityHubReleaseNotes(
      snapshot(
        "unity-hub",
        "all-channels",
        "https://unity.com/unity-hub/release-notes",
        hubHtml
      )
    );
    expect(observations).toHaveLength(2);
    expect(observations[0]).toMatchObject({
      productKey: "unity-hub",
      version: "3.19.5",
      channel: "production",
      releaseDate: "2026-07-10T00:00:00.000Z",
      updateSlug: "3.19.5"
    });
    expect(observations[0].items[0]).toMatchObject({
      section: "Bug fixes and improvements",
      changeKind: "fix"
    });
    expect(observations[0].items[1].platforms).toContain("Windows");
    expect(observations[1].items.map((item) => item.section)).toEqual([
      "Projects",
      "Installs"
    ]);
    expect(new Set(observations[1].items.map((item) => item.itemKey)).size).toBe(
      observations[1].items.length
    );
    expect(() =>
      validateObservations(
        observations,
        { ...unityHubAdapter.manifest, minimumExpectedRecords: 1 },
        null
      )
    ).not.toThrow();
  });

  test("parses CLI date/version pairs and preserves inline commands", () => {
    const observations = parseUnityCliReleaseNotes(
      snapshot(
        "unity-cli",
        "standalone",
        "https://docs.unity.com/en-us/unity-cli/release-notes",
        cliHtml
      )
    );
    expect(observations).toHaveLength(2);
    expect(observations[0]).toMatchObject({
      productKey: "unity-cli",
      version: "0.1.0-beta.7",
      channel: "beta",
      releaseDate: "2026-06-16T00:00:00.000Z",
      summary: "Focused licensing, project, and testing workflows."
    });
    expect(observations[0].items[0]).toMatchObject({
      section: "Licensing",
      changeKind: "feature"
    });
    expect(observations[0].items[0].body).toContain("`unity license status`");
    expect(observations[0].items[1]).toMatchObject({
      section: "Issues fixed",
      changeKind: "fix",
      platforms: ["Windows"]
    });
    expect(() =>
      validateObservations(
        observations,
        unityCliAdapter.manifest,
        null
      )
    ).not.toThrow();
  });

  test("accepts Unity's abbreviated and ordinal date variants", () => {
    expect(parseUnityDate("Sep. 6th, 2023")).toBe(
      "2023-09-06T00:00:00.000Z"
    );
    expect(parseUnityDate("June 04, 2026")).toBe(
      "2026-06-04T00:00:00.000Z"
    );
    expect(parseUnityDate("not a date")).toBeNull();
  });

  test("quarantines documents that lose their expected root", () => {
    expect(() =>
      parseUnityHubReleaseNotes(
        snapshot("unity-hub", "all-channels", "https://unity.com", "<h1>Other</h1>")
      )
    ).toThrow(/root heading/);
    expect(() =>
      parseUnityCliReleaseNotes(
        snapshot("unity-cli", "standalone", "https://docs.unity.com", "<h1>Other</h1>")
      )
    ).toThrow(/root heading/);
  });
});

function snapshot(
  sourceKey: string,
  targetKey: string,
  finalUrl: string,
  text: string
): ProductUpdateSnapshot {
  return {
    sourceKey,
    targetKey,
    requestedUrl: finalUrl,
    finalUrl,
    fetchedAt: "2026-07-28T00:00:00.000Z",
    status: 200,
    etag: null,
    lastModified: null,
    sha256: "fixture",
    text
  };
}
