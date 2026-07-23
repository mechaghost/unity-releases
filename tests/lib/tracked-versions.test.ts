import { describe, expect, test } from "vitest";
import { describeGeneration, groupTrackedLines } from "../../src/lib/tracked-versions";

const row = (minorLine: string, stream: string, latestVersion = `${minorLine}.0f1`) => ({
  minorLine,
  latestVersion,
  stream,
  releaseCount: 1
});

describe("groupTrackedLines", () => {
  test("groups by major, newest generation and newest line first", () => {
    const groups = groupTrackedLines([
      row("6000.0", "LTS"),
      row("2022.3", "LTS"),
      row("6000.7", "LTS"),
      row("6000.4", "Update/Supported"),
      row("2019.4", "LTS")
    ]);

    expect(groups.map((g) => g.major)).toEqual([6000, 2022, 2019]);
    expect(groups[0].lines.map((l) => l.minorLine)).toEqual(["6000.7", "6000.4", "6000.0"]);
  });

  test("labels a future generation without a code change", () => {
    const groups = groupTrackedLines([row("7000.0", "LTS"), row("6000.7", "LTS")]);

    expect(groups.map((g) => g.label)).toEqual(["Unity 7", "Unity 6"]);
    expect(groups.every((g) => g.isModern)).toBe(true);
  });

  test("separates modern generations from the legacy year lines", () => {
    const groups = groupTrackedLines([row("6000.0", "LTS"), row("2022.3", "LTS")]);

    expect(groups.find((g) => g.major === 6000)?.isModern).toBe(true);
    expect(groups.find((g) => g.major === 2022)?.isModern).toBe(false);
    expect(groups.find((g) => g.major === 2022)?.label).toBe("Unity 2022 LTS");
  });

  test("marks LTS lines from the stored stream", () => {
    const groups = groupTrackedLines([row("6000.7", "LTS"), row("6000.5", "Update/Supported")]);
    const lines = groups[0].lines;

    expect(lines.find((l) => l.minorLine === "6000.7")?.isLts).toBe(true);
    expect(lines.find((l) => l.minorLine === "6000.5")?.isLts).toBe(false);
  });

  test("sorts minors numerically, not lexically", () => {
    const groups = groupTrackedLines([row("6000.2", "LTS"), row("6000.10", "LTS")]);
    expect(groups[0].lines.map((l) => l.minorLine)).toEqual(["6000.10", "6000.2"]);
  });

  test("drops malformed rows rather than rendering 'Unity NaN'", () => {
    const groups = groupTrackedLines([
      row("6000.0", "LTS"),
      row("garbage", "LTS"),
      row("6000", "LTS"),
      row("6000.0.1", "LTS")
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].lines.map((l) => l.minorLine)).toEqual(["6000.0"]);
  });

  test("empty input yields no groups", () => {
    expect(groupTrackedLines([])).toEqual([]);
  });
});

describe("describeGeneration", () => {
  test("lists LTS lines before supported ones", () => {
    const [generation] = groupTrackedLines([
      row("6000.0", "LTS"),
      row("6000.7", "LTS"),
      row("6000.5", "Update/Supported"),
      row("6000.4", "Update/Supported")
    ]);

    expect(describeGeneration(generation)).toBe(
      "6000.7, 6000.0 (LTS) · 6000.5, 6000.4 (Supported)"
    );
  });

  test("omits a bucket with no lines", () => {
    const [ltsOnly] = groupTrackedLines([row("2022.3", "LTS")]);
    expect(describeGeneration(ltsOnly)).toBe("2022.3 (LTS)");
  });

  test("a line with only alphas/betas is pre-release, not Supported", () => {
    // 6000.7 was exactly this for months - calling it "Supported" would tell
    // a reader it was shippable.
    const [generation] = groupTrackedLines([
      row("6000.7", "alpha", "6000.7.0a2"),
      row("6000.6", "beta", "6000.6.0b5"),
      row("6000.0", "LTS")
    ]);

    expect(describeGeneration(generation)).toBe("6000.0 (LTS) · 6000.7, 6000.6 (pre-release)");
  });
});
