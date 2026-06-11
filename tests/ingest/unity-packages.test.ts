import { describe, expect, test } from "vitest";

import {
  UNITY_OFFICIAL_PACKAGES,
  isRegistryFrozen
} from "../../src/lib/ingest/unity-packages";

describe("UNITY_OFFICIAL_PACKAGES", () => {
  test("includes current Unity AI and Muse packages", () => {
    expect(UNITY_OFFICIAL_PACKAGES).toEqual(
      expect.arrayContaining([
        "com.unity.ai.assistant",
        "com.unity.ai.generators",
        "com.unity.ai.inference",
        "com.unity.ai.toolkit",
        "com.unity.muse.animate",
        "com.unity.muse.behavior",
        "com.unity.muse.chat",
        "com.unity.muse.common",
        "com.unity.muse.sprite",
        "com.unity.muse.texture"
      ])
    );
  });

  test("does not contain duplicate package names", () => {
    expect(new Set(UNITY_OFFICIAL_PACKAGES).size).toBe(UNITY_OFFICIAL_PACKAGES.length);
  });

  test("uses the registry-valid ids, not the names that 404", () => {
    // Corrected names that actually resolve at packages.unity.com.
    expect(UNITY_OFFICIAL_PACKAGES).toEqual(
      expect.arrayContaining([
        "com.unity.services.cloudsave",
        "com.unity.remote-config",
        "com.unity.learn.iet-framework"
      ])
    );
    // The ids that 404 must not linger in the curated list.
    for (const dead of [
      "com.unity.services.cloud-save",
      "com.unity.services.remote-config",
      "com.unity.tutorials.core"
    ]) {
      expect(UNITY_OFFICIAL_PACKAGES).not.toContain(dead);
    }
  });

  test("drops packages that became built-in/bundled in Unity 6", () => {
    for (const builtIn of [
      "com.unity.2d.sprite",
      "com.unity.2d.tilemap",
      "com.unity.render-pipelines.universal-config"
    ]) {
      expect(UNITY_OFFICIAL_PACKAGES).not.toContain(builtIn);
    }
  });
});

describe("isRegistryFrozen", () => {
  test("flags registry releases published before Unity 6 GA", () => {
    // URP's frozen registry "latest" (10.10.1) is from 2022.
    expect(isRegistryFrozen("2022-10-13T13:04:37.000Z")).toBe(true);
    expect(isRegistryFrozen("2024-09-05T00:00:00.000Z")).toBe(true);
  });

  test("does not flag releases at/after the cutoff", () => {
    expect(isRegistryFrozen("2024-10-01T00:00:00.000Z")).toBe(false);
    expect(isRegistryFrozen("2025-03-01T00:00:00.000Z")).toBe(false);
  });

  test("treats missing/invalid dates as not frozen", () => {
    expect(isRegistryFrozen(null)).toBe(false);
    expect(isRegistryFrozen(undefined)).toBe(false);
    expect(isRegistryFrozen("not-a-date")).toBe(false);
  });
});
