import { describe, expect, test } from "vitest";
import {
  MODERN_MIN_MAJOR,
  isModernMajor,
  marketingMinor,
  marketingMinorOfEditor,
  modernMajorSql,
  unityGeneration,
  unityMajorLabel
} from "../../src/lib/unity-generation";

describe("isModernMajor", () => {
  test("Unity 6 and every generation after it", () => {
    expect(isModernMajor(6000)).toBe(true);
    expect(isModernMajor(7000)).toBe(true);
    expect(isModernMajor(8000)).toBe(true);
  });

  test("legacy year-based majors are not modern", () => {
    expect(isModernMajor(2019)).toBe(false);
    expect(isModernMajor(2022)).toBe(false);
    expect(isModernMajor(2023)).toBe(false);
  });

  test("MODERN_MIN_MAJOR is the inclusive boundary", () => {
    expect(isModernMajor(MODERN_MIN_MAJOR)).toBe(true);
    expect(isModernMajor(MODERN_MIN_MAJOR - 1)).toBe(false);
  });

  test("non-finite input is not modern", () => {
    expect(isModernMajor(Number.NaN)).toBe(false);
  });
});

describe("unityGeneration", () => {
  test("derives the generation from the major", () => {
    expect(unityGeneration(6000)).toBe(6);
    expect(unityGeneration(7000)).toBe(7);
  });

  test("legacy majors have no generation", () => {
    expect(unityGeneration(2022)).toBeNull();
  });
});

describe("unityMajorLabel", () => {
  test("names modern generations without the raw major", () => {
    expect(unityMajorLabel(6000)).toBe("Unity 6");
    // The bug this guards: the old `major === 6000 ? … : \`Unity ${major} LTS\``
    // rendered "Unity 7000 LTS" for Unity 7.
    expect(unityMajorLabel(7000)).toBe("Unity 7");
  });

  test("legacy majors keep the LTS suffix", () => {
    expect(unityMajorLabel(2022)).toBe("Unity 2022 LTS");
    expect(unityMajorLabel(2019)).toBe("Unity 2019 LTS");
  });
});

describe("marketingMinor", () => {
  test("maps a major/minor pair onto Unity's marketing number", () => {
    expect(marketingMinor(6000, 0)).toBe("6.0");
    expect(marketingMinor(6000, 7)).toBe("6.7");
    expect(marketingMinor(7000, 0)).toBe("7.0");
    expect(marketingMinor(7000, 12)).toBe("7.12");
  });

  test("legacy majors already are their own marketing version", () => {
    expect(marketingMinor(2022, 3)).toBeNull();
  });
});

describe("marketingMinorOfEditor", () => {
  test("reads the docs minor off a full editor version", () => {
    expect(marketingMinorOfEditor("6000.4.11f1")).toBe("6.4");
    expect(marketingMinorOfEditor("6000.0.23f1")).toBe("6.0");
    expect(marketingMinorOfEditor("6000.7.0a2")).toBe("6.7");
    expect(marketingMinorOfEditor("7000.1.0f1")).toBe("7.1");
  });

  test("legacy, empty, and malformed input yield null", () => {
    expect(marketingMinorOfEditor("2022.3.61f1")).toBeNull();
    expect(marketingMinorOfEditor("garbage")).toBeNull();
    expect(marketingMinorOfEditor("")).toBeNull();
    expect(marketingMinorOfEditor(null)).toBeNull();
  });
});

describe("modernMajorSql", () => {
  test("guards the ::int cast behind CASE so a malformed version can't abort the query", () => {
    const sql = modernMajorSql("r.version");
    expect(sql).toContain("CASE WHEN r.version ~ '^[0-9]+\\.'");
    expect(sql).toContain("split_part(r.version, '.', 1)::int");
    expect(sql).toContain(`>= ${MODERN_MIN_MAJOR}`);
    // A bare `AND`-guarded cast is what this replaces: Postgres doesn't
    // promise AND evaluation order, so the cast could still run on garbage.
    expect(sql).not.toMatch(/~\s*'\^\[0-9\]\+\\\.'\s+AND/);
  });

  test("interpolates the caller's column reference", () => {
    expect(modernMajorSql("version")).toContain("split_part(version, '.', 1)");
  });
});
