import { describe, expect, test } from "vitest";

import { paginateItems } from "../../src/lib/pagination";

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
