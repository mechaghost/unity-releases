import { describe, expect, test } from "vitest";
import {
  compareUnityVersions,
  isUnity6OrNewer,
  parseUnityVersion
} from "../../src/lib/parsers/version";

describe("parseUnityVersion", () => {
  test("parses a Unity 6 final release", () => {
    expect(parseUnityVersion("6000.3.14f1")).toEqual({
      raw: "6000.3.14f1",
      major: 6000,
      minor: 3,
      patch: 14,
      suffixChannel: "f",
      suffixNumber: 1,
      majorLine: "6000",
      minorLine: "6000.3",
      stream: "Update/Supported",
      isPrerelease: false
    });
  });

  test("parses beta and alpha releases as prerelease streams", () => {
    expect(parseUnityVersion("6000.4.0b12").stream).toBe("beta");
    expect(parseUnityVersion("6000.5.0a8").stream).toBe("alpha");
    expect(parseUnityVersion("6000.4.0b12").isPrerelease).toBe(true);
  });

  test("rejects unsupported version strings", () => {
    expect(() => parseUnityVersion("Unity 6")).toThrow("Invalid Unity version");
  });
});

describe("compareUnityVersions", () => {
  test("sorts alpha before beta before final for the same base version", () => {
    const versions = ["6000.4.0f1", "6000.4.0a8", "6000.4.0b12"];

    expect(versions.sort(compareUnityVersions)).toEqual([
      "6000.4.0a8",
      "6000.4.0b12",
      "6000.4.0f1"
    ]);
  });

  test("sorts by major, minor, patch, and suffix number", () => {
    const versions = ["6000.3.14f1", "6000.3.4f1", "6001.0.0a1", "6000.4.0b1"];

    expect(versions.sort(compareUnityVersions)).toEqual([
      "6000.3.4f1",
      "6000.3.14f1",
      "6000.4.0b1",
      "6001.0.0a1"
    ]);
  });
});

describe("isUnity6OrNewer", () => {
  test("accepts Unity 6 and newer versions", () => {
    expect(isUnity6OrNewer("6000.0.1f1")).toBe(true);
    expect(isUnity6OrNewer("6001.0.0a1")).toBe(true);
  });

  test("rejects legacy Unity versions", () => {
    expect(isUnity6OrNewer("2022.3.60f1")).toBe(false);
  });
});
