import { describe, expect, test } from "vitest";
import { cleanFacetValues, isJunkFacetValue } from "../../src/lib/facet-hygiene";

describe("isJunkFacetValue", () => {
  test("drops the parser leakage observed in the production Area facet", () => {
    // Every one of these appeared as a real <option> on /explorer.
    const junk = [
      "done",
      "Error",
      "library",
      "visibility",
      "UIT-1233",
      "`UTR`veRef=[1/2/3]",
      "6000.0.55f1,6000.3.0a4",
      "6000.0.55f1",
      "N/A (internal)",
      "N/A \\(internal\\)",
      "com.unity.render-pipelines.universal",
      "com.unity.toolchain.win-x86_64-linux-x86_64"
    ];
    for (const value of junk) {
      expect(isJunkFacetValue(value), value).toBe(true);
    }
  });

  test("keeps real areas and platforms, including short and digit-led ones", () => {
    const legit = [
      "2D",
      "AI",
      "Graphics",
      "Input",
      "IL2CPP",
      "uGUI",
      "Version Control",
      "HDRP",
      "HD RP",
      "macOS",
      "Android",
      "WebGL",
      "Physics 2D"
    ];
    for (const value of legit) {
      expect(isJunkFacetValue(value), value).toBe(false);
    }
  });
});

describe("cleanFacetValues", () => {
  test("dedupes case variants keeping the first (most frequent) spelling", () => {
    // Callers pass most-frequent-first; ShaderGraph outranks Shadergraph
    // here so the kept option is the one matching the most rows.
    expect(cleanFacetValues(["ShaderGraph", "Shadergraph", "MacOS", "macOS"])).toEqual([
      "MacOS",
      "ShaderGraph"
    ]);
  });

  test("does not fold values that differ by more than case", () => {
    // Search matches stored values exactly - folding "HD RP" into "HDRP"
    // would make the minority spelling's rows unreachable from the facet.
    expect(cleanFacetValues(["HDRP", "HD RP"])).toEqual(["HD RP", "HDRP"]);
  });

  test("filters junk, trims, and A-Z sorts for dropdown display", () => {
    expect(
      cleanFacetValues([
        "Graphics",
        "done",
        " Android ",
        "com.unity.burst",
        "2D",
        "6000.0.55f1,6000.3.0a4"
      ])
    ).toEqual(["2D", "Android", "Graphics"]);
  });
});
