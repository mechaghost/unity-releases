import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { ProductPrimaryActions } from "../../src/app/updates/_components/ProductUpdateViews";
import { getProductUpdatePrimaryAction } from "../../src/lib/product-updates/catalog";

vi.stubGlobal("React", React);

describe("Editor tooling product actions", () => {
  test("makes acquisition primary and release history secondary", () => {
    const products = [
      product({
        productKey: "unity-hub",
        slug: "unity-hub",
        displayName: "Unity Hub",
        canonicalUrl: "https://unity.com/unity-hub"
      }),
      product({
        productKey: "unity-cli",
        slug: "unity-cli",
        displayName: "Unity CLI",
        canonicalUrl: "https://docs.unity.com/en-us/unity-cli"
      })
    ];
    const html = renderToStaticMarkup(
      <ProductPrimaryActions products={products} />
    );

    expect(html).toContain(">Get the tools<");
    expect(html).toContain('href="https://unity.com/download"');
    expect(html).toContain(">Download Unity Hub<");
    expect(html).toContain(
      'href="https://docs.unity.com/en-us/hub/use-unity-cli"'
    );
    expect(html).toContain(">Install Unity CLI<");
    expect(html.match(/>Release history</g)).toHaveLength(2);
    expect(html.match(/class="btn btn--primary"/g)).toHaveLength(2);
  });

  test("falls back to the official product link for every tracked product", () => {
    expect(
      getProductUpdatePrimaryAction(
        product({
          productKey: "future-editor-tool",
          slug: "future-editor-tool",
          displayName: "Future Editor Tool",
          canonicalUrl: "https://unity.com/future-editor-tool"
        })
      )
    ).toEqual({
      href: "https://unity.com/future-editor-tool",
      label: "View Future Editor Tool"
    });
    expect(
      getProductUpdatePrimaryAction({
        ...product({
          productKey: "unity-ads",
          slug: "unity-ads",
          displayName: "Unity Ads",
          canonicalUrl: "https://docs.unity.com/grow/ads"
        }),
        family: "monetization"
      })
    ).toEqual({
      href: "https://docs.unity.com/grow/ads",
      label: "View Unity Ads"
    });
  });

  test("keeps the acquisition panel scoped to core Editor tooling", () => {
    const html = renderToStaticMarkup(
      <ProductPrimaryActions
        products={[
          {
            ...product({
              productKey: "vivox-unreal",
              slug: "vivox-unreal",
              displayName: "Vivox Unreal SDK",
              canonicalUrl: "https://docs.unity.com/en-us/vivox-unreal/unreal"
            }),
            family: "platform-services"
          }
        ]}
      />
    );

    expect(html).toBe("");
  });
});

function product(
  overrides: Partial<{
    productKey: string;
    slug: string;
    displayName: string;
    canonicalUrl: string | null;
  }>
) {
  return {
    productKey: "unity-hub",
    slug: "unity-hub",
    displayName: "Unity Hub",
    family: "editor-tooling",
    description: "Manage Editor installations.",
    status: "active",
    canonicalUrl: "https://unity.com/unity-hub",
    updateCount: 10,
    latestUpdateAt: "2026-07-28T00:00:00.000Z",
    ...overrides
  };
}
