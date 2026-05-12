import { describe, expect, test } from "vitest";
import { classifyImpact, classifyRisk, extractArea, stripAreaPrefix } from "../src/lib/classification";

describe("Unity release note classification", () => {
  test("does not treat first-seen version prefixes as Unity areas", () => {
    const body = "6000.0.61f1: Crash on tlsf_free when generating Font Atlas";

    expect(extractArea(body)).toBeNull();
    expect(stripAreaPrefix(body)).toBe(body);
  });

  test("recognizes Unity package update section labels", () => {
    expect(classifyImpact("Packages updated", "Package com.unity.inputsystem updated to 1.19.0")).toBe(
      "package_change"
    );
  });

  test("elevates crash fixes to review but never to blocker", () => {
    // Fixes that resolve a crash / data loss / corruption are higher-signal
    // than ordinary fixes; they should land in the upgrade-review lane
    // (`review`) so an upgrader can see what was un-broken in this version.
    // They must NOT escalate further to `blocker` — blocker is reserved
    // for active known issues, not "issue we just fixed."
    const body = "WebGL: Fixed crash when entering play mode";
    const impact = classifyImpact("Fixes", body);

    expect(impact).toBe("fix");
    expect(classifyRisk("Fixes", impact, body)).toBe("review");
  });

  test("leaves ordinary fixes at info risk", () => {
    const body = "Editor: Tweaked an icon size in the inspector header.";
    const impact = classifyImpact("Fixes", body);

    expect(impact).toBe("fix");
    expect(classifyRisk("Fixes", impact, body)).toBe("info");
  });

  test("classifies improvements, features, and changes sections", () => {
    expect(classifyImpact("Improvements", "Improved mesh update performance.")).toBe("improvement");
    expect(classifyImpact("Features", "Added support for generalized GPU archetypes.")).toBe("feature");
    expect(classifyImpact("Changes", "Made a setting discoverable in the package manager.")).toBe(
      "change"
    );
  });

  test("escalates Changes section entries that announce deprecation or removal", () => {
    expect(
      classifyImpact("Changes", "Deprecated the legacy converter; users should migrate.")
    ).toBe("breaking_change");
    expect(classifyImpact("Changes", "Removed the obsolete API surface.")).toBe("breaking_change");
  });

  test("does NOT flag cosmetic phrasing as breaking", () => {
    // Trust-killer case from the team review: the loose regex caught
    // "removed an erroneous warning" and similar maintenance lines as
    // breaking_change, drowning the lane in false positives.
    expect(classifyImpact("Changes", "Removed an erroneous warning that fired on macOS.")).toBe(
      "change"
    );
    expect(classifyImpact("Changes", "Removed unused debug logs from the editor.")).toBe("change");
    expect(classifyImpact("Changes", "Removed an outdated comment in the build settings.")).toBe(
      "change"
    );
    expect(classifyImpact("Changes", "Cleanup: removed stale references in the package manifest.")).toBe(
      "change"
    );
  });

  test("flags structural breaking signals in API Changes regardless of denylist", () => {
    expect(classifyImpact("API Changes", "Breaking change: ScriptableObject.Foo no longer returns null.")).toBe(
      "breaking_change"
    );
    expect(classifyImpact("API Changes", "Removed: AssetDatabase.LegacyImport API.")).toBe(
      "breaking_change"
    );
    expect(classifyImpact("API Changes", "Renamed Camera.depthBuffer; no behavior change.")).toBe(
      "api_change"
    );
  });
});
