import { describe, expect, test } from "vitest";
import type {
  NormalizedProductUpdateObservation,
  ProductUpdateAdapterManifest
} from "../../src/lib/product-updates/types";
import {
  validateAdapterManifest,
  validateObservations
} from "../../src/lib/product-updates/validation";

const manifest: ProductUpdateAdapterManifest = {
  sourceKey: "test-source",
  displayName: "Test Source",
  family: "editor-tooling",
  parserVersion: "test-v1",
  cadenceHours: 24,
  timeoutMs: 5_000,
  maxResponseBytes: 100_000,
  minimumExpectedRecords: 1,
  maximumExpectedRecords: 10,
  maximumRecordDropFraction: 0.5,
  targets: [
    {
      targetKey: "main",
      url: "https://unity.com/test",
      allowedHosts: ["unity.com"]
    }
  ]
};

const observation: NormalizedProductUpdateObservation = {
  productKey: "unity-test",
  productSlug: "unity-test",
  productName: "Unity Test",
  componentKey: "main",
  sourceUpdateKey: "1.0.0",
  canonicalKey: "version:1.0.0",
  updateSlug: "1.0.0",
  version: "1.0.0",
  releaseDate: "2026-07-28T00:00:00.000Z",
  title: "Unity Test 1.0.0",
  sourceUrl: "https://unity.com/test/1.0.0",
  items: [
    {
      itemKey: "item-1",
      section: "Changes",
      changeKind: "change",
      body: "Changed a test behavior.",
      platforms: [],
      tags: [],
      sourceOrder: 0
    }
  ]
};

describe("Product Updates validation", () => {
  test("accepts a bounded adapter and observation contract", () => {
    expect(validateAdapterManifest(manifest).sourceKey).toBe("test-source");
    expect(validateObservations([observation], manifest, 1)).toEqual([observation]);
  });

  test("rejects a target whose starting host is not allowlisted", () => {
    expect(() =>
      validateAdapterManifest({
        ...manifest,
        targets: [{ ...manifest.targets[0], allowedHosts: ["example.com"] }]
      })
    ).toThrow(/not allowlisted/);
  });

  test("rejects duplicate source and item identities", () => {
    expect(() => validateObservations([observation, observation], manifest, 2)).toThrow(
      /Duplicate source update key/
    );
    expect(() =>
      validateObservations(
        [{ ...observation, items: [observation.items[0], observation.items[0]] }],
        manifest,
        1
      )
    ).toThrow(/Duplicate item key/);
  });

  test("quarantines implausible record-count drops", () => {
    expect(() => validateObservations([observation], manifest, 4)).toThrow(
      /record count dropped/
    );
  });
});
