import { describe, expect, test } from "vitest";
import {
  ALL_STREAMS,
  DEFAULT_STREAMS,
  parseStreamFilterCookie,
  streamMatches,
  type StreamName
} from "../../src/lib/stream-filter";

describe("parseStreamFilterCookie", () => {
  test("falls back to LTS + Update/Supported when no cookie has been set", () => {
    expect(parseStreamFilterCookie(undefined)).toEqual(DEFAULT_STREAMS);
    expect(parseStreamFilterCookie(undefined)).toEqual(["LTS", "Update/Supported"]);
  });

  test("treats an empty cookie as 'user explicitly unchecked everything'", () => {
    expect(parseStreamFilterCookie("")).toEqual([]);
    expect(parseStreamFilterCookie("   ")).toEqual([]);
  });

  test("parses a single allowed stream", () => {
    expect(parseStreamFilterCookie("LTS")).toEqual(["LTS"]);
    expect(parseStreamFilterCookie("alpha")).toEqual(["alpha"]);
  });

  test("parses every known stream", () => {
    expect(parseStreamFilterCookie("LTS,Update/Supported,beta,alpha")).toEqual([
      "LTS",
      "Update/Supported",
      "beta",
      "alpha"
    ]);
  });

  test("trims whitespace around values", () => {
    expect(parseStreamFilterCookie(" LTS , beta ")).toEqual(["LTS", "beta"]);
    expect(parseStreamFilterCookie("\tLTS\n,\nbeta\t")).toEqual(["LTS", "beta"]);
  });

  test("drops unknown values silently", () => {
    expect(parseStreamFilterCookie("LTS,bogus,Update/Supported")).toEqual([
      "LTS",
      "Update/Supported"
    ]);
    expect(parseStreamFilterCookie("garbage")).toEqual([]);
  });

  test("preserves the order the user supplied (no implicit sorting)", () => {
    expect(parseStreamFilterCookie("alpha,LTS")).toEqual(["alpha", "LTS"]);
  });

  test("does not match streams case-insensitively (Unity uses canonical casing)", () => {
    // The DB stores the canonical Unity casings ("LTS", "Update/Supported",
    // "beta", "alpha"). A cookie with "lts" should be rejected so the filter
    // can't accidentally match nothing in production.
    expect(parseStreamFilterCookie("lts")).toEqual([]);
    expect(parseStreamFilterCookie("LTS,UPDATE/SUPPORTED")).toEqual(["LTS"]);
  });

  test("ALL_STREAMS contains exactly the four supported streams", () => {
    // Guards against accidentally introducing a fifth stream without
    // updating the sidebar UI / repo-side filters.
    expect([...ALL_STREAMS].sort()).toEqual(["LTS", "Update/Supported", "alpha", "beta"]);
  });
});

describe("streamMatches", () => {
  const allowed: StreamName[] = ["LTS", "Update/Supported"];

  test("matches when the row's stream is in the allowed list", () => {
    expect(streamMatches("LTS", allowed)).toBe(true);
    expect(streamMatches("Update/Supported", allowed)).toBe(true);
  });

  test("rejects streams outside the allowed list", () => {
    expect(streamMatches("beta", allowed)).toBe(false);
    expect(streamMatches("alpha", allowed)).toBe(false);
  });

  test("rejects null or empty streams (cannot prove they belong)", () => {
    expect(streamMatches(null, allowed)).toBe(false);
    expect(streamMatches("", allowed)).toBe(false);
  });

  test("rejects every stream when the allowed list is empty (sidebar all-unchecked)", () => {
    for (const s of ALL_STREAMS) {
      expect(streamMatches(s, [])).toBe(false);
    }
    expect(streamMatches(null, [])).toBe(false);
  });

  test("respects exact casing", () => {
    // Same reasoning as parseStreamFilterCookie — matching needs to be
    // strict so we don't drift from Unity's canonical stream casing.
    expect(streamMatches("lts", allowed)).toBe(false);
    expect(streamMatches("LTS ", allowed)).toBe(false);
  });
});
