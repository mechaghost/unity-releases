import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/releases"
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
});
