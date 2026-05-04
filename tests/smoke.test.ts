import { describe, expect, test } from "vitest";

describe("test runner", () => {
  test("runs a smoke assertion", () => {
    expect("unity-alerts").toContain("unity");
  });
});
