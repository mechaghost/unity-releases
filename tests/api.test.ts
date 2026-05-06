import { describe, expect, test } from "vitest";
import { filtersFromSearchParams, jsonError } from "../src/lib/api";

function p(qs: string) {
  return new URLSearchParams(qs);
}

describe("filtersFromSearchParams", () => {
  test("returns sensible defaults when nothing is supplied", () => {
    const f = filtersFromSearchParams(p(""));
    expect(f).toEqual({
      q: undefined,
      version: undefined,
      minorLine: undefined,
      stream: undefined,
      section: undefined,
      area: undefined,
      platform: undefined,
      impactKind: undefined,
      riskLevel: undefined,
      packageName: undefined,
      issueId: undefined,
      limit: 100,
      offset: 0
    });
  });

  test("passes single-value scalar params straight through", () => {
    const f = filtersFromSearchParams(
      p("q=memory&version=6000.3.14f1&minorLine=6000.3&stream=LTS&section=Fixes&area=WebGL")
    );
    expect(f).toMatchObject({
      q: "memory",
      version: "6000.3.14f1",
      minorLine: "6000.3",
      stream: "LTS",
      section: "Fixes",
      area: "WebGL"
    });
  });

  test("collects a single occurrence of a multi-key as a string", () => {
    const f = filtersFromSearchParams(p("platform=WebGL"));
    expect(f.platform).toBe("WebGL");
  });

  test("collects multiple occurrences of a multi-key as an array", () => {
    const f = filtersFromSearchParams(p("platform=WebGL&platform=iOS&platform=Android"));
    expect(f.platform).toEqual(["WebGL", "iOS", "Android"]);
  });

  test("treats every multi-key consistently", () => {
    const f = filtersFromSearchParams(
      p("impact=fix&impact=feature&risk=blocker&risk=caution&package=com.unity.a&package=com.unity.b&issue=UUM-1&issue=UUM-2")
    );
    expect(f.impactKind).toEqual(["fix", "feature"]);
    expect(f.riskLevel).toEqual(["blocker", "caution"]);
    expect(f.packageName).toEqual(["com.unity.a", "com.unity.b"]);
    expect(f.issueId).toEqual(["UUM-1", "UUM-2"]);
  });

  test("the legacy `type=` alias is honored when no `impact=` is supplied", () => {
    // Older release-detail URLs used `?type=` for the impact filter; we
    // still accept it when there's no fresh `impact=`.
    expect(filtersFromSearchParams(p("type=fix")).impactKind).toBe("fix");
  });

  test("a fresh `impact=` overrides the legacy `type=`", () => {
    // If both are present, the explicit modern key wins.
    const f = filtersFromSearchParams(p("type=fix&impact=feature"));
    expect(f.impactKind).toBe("feature");
  });

  test("empty multi-keys come back undefined, not empty arrays", () => {
    const f = filtersFromSearchParams(p("q=x"));
    expect(f.platform).toBeUndefined();
    expect(f.impactKind).toBeUndefined();
    expect(f.riskLevel).toBeUndefined();
    expect(f.packageName).toBeUndefined();
    expect(f.issueId).toBeUndefined();
  });

  test("limit and offset parse from the URL with sane fallbacks", () => {
    expect(filtersFromSearchParams(p("limit=25&offset=50"))).toMatchObject({
      limit: 25,
      offset: 50
    });
    expect(filtersFromSearchParams(p("limit=foo")).limit).toBe(100);
    expect(filtersFromSearchParams(p("offset=NaN")).offset).toBe(0);
    expect(filtersFromSearchParams(p("limit=")).limit).toBe(100);
  });

  test("does not mix scalar and array shapes for the same field", () => {
    // When platform appears once, it's a string. When it appears
    // multiple times, it's an array. The SQL builder relies on this.
    expect(typeof filtersFromSearchParams(p("platform=WebGL")).platform).toBe("string");
    expect(Array.isArray(filtersFromSearchParams(p("platform=WebGL&platform=iOS")).platform)).toBe(
      true
    );
  });

  test("preserves URL-supplied order of multi-values", () => {
    const f = filtersFromSearchParams(p("impact=feature&impact=fix"));
    expect(f.impactKind).toEqual(["feature", "fix"]);
  });
});

describe("jsonError", () => {
  test("extracts message from an Error", () => {
    expect(jsonError(new Error("boom"))).toEqual({ error: "boom" });
  });

  test("falls back for non-Error throwables", () => {
    expect(jsonError("string error")).toEqual({ error: "Unknown error" });
    expect(jsonError(42)).toEqual({ error: "Unknown error" });
    expect(jsonError(null)).toEqual({ error: "Unknown error" });
  });
});
