import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/releases" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname
}));

import { LeftNav } from "../../src/app/_components/LeftNav";

vi.stubGlobal("React", React);

const CORE_LABELS = [
  "Upgrade Intelligence",
  "Editor Releases",
  "Release Visualizer",
  "Search Notes",
  "Issue Explorer",
  "Packages",
  "Unity GitHub",
  "Staff Discussions",
  "Activity Feed",
  "News",
  "Resources",
  "Stats",
  "FAQ"
];

describe("Product Updates navigation flag", () => {
  test("preserves every original destination and hides optional discovery by default", () => {
    const html = renderToStaticMarkup(
      <LeftNav productUpdatesEnabled={false} />
    );

    for (const label of CORE_LABELS) expect(html).toContain(label);
    expect(html).not.toContain("Editor Tooling Updates");
    expect(html).not.toContain(">Product Updates<");
    expect(html).not.toContain("Unity Products");
  });

  test("adds the two tiered entries without replacing core destinations", () => {
    const html = renderToStaticMarkup(
      <LeftNav productUpdatesEnabled={true} />
    );

    for (const label of CORE_LABELS) expect(html).toContain(label);
    expect(html).toContain("Editor Tooling Updates");
    expect(html).toContain(">Product Updates<");
    expect(html).toContain("Unity Products");
  });

  test("keeps Hub and CLI histories under Editor Tooling context", () => {
    for (const pathname of [
      "/updates/products/unity-hub",
      "/updates/products/unity-hub/3.14.0",
      "/updates/products/unity-cli/1.2.0"
    ]) {
      navigation.pathname = pathname;
      const html = renderToStaticMarkup(
        <LeftNav productUpdatesEnabled={true} />
      );
      expect(html.match(/aria-current="page"/g)).toHaveLength(1);
      expect(html).toMatch(
        /href="\/updates\/editor-tooling"[^>]*aria-current="page"/
      );
    }
    navigation.pathname = "/releases";
  });
});
