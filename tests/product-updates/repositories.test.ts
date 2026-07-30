import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn()
}));

vi.mock("../../src/lib/db/client", () => ({
  query: mocks.query,
  getPool: vi.fn()
}));

import {
  countProductUpdates,
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

  test("supports bounded HTML page offsets and exact filtered totals", async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [{ ready: true }] })
      .mockResolvedValueOnce({ rows: [] });
    await listProductUpdates({
      product: "unity-hub",
      limit: 100,
      offset: 100
    });
    const [pageSql, pageParams] = mocks.query.mock.calls[1];
    expect(pageSql).toContain("LIMIT $2");
    expect(pageSql).toContain("OFFSET $3");
    expect(pageParams).toEqual(["unity-hub", 100, 100]);

    mocks.query
      .mockResolvedValueOnce({ rows: [{ ready: true }] })
      .mockResolvedValueOnce({ rows: [{ count: "105" }] });
    await expect(
      countProductUpdates({
        product: "unity-hub",
        changeKind: "improvement"
      })
    ).resolves.toBe(105);
    const [countSql, countParams] = mocks.query.mock.calls[3];
    expect(countSql).toContain("COUNT(*)");
    expect(countSql).toContain("filter_item.change_kind");
    expect(countParams).toEqual(["unity-hub", "improvement"]);
  });

  test("ranks rows with a real release date above dateless ones", async () => {
    // A dateless bulk source (3k+ LevelPlay adapter versions sharing one
    // first_seen_at) otherwise owns page 1 of the cross-family feed and
    // buries the Hub/CLI releases the page calls out as most relevant.
    mocks.query
      .mockResolvedValueOnce({ rows: [{ ready: true }] })
      .mockResolvedValueOnce({ rows: [] });

    await listProductUpdates({ limit: 40 });

    const [sql] = mocks.query.mock.calls[1];
    expect(sql).toContain(
      "ORDER BY (u.release_date IS NOT NULL)::int DESC, COALESCE(u.release_date, u.first_seen_at) DESC, u.id DESC"
    );
  });

  test("cursor predicate compares the same keys as the ORDER BY", async () => {
    // Keyset pagination breaks (repeats or skips rows at the dated/dateless
    // boundary) if the tuple compare and the ordering ever drift apart.
    mocks.query
      .mockResolvedValueOnce({ rows: [{ ready: true }] })
      .mockResolvedValueOnce({ rows: [] });

    await listProductUpdates({
      limit: 40,
      before: { hasReleaseDate: false, sortTime: "2026-07-29T18:03:04.094Z", id: 3355 }
    });

    const [sql, params] = mocks.query.mock.calls[1];
    expect(sql).toContain(
      "((u.release_date IS NOT NULL)::int, COALESCE(u.release_date, u.first_seen_at), u.id) < ($1::int, $2::timestamptz, $3::bigint)"
    );
    expect(params.slice(0, 3)).toEqual([0, "2026-07-29T18:03:04.094Z", 3355]);
  });

  test("a legacy cursor without the has-date key resumes in the dated section", async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [{ ready: true }] })
      .mockResolvedValueOnce({ rows: [] });

    await listProductUpdates({
      limit: 40,
      before: { sortTime: "2026-07-28T00:00:00.000Z", id: 12 }
    });

    const [, params] = mocks.query.mock.calls[1];
    // 1 = dated: resume at the front of the list rather than silently
    // jumping past every dated row into the dateless tail.
    expect(params[0]).toBe(1);
  });
});
