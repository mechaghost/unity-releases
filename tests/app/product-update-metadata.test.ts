import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getProduct: vi.fn(),
  getDetail: vi.fn()
}));

vi.mock("../../src/lib/product-updates/repositories", () => ({
  getUnityProductBySlug: mocks.getProduct,
  getProductUpdateDetail: mocks.getDetail,
  countProductUpdates: vi.fn(),
  listProductUpdateFacets: vi.fn(),
  listProductUpdates: vi.fn(),
  listUnityProducts: vi.fn(),
  productUpdatesSchemaReady: vi.fn()
}));

import { generateMetadata as productMetadata } from "../../src/app/updates/products/[product]/page";
import { generateMetadata as detailMetadata } from "../../src/app/updates/products/[product]/[update]/page";

beforeEach(() => {
  mocks.getProduct.mockReset();
  mocks.getDetail.mockReset();
});

describe("Product Updates metadata", () => {
  test.each([
    ["unity-cli", "Unity CLI"],
    ["vpc-aws", "VPC AWS"],
    ["unity-ads-ios", "Unity Ads iOS"]
  ])("preserves the canonical product name for %s", async (slug, name) => {
    mocks.getProduct.mockResolvedValue({
      productKey: slug,
      slug,
      displayName: name,
      family: "platform-services",
      description: `${name} release notes.`,
      status: "active",
      canonicalUrl: `https://docs.unity.com/${slug}`,
      updateCount: 1,
      latestUpdateAt: "2026-07-28T00:00:00.000Z",
      lastValidatedAt: "2026-07-28T00:00:00.000Z"
    });

    await expect(
      productMetadata({ params: Promise.resolve({ product: slug }) })
    ).resolves.toMatchObject({
      title: `${name} Updates`,
      description: `${name} release notes.`
    });
  });

  test("uses canonical detail data and noindexes unresolved routes", async () => {
    mocks.getDetail.mockResolvedValueOnce({
      product: {
        productKey: "unity-ads-ios",
        slug: "unity-ads-ios",
        displayName: "Unity Ads iOS",
        family: "monetization",
        description: "Ads SDK.",
        status: "active",
        lastValidatedAt: "2026-07-28T00:00:00.000Z",
        canonicalUrl: "https://docs.unity.com/ads-ios"
      },
      update: {
        id: 1,
        componentKey: "ios",
        slug: "4.16.0",
        version: "4.16.0",
        channel: null,
        releaseDate: "2026-07-28T00:00:00.000Z",
        title: "Unity Ads iOS 4.16.0",
        summary: "Validated iOS SDK notes."
      },
      observations: []
    });
    await expect(
      detailMetadata({
        params: Promise.resolve({
          product: "unity-ads-ios",
          update: "4.16.0"
        })
      })
    ).resolves.toMatchObject({
      title: "Unity Ads iOS: Unity Ads iOS 4.16.0",
      description: "Validated iOS SDK notes."
    });

    mocks.getProduct.mockResolvedValueOnce(null);
    await expect(
      productMetadata({
        params: Promise.resolve({ product: "does-not-exist" })
      })
    ).resolves.toMatchObject({
      robots: { index: false, follow: false }
    });
  });
});
