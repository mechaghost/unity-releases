import { describe, expect, test } from "vitest";

import { isInScope } from "../../src/jobs/backfill-unity6";

const release = (version: string) => ({ version });

/**
 * `ingestStream` halts the entire stream walk on the first API page with
 * nothing in scope. That makes this predicate load-bearing: too narrow and a
 * whole generation of history silently never gets ingested.
 */
describe("backfill scope predicate", () => {
  test("accepts Unity 6", () => {
    expect(isInScope(release("6000.0.80f1"))).toBe(true);
    expect(isInScope(release("6000.7.0a2"))).toBe(true);
  });

  test("accepts a future generation", () => {
    // The bug this guards: `version.startsWith("6000.")` returned false for
    // every 7000.x release, so page 0 of each stream would contain nothing in
    // scope the day Unity 7 tops the list - halting the walk permanently, for
    // Unity 6 history too.
    expect(isInScope(release("7000.0.0f1"))).toBe(true);
    expect(isInScope(release("7000.2.13f1"))).toBe(true);
    expect(isInScope(release("8000.0.0a1"))).toBe(true);
  });

  test("still stops at the legacy year boundary", () => {
    expect(isInScope(release("2023.2.20f1"))).toBe(false);
    expect(isInScope(release("2022.3.61f1"))).toBe(false);
    expect(isInScope(release("2019.4.40f1"))).toBe(false);
  });

  test("unparseable versions are out of scope rather than throwing", () => {
    expect(isInScope(release("not-a-version"))).toBe(false);
    expect(isInScope(release(""))).toBe(false);
  });

  test("a page mixing generations still has releases in scope", () => {
    const page = ["7000.0.0f1", "6000.7.4f1", "2022.3.61f1"].map(release);
    expect(page.filter(isInScope).map((r) => r.version)).toEqual([
      "7000.0.0f1",
      "6000.7.4f1"
    ]);
  });

  test("a page of only legacy releases halts the walk", () => {
    const page = ["2023.2.20f1", "2022.3.61f1"].map(release);
    expect(page.filter(isInScope)).toHaveLength(0);
  });
});
