import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn()
}));

vi.mock("../../src/lib/db/client", () => ({
  query: mocks.query,
  getPool: vi.fn()
}));

import {
  listProductUpdateFacets,
  listProductUpdates
} from "../../src/lib/product-updates/repositories";

beforeEach(() => {
  mocks.query.mockReset();
});

describe("Product Updates read repositories", () => {
  test("keeps every browse filter parameterized and scoped to Product Updates tables", async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [{ ready: true }] })
      .mockResolvedValueOnce({ rows: [] });

    await listProductUpdates({
      family: "editor-tooling",
      product: "unity-hub",
      changeKind: "improvement",
      platform: "Windows",
      version: "3.14.0",
      channel: "stable",
      from: "2026-07-01",
      to: "2026-07-31",
      limit: 25
    });

    const [sql, params] = mocks.query.mock.calls[1];
    expect(sql).toContain("FROM product_updates u");
    expect(sql).toContain("filter_item.change_kind");
    expect(sql).toContain("ANY(platform_item.platforms)");
    expect(sql).not.toContain("unity_releases");
    expect(params).toEqual([
      "editor-tooling",
      "unity-hub",
      "improvement",
      "Windows",
      "3.14.0",
      "stable",
      "2026-07-01",
      "2026-07-31",
      25
    ]);
  });

  test("returns scoped filter facets without coupling to core release tables", async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [{ ready: true }] })
      .mockResolvedValueOnce({
        rows: [
          {
            versions: ["3.14.0"],
            channels: ["stable"],
            change_kinds: ["improvement"],
            platforms: ["Windows"]
          }
        ]
      });

    await expect(
      listProductUpdateFacets({
        family: "editor-tooling",
        product: "unity-hub"
      })
    ).resolves.toEqual({
      versions: ["3.14.0"],
      channels: ["stable"],
      changeKinds: ["improvement"],
      platforms: ["Windows"]
    });

    const [sql, params] = mocks.query.mock.calls[1];
    expect(sql).toContain("WITH scoped_updates");
    expect(sql).not.toContain("release_note_items");
    expect(params).toEqual(["editor-tooling", "unity-hub"]);
  });
});
