import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("../../src/app/_actions/user-packages", () => ({
  clearUserPackagesAction: vi.fn(),
  setUserPackagesAction: vi.fn()
}));

import { SidebarUserPackages } from "../../src/app/_components/SidebarUserPackages";

describe("SidebarUserPackages", () => {
  test("describes the all-packages state clearly", () => {
    const html = renderToStaticMarkup(<SidebarUserPackages packages={[]} />);

    expect(html).toContain("All packages");
    expect(html).not.toContain(">all<");
  });

  test("describes saved manifest packages as tracked", () => {
    const html = renderToStaticMarkup(
      <SidebarUserPackages packages={["com.unity.inputsystem", "com.unity.cinemachine"]} />
    );

    expect(html).toContain("2 tracked");
  });
});
