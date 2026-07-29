import { describe, expect, test } from "vitest";
import type {
  NormalizedProductUpdateObservation,
  ProductUpdateAdapterManifest
} from "../../src/lib/product-updates/types";
import {
  validateAdapterManifest,
  validateObservations
} from "../../src/lib/product-updates/validation";
import { PRODUCT_UPDATE_ADAPTERS } from "../../src/lib/product-updates/sources";

const manifest: ProductUpdateAdapterManifest = {
  sourceKey: "test-source",
  displayName: "Test Source",
  family: "editor-tooling",
  parserVersion: "test-v1",
  allowedEvidenceHosts: ["unity.com"],
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

  test("validates every registered adapter and its explicit evidence boundary", () => {
    const sourceKeys = new Set<string>();
    for (const adapter of PRODUCT_UPDATE_ADAPTERS) {
      expect(() => validateAdapterManifest(adapter.manifest)).not.toThrow();
      expect(adapter.manifest.allowedEvidenceHosts.length).toBeGreaterThan(0);
      expect(sourceKeys.has(adapter.manifest.sourceKey)).toBe(false);
      sourceKeys.add(adapter.manifest.sourceKey);
    }
    expect(sourceKeys.size).toBe(PRODUCT_UPDATE_ADAPTERS.length);
  });

  test("rejects a target whose starting host is not allowlisted", () => {
    expect(() =>
      validateAdapterManifest({
        ...manifest,
        targets: [{ ...manifest.targets[0], allowedHosts: ["example.com"] }]
      })
    ).toThrow(/not allowlisted/);
  });

  test("rejects parsed evidence and product links outside the adapter allowlist", () => {
    expect(() =>
      validateObservations(
        [{ ...observation, sourceUrl: "https://example.com/phishing" }],
        manifest,
        1
      )
    ).toThrow(/source URL host example.com is not allowlisted/);
    expect(() =>
      validateObservations(
        [
          {
            ...observation,
            productCanonicalUrl: "https://example.com/fake-product"
          }
        ],
        manifest,
        1
      )
    ).toThrow(/product URL host example.com is not allowlisted/);
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
