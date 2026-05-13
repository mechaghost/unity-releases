import { describe, expect, test } from "vitest";

import {
  majorLabel,
  majorOf,
  parseMajorParam,
  resolveActiveMajor,
  uniqueMajorsDesc
} from "../../src/lib/issue-page-scope";

describe("majorOf", () => {
  test("extracts the numeric major from a Unity editor version", () => {
    expect(majorOf("6000.0.74f1")).toBe(6000);
    expect(majorOf("2022.3.50f1")).toBe(2022);
    expect(majorOf("2019.4.40f1")).toBe(2019);
  });

  test("returns null for strings without a dot or with a non-numeric major", () => {
    expect(majorOf("nope")).toBeNull();
    expect(majorOf("v6000.0.74f1")).toBeNull();
    expect(majorOf("")).toBeNull();
  });
});

describe("uniqueMajorsDesc", () => {
  test("de-dupes and sorts majors descending so Unity 6 leads", () => {
    expect(uniqueMajorsDesc([2022, 6000, 2019, 6000, 2022])).toEqual([6000, 2022, 2019]);
  });

  test("returns an empty array unchanged", () => {
    expect(uniqueMajorsDesc([])).toEqual([]);
  });
});

describe("majorLabel", () => {
  test("renders 6000 as 'Unity 6' and legacy majors as LTS lines", () => {
    expect(majorLabel(6000)).toBe("Unity 6");
    expect(majorLabel(2022)).toBe("Unity 2022 LTS");
    expect(majorLabel(2019)).toBe("Unity 2019 LTS");
  });
});

describe("parseMajorParam", () => {
  test("accepts a numeric string", () => {
    expect(parseMajorParam("2022")).toBe(2022);
    expect(parseMajorParam("6000")).toBe(6000);
  });

  test("picks the first element of an array form (Next.js can deliver either)", () => {
    expect(parseMajorParam(["2022", "6000"])).toBe(2022);
  });

  test("returns null for empty / missing / non-numeric input", () => {
    expect(parseMajorParam(undefined)).toBeNull();
    expect(parseMajorParam("")).toBeNull();
    expect(parseMajorParam("abc")).toBeNull();
    expect(parseMajorParam([])).toBeNull();
  });
});

describe("resolveActiveMajor", () => {
  test("returns the requested major when it matches an available chip", () => {
    expect(resolveActiveMajor(2022, [6000, 2022, 2019])).toBe(2022);
  });

  test("self-corrects to null (all) when the requested major isn't a rendered chip", () => {
    // Regression guard: a hand-typed `?major=9999` URL must NOT silently
    // filter every result out — it should fall back to the "All" chip
    // so the page still shows the issue's mention history.
    expect(resolveActiveMajor(9999, [6000, 2022])).toBeNull();
  });

  test("returns null when no major was requested", () => {
    expect(resolveActiveMajor(null, [6000, 2022])).toBeNull();
  });
});
