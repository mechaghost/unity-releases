import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import {
  ProductUpdateDetailView,
  type UpdateDetail
} from "../../src/app/updates/_components/ProductUpdateViews";
import { groupProductUpdateItems } from "../../src/lib/product-updates/presentation";

vi.stubGlobal("React", React);

const summary =
  "This release adds a step to iOS and macOS builds and fixes subsequent login tries.";

describe("Product update detail IA", () => {
  test("groups changes by section and removes parser-only presentation noise", () => {
    const html = renderToStaticMarkup(
      <ProductUpdateDetailView detail={vivoxDetail()} />
    );

    expect(html.match(/>Key Features and Bugs Addressed</g)).toHaveLength(1);
    expect(html).not.toContain(">key-features-and-bugs-addressed<");
    expect(html).not.toContain(">release-overview<");
    expect(html.match(new RegExp(summary, "g"))).toHaveLength(1);
    expect(html).not.toContain(">macOS, iOS<");
    expect(html).toContain('aria-label="Platforms"');
    expect(html).toContain(">macOS<");
    expect(html).toContain(">iOS<");
    expect(html).toContain(">Feature<");
    expect(html).toContain(">Fix<");
    expect(html).toContain("No public API changes reported.");
    expect(html).toContain("No known issues reported.");
    expect(html).not.toContain(">None.<");
  });

  test("carries a platform heading into subsequent changes in its section", () => {
    const groups = groupProductUpdateItems(
      vivoxDetail().observations[0].items,
      summary
    );
    const changes = groups.find(
      (group) => group.section === "Key Features and Bugs Addressed"
    );

    expect(changes?.items).toHaveLength(2);
    expect(changes?.items[0].platforms).toEqual(["macOS", "iOS"]);
    expect(changes?.items[1].platforms).toEqual(["macOS", "iOS"]);
  });
});

function vivoxDetail(): UpdateDetail {
  return {
    product: {
      productKey: "vivox-unreal",
      slug: "vivox-unreal",
      displayName: "Vivox Unreal SDK",
      family: "platform-services",
      description: "Voice and text chat for Unreal.",
      status: "active",
      lastValidatedAt: "2026-07-28T00:00:00.000Z",
      canonicalUrl: "https://docs.unity.com/en-us/vivox-unreal/unreal"
    },
    update: {
      id: 453,
      componentKey: "unreal",
      slug: "5.24.0.unr.0",
      version: "5.24.0.unr.0",
      channel: null,
      releaseDate: "2025-03-17T00:00:00.000Z",
      title: "Vivox Unreal SDK 5.24.0.unr.0",
      summary
    },
    observations: [
      {
        id: 88,
        sourceKey: "vivox-unreal",
        sourceName: "Vivox Unreal SDK",
        title: "Vivox Unreal SDK 5.24.0.unr.0",
        summary,
        version: "5.24.0.unr.0",
        channel: null,
        releaseDate: "2025-03-17T00:00:00.000Z",
        sourceUrl:
          "https://docs.unity.com/en-us/vivox-unreal/release-notes/unreal/5-24-0",
        publishedAt: null,
        items: [
          item("overview", "Release overview", "change", summary, [
            "macOS",
            "iOS"
          ]),
          item(
            "platforms",
            "Key Features and Bugs Addressed",
            "change",
            "macOS, iOS",
            ["macOS", "iOS"]
          ),
          item(
            "feature",
            "Key Features and Bugs Addressed",
            "feature",
            "Added a build step.",
            ["macOS", "iOS"]
          ),
          item(
            "fix",
            "Key Features and Bugs Addressed",
            "fix",
            "Fixed LoginState after a failed login.",
            []
          ),
          item(
            "api",
            "Public API Changes",
            "change",
            "None.",
            []
          ),
          item("issues", "Known Issues", "change", "None.", [])
        ]
      }
    ]
  };
}

function item(
  itemKey: string,
  section: string,
  changeKind: string,
  body: string,
  platforms: string[]
) {
  return {
    itemKey,
    section,
    changeKind,
    body,
    platforms,
    tags: [section.toLocaleLowerCase().replace(/\s+/g, "-")],
    sourceOrder: 0
  };
}
