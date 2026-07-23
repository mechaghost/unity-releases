import { describe, expect, test } from "vitest";
import {
  apiStreamToUnityStream,
  compareUnityVersions,
  isUnity6OrNewer,
  parseUnityVersion
} from "../../src/lib/parsers/version";

describe("parseUnityVersion", () => {
  test("parses a Unity 6 LTS final release", () => {
    expect(parseUnityVersion("6000.3.14f1")).toEqual({
      raw: "6000.3.14f1",
      major: 6000,
      minor: 3,
      patch: 14,
      suffixChannel: "f",
      suffixNumber: 1,
      majorLine: "6000",
      minorLine: "6000.3",
      stream: "LTS",
      isPrerelease: false
    });
  });

  test("classifies known LTS minor lines for Unity 6", () => {
    expect(parseUnityVersion("6000.0.59f1").stream).toBe("LTS");
    expect(parseUnityVersion("6000.3.14f1").stream).toBe("LTS");
    expect(parseUnityVersion("6000.7.0f1").stream).toBe("LTS");
  });

  test("classifies in-between minor lines as Update/Supported", () => {
    expect(parseUnityVersion("6000.1.5f1").stream).toBe("Update/Supported");
    expect(parseUnityVersion("6000.2.41f1").stream).toBe("Update/Supported");
    expect(parseUnityVersion("6000.4.5f1").stream).toBe("Update/Supported");
    expect(parseUnityVersion("6000.5.10f1").stream).toBe("Update/Supported");
    expect(parseUnityVersion("6000.6.2f1").stream).toBe("Update/Supported");
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

  test("accepts a future generation", () => {
    expect(isUnity6OrNewer("7000.0.0f1")).toBe(true);
  });

  test("rejects legacy Unity versions", () => {
    expect(isUnity6OrNewer("2022.3.60f1")).toBe(false);
  });
});

describe("apiStreamToUnityStream", () => {
  test("maps Unity's release-API vocabulary onto our stream names", () => {
    expect(apiStreamToUnityStream("LTS")).toBe("LTS");
    expect(apiStreamToUnityStream("SUPPORTED")).toBe("Update/Supported");
    expect(apiStreamToUnityStream("BETA")).toBe("beta");
    expect(apiStreamToUnityStream("ALPHA")).toBe("alpha");
  });

  test("is tolerant of case and padding", () => {
    expect(apiStreamToUnityStream(" lts ")).toBe("LTS");
  });

  test("returns null for anything unrecognised so callers fall back", () => {
    expect(apiStreamToUnityStream("TECH")).toBeNull();
    expect(apiStreamToUnityStream("")).toBeNull();
    expect(apiStreamToUnityStream(null)).toBeNull();
    expect(apiStreamToUnityStream(undefined)).toBeNull();
  });
});

/**
 * The automation that keeps a new LTS line from needing a code edit: Unity's
 * release API reports the stream per release, and final builds defer to it.
 */
describe("parseUnityVersion with an authoritative apiStream", () => {
  test("classifies a future generation's LTS line with no entry in the fallback map", () => {
    // 7000 is deliberately absent from LTS_MINOR_LINES_BY_MAJOR. Without the
    // API stream this is "Update/Supported"; with it, Unity's answer wins.
    expect(parseUnityVersion("7000.0.0f1").stream).toBe("Update/Supported");
    expect(parseUnityVersion("7000.0.0f1", { apiStream: "LTS" }).stream).toBe("LTS");
  });

  test("a line demoted by Unity is reported as Supported even if the map says LTS", () => {
    expect(parseUnityVersion("6000.3.20f1").stream).toBe("LTS");
    expect(parseUnityVersion("6000.3.20f1", { apiStream: "SUPPORTED" }).stream).toBe(
      "Update/Supported"
    );
  });

  test("prerelease and patch channels stay channel-derived", () => {
    // Unity reports 6000.7.0a2 under stream=ALPHA; the channel already says so.
    expect(parseUnityVersion("6000.7.0a2", { apiStream: "ALPHA" }).stream).toBe("alpha");
    expect(parseUnityVersion("6000.6.0b5", { apiStream: "BETA" }).stream).toBe("beta");
    // Unity files patch builds under their line's stream, but reclassifying a
    // `p` build as LTS would move existing rows between stream filters.
    expect(parseUnityVersion("2022.3.20p1", { apiStream: "LTS" }).stream).toBe("patch");
  });

  test("an inconsistent prerelease stream on a final build falls back to the map", () => {
    expect(parseUnityVersion("6000.3.20f1", { apiStream: "BETA" }).stream).toBe("LTS");
    expect(parseUnityVersion("6000.4.12f1", { apiStream: "BETA" }).stream).toBe(
      "Update/Supported"
    );
  });

  test("an unrecognised or absent stream falls back to the map", () => {
    // The release *page* payload tags LTS builds "TECH" - that vocabulary
    // must never be trusted over the curated map.
    expect(parseUnityVersion("6000.3.20f1", { apiStream: "TECH" }).stream).toBe("LTS");
    expect(parseUnityVersion("6000.0.80f1", { apiStream: null }).stream).toBe("LTS");
  });
});
