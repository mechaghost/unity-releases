import { describe, expect, test } from "vitest";
import { classifyDomain, streamsToDbValues, DOMAINS } from "../../src/lib/visualizer";

describe("classifyDomain", () => {
  test("buckets common Unity area labels into their canonical domain", () => {
    expect(classifyDomain("URP")).toBe("Rendering");
    expect(classifyDomain("HDRP")).toBe("Rendering");
    expect(classifyDomain("Shader Graph")).toBe("Rendering");
    expect(classifyDomain("Rendering Pipeline")).toBe("Rendering");
    expect(classifyDomain("VFX Graph")).toBe("Rendering");

    expect(classifyDomain("IL2CPP")).toBe("Scripting");
    expect(classifyDomain("Burst")).toBe("Scripting");
    expect(classifyDomain("DOTS")).toBe("Scripting");
    expect(classifyDomain("Scripting")).toBe("Scripting");

    expect(classifyDomain("Android")).toBe("Mobile");
    expect(classifyDomain("iOS")).toBe("Mobile");

    expect(classifyDomain("XR")).toBe("XR");
    expect(classifyDomain("OpenXR")).toBe("XR");
    expect(classifyDomain("VisionOS")).toBe("XR");

    expect(classifyDomain("Physics")).toBe("Physics");
    expect(classifyDomain("UI Toolkit")).toBe("UI");
    expect(classifyDomain("Netcode for GameObjects")).toBe("Networking");
    expect(classifyDomain("Editor")).toBe("Editor");
    expect(classifyDomain("Audio")).toBe("Audio");
    expect(classifyDomain("Animation")).toBe("Animation");
    expect(classifyDomain("Asset Pipeline")).toBe("Asset Pipeline");
    expect(classifyDomain("Addressables")).toBe("Asset Pipeline");
    expect(classifyDomain("Input System")).toBe("Input");
  });

  test("falls back to Other for unmatched / null areas", () => {
    expect(classifyDomain(null)).toBe("Other");
    expect(classifyDomain(undefined)).toBe("Other");
    expect(classifyDomain("")).toBe("Other");
    expect(classifyDomain("Some random subsystem that does not exist")).toBe("Other");
  });

  test("every DOMAINS entry produces a non-Other result for its canonical seed", () => {
    // Smoke-check the regex set against a representative label per domain
    // so a future edit to DOMAINS doesn't silently drop coverage.
    const seeds: Record<(typeof DOMAINS)[number], string> = {
      Rendering: "Rendering",
      Scripting: "Scripting",
      Mobile: "Android",
      XR: "XR",
      Physics: "Physics",
      UI: "UI Toolkit",
      Networking: "Netcode",
      Editor: "Editor",
      Audio: "Audio",
      Animation: "Animation",
      "Asset Pipeline": "Asset Bundle",
      Input: "Input System"
    };
    for (const d of DOMAINS) {
      expect(classifyDomain(seeds[d])).toBe(d);
    }
  });
});

describe("streamsToDbValues", () => {
  test("returns null for empty / undefined input so callers can branch on it", () => {
    expect(streamsToDbValues(undefined)).toBeNull();
    expect(streamsToDbValues([])).toBeNull();
  });

  test("expands the lts slug to the canonical DB token", () => {
    expect(streamsToDbValues(["lts"])).toEqual(["LTS"]);
  });

  test("expands stable to cover both STABLE and TECH so the slug catches both Unity uses for non-LTS production builds", () => {
    const result = streamsToDbValues(["stable"]);
    expect(result).toEqual(expect.arrayContaining(["STABLE", "TECH"]));
    expect(result).toHaveLength(2);
  });

  test("de-duplicates when a stream maps to overlapping DB values", () => {
    const result = streamsToDbValues(["stable", "stable", "beta"]);
    expect(result).toEqual(expect.arrayContaining(["STABLE", "TECH", "BETA"]));
    expect(new Set(result).size).toBe(result?.length);
  });
});
