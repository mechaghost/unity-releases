import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("../../src/app/_components/Icon", () => ({
  Icon: ({ name }: { name: string }) => <span data-icon={name} />
}));

import { ComparePicker } from "../../src/app/_components/ComparePicker";

const releases = [
  { version: "6000.4.5f1", stream: "Update/Supported", release_date: "2026-04-28T00:00:00.000Z" },
  { version: "6000.3.14f1", stream: "LTS", release_date: "2026-04-22T00:00:00.000Z" },
  { version: "6000.0.74f1", stream: "LTS", release_date: "2026-04-29T00:00:00.000Z" }
];

describe("ComparePicker", () => {
  test("uses native selects so an existing version can be changed from the picker", () => {
    const html = renderToStaticMarkup(
      <ComparePicker
        fromVersion="6000.3.14f1"
        toVersion="6000.4.5f1"
        releases={releases}
        selectedStreams={["LTS"]}
        action="/compare"
      />
    );

    expect(html).toContain('<select name="from"');
    expect(html).toContain('<select name="to"');
    expect(html).not.toContain("<datalist");
    expect(html).not.toContain('list="compare-picker-versions"');
    expect(html).toContain('<option value="6000.0.74f1">6000.0.74f1</option>');
    // Dropdown options should be the bare version string — no stream label
    // or release-date crammed into the option text.
    const optionMatches = html.match(/<option[^>]*>([^<]+)<\/option>/g) ?? [];
    for (const opt of optionMatches) {
      expect(opt).not.toMatch(/Supported|Apr \d+/);
      const isStreamScopeFiltering = opt.includes("Select a version");
      if (!isStreamScopeFiltering) {
        // "LTS" can appear in the stream-scope checkbox area, but never
        // inside a version <option>.
        expect(opt).not.toContain("LTS");
      }
    }
  });
});
