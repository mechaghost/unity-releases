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

  test("does not mark crash fixes as active blockers", () => {
    const impact = classifyImpact("Fixes", "WebGL: Fixed crash when entering play mode");

    expect(impact).toBe("fix");
    expect(classifyRisk("Fixes", impact, "WebGL: Fixed crash when entering play mode")).toBe("info");
  });
});
