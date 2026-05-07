import { describe, expect, test } from "vitest";

import { UNITY_OFFICIAL_PACKAGES } from "../../src/lib/ingest/unity-packages";

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
});
