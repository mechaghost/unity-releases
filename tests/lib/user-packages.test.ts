import { describe, expect, test } from "vitest";
import { parseManifestInput } from "../../src/lib/user-packages";

describe("parseManifestInput", () => {
  test("returns an empty list for empty input", () => {
    expect(parseManifestInput("")).toEqual([]);
    expect(parseManifestInput("   ")).toEqual([]);
  });

  test("parses a full Packages/manifest.json", () => {
    const manifest = JSON.stringify({
      dependencies: {
        "com.unity.inputsystem": "1.10.0",
        "com.unity.cinemachine": "3.1.4",
        "com.unity.render-pipelines.universal": "17.0.4"
      },
      scopedRegistries: []
    });
    expect(parseManifestInput(manifest)).toEqual([
      "com.unity.cinemachine",
      "com.unity.inputsystem",
      "com.unity.render-pipelines.universal"
    ]);
  });

  test("parses a bare dependencies object", () => {
    expect(parseManifestInput(JSON.stringify({ "com.unity.a": "1.0.0", "com.unity.b": "2.0.0" }))).toEqual(
      ["com.unity.a", "com.unity.b"]
    );
  });

  test("falls back to whitespace/comma-separated lists", () => {
    expect(parseManifestInput("com.unity.inputsystem, com.unity.cinemachine")).toEqual([
      "com.unity.cinemachine",
      "com.unity.inputsystem"
    ]);
    expect(parseManifestInput("com.unity.a\ncom.unity.b\n  com.unity.c")).toEqual([
      "com.unity.a",
      "com.unity.b",
      "com.unity.c"
    ]);
    expect(parseManifestInput("com.unity.a;com.unity.b")).toEqual(["com.unity.a", "com.unity.b"]);
  });

  test("dedups identical entries", () => {
    expect(parseManifestInput("com.unity.a, com.unity.a, com.unity.b")).toEqual([
      "com.unity.a",
      "com.unity.b"
    ]);
  });

  test("rejects entries that don't look like Unity package ids", () => {
    expect(parseManifestInput("notapackage,foo,bar")).toEqual([]);
    expect(parseManifestInput("com.unity.a, banana, com.unity.b")).toEqual([
      "com.unity.a",
      "com.unity.b"
    ]);
  });

  test("survives a malformed JSON blob without crashing (falls back to text)", () => {
    expect(parseManifestInput('{ "dependencies": { broken json },, com.unity.a')).toEqual([
      "com.unity.a"
    ]);
  });

  test("returns a sorted result (stable for snapshot tests)", () => {
    expect(parseManifestInput("com.unity.zeta, com.unity.alpha, com.unity.beta")).toEqual([
      "com.unity.alpha",
      "com.unity.beta",
      "com.unity.zeta"
    ]);
  });
});
