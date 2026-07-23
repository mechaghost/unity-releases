import { describe, expect, test } from "vitest";
import {
  isNewerVersion,
  earlierUnityRange,
  editorPrereleaseLabel
} from "../../src/lib/version-compare";

describe("isNewerVersion", () => {
  test("true unified versioning (registry on an older line)", () => {
    expect(isNewerVersion("6.4.0", "1.4.7")).toBe(true);
    expect(isNewerVersion("6.4.0", "2.6.7")).toBe(true);
  });
  test("not newer when the registry is already ahead or equal", () => {
    expect(isNewerVersion("6.3.5", "6.6.0-pre.2")).toBe(false); // AR Foundation
    expect(isNewerVersion("6.1.0", "15.0.0")).toBe(false); // own historical 6.1
    expect(isNewerVersion("6.4.0", "6.4.0")).toBe(false);
  });
  test("ignores prerelease suffixes", () => {
    expect(isNewerVersion("6.4.0", "6.4.0-pre.1")).toBe(false);
    expect(isNewerVersion("6.5.0", "6.4.9-pre.3")).toBe(true);
  });
  test("missing inputs are not newer", () => {
    expect(isNewerVersion(null, "1.0.0")).toBe(false);
    expect(isNewerVersion("1.0.0", undefined)).toBe(false);
  });
});

describe("earlierUnityRange", () => {
  test("formats the span of earlier minors", () => {
    expect(earlierUnityRange("6.4")).toBe("6.0–6.3");
    expect(earlierUnityRange("6.2")).toBe("6.0–6.1");
    expect(earlierUnityRange("6.1")).toBe("6.0");
  });
  test("works the same in a later generation", () => {
    expect(earlierUnityRange("7.3")).toBe("7.0–7.2");
    expect(earlierUnityRange("7.1")).toBe("7.0");
  });
  test("boundary and garbage compose with the caller's 'Unity ' prefix", () => {
    // /packages renders `Unity {earlierUnityRange(...)}`, so no branch may
    // repeat the word Unity - "Unity earlier Unity 6" was the old output.
    expect(earlierUnityRange("6.0")).toBe("before 6.0");
    expect(earlierUnityRange("7.0")).toBe("before 7.0");
    expect(earlierUnityRange("garbage")).toBe("earlier releases");
  });
});

describe("editorPrereleaseLabel", () => {
  test("classifies the editor channel", () => {
    expect(editorPrereleaseLabel("6000.5.0b10")).toBe("beta");
    expect(editorPrereleaseLabel("6000.6.0a7")).toBe("alpha");
    expect(editorPrereleaseLabel("6000.0.23f1")).toBeNull(); // final
    expect(editorPrereleaseLabel("6000.0.45p1")).toBeNull(); // patch
    expect(editorPrereleaseLabel(null)).toBeNull();
  });
});
