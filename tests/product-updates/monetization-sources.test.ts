import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  levelPlayAndroidAdapter,
  levelPlayIosAdapter,
  levelPlayUnityAdapter
} from "../../src/lib/product-updates/sources/levelplay";
import {
  LEVELPLAY_MEDIATION_ADAPTER_INVENTORY,
  levelPlayMediationAdapterSources
} from "../../src/lib/product-updates/sources/levelplay-mediation-adapters";
import {
  unityAdsAndroidAdapter,
  unityAdsIosAdapter,
  unityAdsUnityAdapter
} from "../../src/lib/product-updates/sources/unity-ads";
import type {
  ProductUpdateAdapter,
  ProductUpdateSnapshot
} from "../../src/lib/product-updates/types";
import { validateObservations } from "../../src/lib/product-updates/validation";

const mediationVersions = JSON.parse(
  readFileSync(
    new URL(
      "../fixtures/product-updates/levelplay-mediation-adapter-versions.json",
      import.meta.url
    ),
    "utf8"
  )
) as Record<string, [string, string]>;

describe("Monetization Product Update adapters", () => {
  test("keeps Unity Ads platform histories separate", () => {
    const fixture = readFixture("unity-ads.html");
    const unity = parse(unityAdsUnityAdapter, fixture);
    const android = parse(unityAdsAndroidAdapter, fixture);
    const ios = parse(unityAdsIosAdapter, fixture);

    expect(unity).toHaveLength(2);
    expect(android).toHaveLength(2);
    expect(ios).toHaveLength(2);
    expect(unity[0]).toMatchObject({
      productKey: "unity-ads-sdk",
      componentKey: "unity",
      version: "4.19.0",
      releaseDate: "2026-06-26T00:00:00.000Z"
    });
    expect(android[0].items[0]).toMatchObject({
      section: "Android SDK",
      platforms: ["Android"]
    });
    expect(ios[1].items[0]).toMatchObject({
      changeKind: "fix",
      platforms: ["iOS"]
    });
    expect(new Set([unity[0].updateSlug, android[0].updateSlug, ios[0].updateSlug]).size)
      .toBe(3);
  });

  test("does not invent an Ads release for a platform Unity omitted", () => {
    const fixture = readFixture("unity-ads.html").replace(
      "<tr><td>Unity</td><td>Updated package metadata.</td></tr>",
      ""
    );
    const unity = parse(unityAdsUnityAdapter, fixture);
    const android = parse(unityAdsAndroidAdapter, fixture);
    expect(unity.map((observation) => observation.version)).toEqual(["4.19.0"]);
    expect(android.map((observation) => observation.version)).toEqual([
      "4.19.0",
      "4.18.1"
    ]);
  });

  test("parses each LevelPlay SDK table using its platform schema", () => {
    const unity = parse(levelPlayUnityAdapter, readFixture("levelplay-unity.html"));
    const android = parse(
      levelPlayAndroidAdapter,
      readFixture("levelplay-android.html")
    );
    const ios = parse(levelPlayIosAdapter, readFixture("levelplay-ios.html"));

    expect(unity[0]).toMatchObject({
      productKey: "unity-levelplay",
      componentKey: "unity",
      version: "9.5.0",
      releaseDate: "2026-07-01T00:00:00.000Z"
    });
    expect(android[1]).toMatchObject({
      componentKey: "android",
      version: "9.4.4",
      releaseDate: "2026-06-17T00:00:00.000Z"
    });
    expect(ios[1]).toMatchObject({
      componentKey: "ios",
      version: "9.4.2",
      releaseDate: "2026-06-22T00:00:00.000Z"
    });
  });

  test("pins every current mediation changelog to an explicit source", () => {
    expect(LEVELPLAY_MEDIATION_ADAPTER_INVENTORY).toHaveLength(26);
    expect(levelPlayMediationAdapterSources).toHaveLength(51);

    const sourceKeys = levelPlayMediationAdapterSources.map(
      (adapter) => adapter.manifest.sourceKey
    );
    const targetUrls = levelPlayMediationAdapterSources.map(
      (adapter) => adapter.manifest.targets[0].url
    );
    expect(new Set(sourceKeys).size).toBe(sourceKeys.length);
    expect(new Set(targetUrls).size).toBe(targetUrls.length);
    expect(Object.keys(mediationVersions).sort()).toEqual([...sourceKeys].sort());
    expect(sourceKeys).not.toContain("levelplay-adapter-tencent-android");

    for (const adapter of levelPlayMediationAdapterSources) {
      expect(adapter.manifest.targets).toHaveLength(1);
      expect(adapter.manifest.targets[0].allowedHosts).toEqual([
        "raw.githubusercontent.com"
      ]);
      expect(adapter.manifest.sourceKey).not.toContain("*");
    }
  });

  test("replays a representative fixture for every mediation page", () => {
    for (const adapter of levelPlayMediationAdapterSources) {
      const versions = mediationVersions[adapter.manifest.sourceKey];
      const markdown = [
        "# Changelog",
        "",
        `## Version ${versions[0]}`,
        `* Fixed current integration behavior for ${adapter.manifest.displayName}.`,
        "",
        `## Version ${versions[1]}`,
        "* Supporting SDK version 1.2.3",
        ""
      ].join("\n");
      const observations = parse(adapter, markdown);
      expect(observations).toHaveLength(2);
      expect(observations[0]).toMatchObject({
        productKey: "unity-levelplay-adapters",
        version: versions[0],
        releaseDate: null
      });
      expect(observations[0].componentKey).toBe(
        adapter.manifest.targets[0].targetKey
      );
      expect(observations[0].sourceUrl).toMatch(
        /^https:\/\/github\.com\/ironsource-mobile\//
      );
    }
  });

  test("preserves paragraph notes while discarding fenced implementation code", () => {
    const adapter = levelPlayMediationAdapterSources[0];
    const observations = parse(
      adapter,
      [
        "# Changelog",
        "",
        "## Version 5.10.0",
        "* **Fixed** a crash in rewarded ads.",
        "",
        "Publishers must follow the [migration guide](https://example.com).",
        "",
        "```groovy",
        "implementation 'unsafe-as-a-release-note'",
        "```",
        "",
        "## Version 5.9.0",
        "* Supporting SDK version 13.6.0"
      ].join("\n")
    );

    expect(observations[0].items.map((item) => item.body)).toEqual([
      "Fixed a crash in rewarded ads.",
      "Publishers must follow the migration guide."
    ]);
    expect(observations[0].items[0].changeKind).toBe("fix");
  });

  test("merges duplicate upstream adapter headings without identity collisions", () => {
    const adapter = levelPlayMediationAdapterSources[0];
    const observations = parse(
      adapter,
      [
        "# Changelog",
        "",
        "## Version 4.3.34",
        "* Supporting SDK version 9.8.0",
        "",
        "## Version 4.3.34",
        "* Fixed Bitcode integration.",
        "",
        "## Version 4.3.33",
        "* Previous update."
      ].join("\n")
    );
    expect(observations).toHaveLength(2);
    expect(observations[0].items.map((item) => item.body)).toEqual([
      "Supporting SDK version 9.8.0",
      "Fixed Bitcode integration."
    ]);
  });

  test("quarantines malformed Ads, SDK, and mediation documents", () => {
    expect(() => parse(unityAdsUnityAdapter, "<h1>Other</h1>")).toThrow(
      /root heading/
    );
    expect(() => parse(levelPlayUnityAdapter, "<h1>Other</h1>")).toThrow(
      /root heading/
    );
    expect(() =>
      parse(levelPlayMediationAdapterSources[0], "# Different\n\nNo versions")
    ).toThrow(/root is missing/);
    expect(() =>
      parse(levelPlayMediationAdapterSources[0], "# Changelog\n\nNo versions")
    ).toThrow(/no version sections/);
  });
});

function readFixture(name: string) {
  return readFileSync(
    new URL(`../fixtures/product-updates/${name}`, import.meta.url),
    "utf8"
  );
}

function parse(adapter: ProductUpdateAdapter, text: string) {
  const observations = adapter.parse(snapshot(adapter, text));
  return validateObservations(
    observations,
    { ...adapter.manifest, minimumExpectedRecords: 1 },
    null
  );
}

function snapshot(
  adapter: ProductUpdateAdapter,
  text: string
): ProductUpdateSnapshot {
  const target = adapter.manifest.targets[0];
  return {
    sourceKey: adapter.manifest.sourceKey,
    targetKey: target.targetKey,
    requestedUrl: target.url,
    finalUrl: target.url,
    fetchedAt: "2026-07-28T00:00:00.000Z",
    status: 200,
    etag: null,
    lastModified: null,
    sha256: "fixture",
    text
  };
}
