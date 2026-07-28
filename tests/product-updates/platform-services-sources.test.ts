import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { assetManagerAdapter } from "../../src/lib/product-updates/sources/asset-manager";
import { licensingServerAdapter } from "../../src/lib/product-updates/sources/licensing-server";
import { ugsAdapter } from "../../src/lib/product-updates/sources/ugs";
import { unityVersionControlAdapter } from "../../src/lib/product-updates/sources/unity-version-control";
import {
  vivoxCoreAdapter,
  vivoxUnityAdapter,
  vivoxUnrealAdapter
} from "../../src/lib/product-updates/sources/vivox";
import type {
  ProductUpdateAdapter,
  ProductUpdateSnapshot
} from "../../src/lib/product-updates/types";
import { validateObservations } from "../../src/lib/product-updates/validation";

describe("Platform and services Product Update adapters", () => {
  test("parses independent licensing, UVCS, and Asset Manager histories", () => {
    const licensing = parseFixture(licensingServerAdapter, "licensing-server.html");
    expect(licensing).toHaveLength(2);
    expect(licensing[0]).toMatchObject({
      productKey: "unity-licensing-server",
      version: "2.4.1",
      releaseDate: null
    });
    expect(licensing[0].items.map((item) => item.section)).toContain("Added");

    const uvcs = parseFixture(
      unityVersionControlAdapter,
      "unity-version-control.html"
    );
    expect(uvcs).toHaveLength(2);
    expect(uvcs[0]).toMatchObject({
      productKey: "unity-version-control",
      version: "11.0.16.10303",
      releaseDate: "2026-07-24T00:00:00.000Z"
    });
    expect(uvcs[0].items[0].body).toContain("Unity Smart Merge");

    const assets = parseFixture(assetManagerAdapter, "asset-manager.html");
    expect(assets).toHaveLength(2);
    expect(assets[0]).toMatchObject({
      productKey: "unity-asset-manager",
      version: null,
      canonicalKey: "date:2026-07-16"
    });
    expect(assets[0].items.map((item) => item.section)).toEqual([
      "Asset Manager web",
      "Asset Manager APIs"
    ]);
  });

  test("maps the UGS aggregate to stable product identities", () => {
    const observations = parseFixture(ugsAdapter, "ugs.html");
    expect(observations).toHaveLength(3);
    expect(observations[0]).toMatchObject({
      productKey: "vivox-unity",
      componentKey: "unity",
      canonicalKey: "version:16.10.0"
    });
    expect(observations[1]).toMatchObject({
      productKey: "unity-authentication",
      canonicalKey: "version:3.7.1"
    });
    expect(observations[2].canonicalKey).toBe(
      observations[0].canonicalKey
    );
    expect(observations[2].sourceUpdateKey).not.toBe(
      observations[0].sourceUpdateKey
    );
  });

  test("keeps UGS component identities collision-free and package data excluded", () => {
    const observations = parseFixture(ugsAdapter, "ugs-collisions.html");
    expect(observations).toHaveLength(6);
    expect(observations.some((row) => row.productKey === "unity-iap")).toBe(
      false
    );
    expect(
      new Set(
        observations.map((row) => `${row.productSlug}:${row.updateSlug}`)
      ).size
    ).toBe(observations.length);
    expect(
      new Set(
        observations.map(
          (row) =>
            `${row.productKey}:${row.componentKey}:${row.canonicalKey}`
        )
      ).size
    ).toBe(observations.length);
    expect(
      observations.find((row) => row.title === "Multiplayer SDK 2.0.0")
    ).toMatchObject({
      productKey: "unity-multiplayer",
      componentKey: "main",
      updateSlug: "2.0.0"
    });
    expect(
      observations.find(
        (row) => row.title === "Multiplayer Playmode SDK 2.0.0"
      )
    ).toMatchObject({
      productKey: "unity-multiplayer",
      componentKey: "playmode",
      updateSlug: "playmode-2.0.0"
    });
    expect(
      observations.find(
        (row) => row.title === "User Generated Content Bridge 3.0.0"
      )
    ).toMatchObject({
      productKey: "unity-ugc",
      componentKey: "bridge",
      updateSlug: "bridge-3.0.0"
    });
  });

  test("keeps all three Vivox SDK histories independent", () => {
    const unity = parseFixture(vivoxUnityAdapter, "vivox-unity.html");
    const core = parseFixture(vivoxCoreAdapter, "vivox-core.html");
    const unreal = parseFixture(vivoxUnrealAdapter, "vivox-unreal.html");
    expect(unity[0]).toMatchObject({
      productKey: "vivox-unity",
      componentKey: "unity",
      canonicalKey: "version:16.10.0"
    });
    expect(core[0]).toMatchObject({
      productKey: "vivox-core",
      componentKey: "core",
      version: "5.27.3"
    });
    expect(unreal[0]).toMatchObject({
      productKey: "vivox-unreal",
      componentKey: "unreal",
      version: "5.27.1.unr.0"
    });
  });

  test("product-specific Vivox identity reconciles with UGS evidence", () => {
    const ugs = parseFixture(ugsAdapter, "ugs.html")[0];
    const vivox = parseFixture(vivoxUnityAdapter, "vivox-unity.html")[0];
    expect({
      productKey: ugs.productKey,
      componentKey: ugs.componentKey,
      canonicalKey: ugs.canonicalKey
    }).toEqual({
      productKey: vivox.productKey,
      componentKey: vivox.componentKey,
      canonicalKey: vivox.canonicalKey
    });
    expect(ugs.sourceUpdateKey).not.toBe(vivox.sourceUpdateKey);
  });

  test("rejects a structurally unrelated Unity Docs document", () => {
    expect(() =>
      licensingServerAdapter.parse(
        snapshot(licensingServerAdapter, "<h1>Different product</h1>")
      )
    ).toThrow(/root heading/);
    expect(() =>
      ugsAdapter.parse(snapshot(ugsAdapter, "<h1>Different product</h1>"))
    ).toThrow(/root heading/);
  });
});

function parseFixture(adapter: ProductUpdateAdapter, fixture: string) {
  const html = readFileSync(
    new URL(`../fixtures/product-updates/${fixture}`, import.meta.url),
    "utf8"
  );
  const observations = adapter.parse(snapshot(adapter, html));
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
