import { describe, expect, test } from "vitest";

import { paginateItems, firstQueryValue, pageBounds, pageHref, pageNumber, queryParams } from "../../src/lib/pagination";

test("page links preserve repeated filters while replacing old paging", () => {
  const params = queryParams({ platform: ["iOS", "Android"], q: "render", page: "2", offset: "100" });
  const next = new URL(pageHref("/explorer", params, 3), "https://example.test");
  expect(next.searchParams.getAll("platform")).toEqual(["iOS", "Android"]);
  expect(next.searchParams.get("q")).toBe("render");
  expect(next.searchParams.get("page")).toBe("3");
  expect(next.searchParams.has("offset")).toBe(false);
  expect(pageHref("/explorer", new URLSearchParams("page=2"), 1)).toBe("/explorer");
});

test("normalizes repeated and unsafe query values", () => {
  expect(firstQueryValue([" input ", "ignored"])).toBe("input");
  expect(pageNumber(["2", "3"])).toBe(2);
  for (const value of ["-1", "NaN", "1.2", "1e3", "999999999999999999"]) expect(pageNumber(value)).toBe(1);
  expect(pageBounds(155, 999, 100)).toEqual({ page: 2, pages: 2, offset: 100 });
  expect(pageBounds(0, 5, 100)).toEqual({ page: 1, pages: 1, offset: 0 });
});

describe("paginateItems", () => {
  const items = Array.from({ length: 105 }, (_, index) => index + 1);

  test("returns the first page when the requested page is missing or invalid", () => {
    expect(paginateItems(items, undefined, 50)).toMatchObject({
      page: 1,
      totalPages: 3,
      start: 1,
      end: 50
    });
    expect(paginateItems(items, "nope", 50).page).toBe(1);
    expect(paginateItems(items, "-3", 50).page).toBe(1);
  });

  test("returns the correct slice and range for a middle page", () => {
    const result = paginateItems(items, "2", 50);
    expect(result.page).toBe(2);
    expect(result.items).toEqual(items.slice(50, 100));
    expect(result.start).toBe(51);
    expect(result.end).toBe(100);
    expect(result.hasPrev).toBe(true);
    expect(result.hasNext).toBe(true);
  });

  test("clamps above-range page requests to the last page", () => {
    const result = paginateItems(items, "99", 50);
    expect(result.page).toBe(3);
    expect(result.items).toEqual(items.slice(100));
    expect(result.start).toBe(101);
    expect(result.end).toBe(105);
    expect(result.hasNext).toBe(false);
  });

  test("reports a stable empty state for no items", () => {
    expect(paginateItems([], "4", 50)).toMatchObject({
      items: [],
      page: 1,
      totalPages: 1,
      start: 0,
      end: 0,
      hasPrev: false,
      hasNext: false
    });
  });
});
