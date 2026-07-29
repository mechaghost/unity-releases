import { describe, expect, test } from "vitest";
import { compareReleaseProjection } from "../../src/jobs/refresh-core-projections";

const base = {
  parsedItemHashes: ["item-a", "item-b"],
  storedItemHashes: ["item-a", "item-b"],
  parsedSections: [{ section: "Fixes", sourceOrder: 0 }],
  storedSections: [{ section: "Fixes", sourceOrder: 0 }],
  parsedPackageChanges: [
    { packageName: "com.unity.inputsystem", toVersion: "1.20.0" }
  ],
  storedPackageChanges: [
    { packageName: "com.unity.inputsystem", toVersion: "1.20.0" }
  ]
};

describe("core projection integrity", () => {
  test("accepts byte-equivalent normalized projections", () => {
    expect(compareReleaseProjection(base)).toEqual({
      notesOrSections: false,
      packageChanges: false
    });
  });

  test("detects note or section drift independently", () => {
    expect(
      compareReleaseProjection({
        ...base,
        storedItemHashes: ["item-a"]
      })
    ).toEqual({
      notesOrSections: true,
      packageChanges: false
    });
  });

  test("detects bundled package-transition drift independently", () => {
    expect(
      compareReleaseProjection({
        ...base,
        storedPackageChanges: []
      })
    ).toEqual({
      notesOrSections: false,
      packageChanges: true
    });
  });
});
