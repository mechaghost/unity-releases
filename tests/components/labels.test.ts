import { describe, expect, test } from "vitest";
import { impactLabel, IMPACT_LABELS } from "../../src/app/_components/ImpactPill";
import { riskLabel, RISK_LABELS } from "../../src/app/_components/RiskBadge";
import { streamMark } from "../../src/app/_components/VersionPill";
import { isUnityExternalHref } from "../../src/app/_components/ExternalLink";
import { issueTrackerHref } from "../../src/app/_components/IssuePill";

// ─── impactLabel ───────────────────────────────────────────────

describe("impactLabel", () => {
  test("returns the canonical label for every defined impact_kind", () => {
    expect(impactLabel("fix")).toBe("Fix");
    expect(impactLabel("breaking_change")).toBe("Breaking");
    expect(impactLabel("known_issue")).toBe("Known issue");
    expect(impactLabel("api_change")).toBe("API change");
    expect(impactLabel("security_related_fix")).toBe("Security");
    expect(impactLabel("install_risk")).toBe("Install risk");
    expect(impactLabel("package_change")).toBe("Package");
  });

  test("titlecases unknown kinds rather than crashing", () => {
    expect(impactLabel("brand_new_kind")).toBe("Brand New Kind");
  });

  test("falls back to a sensible label for null / undefined", () => {
    // null/undefined trip the value ?? "info" fallback inside impactLabel
    // and titleize lowercases→Title-cases "info" to "Info".
    expect(impactLabel(null)).toBe("Info");
    expect(impactLabel(undefined)).toBe("Info");
  });

  test("returns an empty string for an explicit empty input (no implicit re-default)", () => {
    // `??` only fires on null/undefined, so an empty-string impact reaches
    // titleize("") and produces "". The schema marks impact_kind NOT NULL
    // so this only happens for stub data; capturing the behavior here so a
    // change is intentional.
    expect(impactLabel("")).toBe("");
  });

  test("IMPACT_LABELS includes every kind the schema may produce", () => {
    // Guards against introducing a new impact_kind in classification.ts
    // without giving it a human label.
    for (const key of [
      "fix",
      "improvement",
      "feature",
      "change",
      "api_change",
      "breaking_change",
      "package_change",
      "known_issue",
      "install_risk",
      "platform_risk",
      "security_related_fix",
      "upgrade_blocker",
      "documentation",
      "unknown"
    ]) {
      expect(IMPACT_LABELS).toHaveProperty(key);
    }
  });
});

// ─── riskLabel ─────────────────────────────────────────────────

describe("riskLabel", () => {
  test("maps every risk_level to its canonical label", () => {
    expect(riskLabel("blocker")).toBe("Blocker");
    expect(riskLabel("caution")).toBe("Caution");
    expect(riskLabel("review")).toBe("Review");
    expect(riskLabel("info")).toBe("Info");
  });

  test("falls back to 'Info' for unknown / null / empty values", () => {
    expect(riskLabel(null)).toBe("Info");
    expect(riskLabel("")).toBe("Info");
    expect(riskLabel("nonsense")).toBe("Info");
  });

  test("RISK_LABELS covers every risk_level the schema produces", () => {
    expect(Object.keys(RISK_LABELS).sort()).toEqual(["blocker", "caution", "info", "review"]);
  });
});

// ─── streamMark ────────────────────────────────────────────────

describe("streamMark", () => {
  test("returns the single-letter mark for each Unity stream", () => {
    expect(streamMark("LTS")).toBe("L");
    expect(streamMark("lts")).toBe("L");
    expect(streamMark("beta")).toBe("B");
    expect(streamMark("alpha")).toBe("A");
    expect(streamMark("supported")).toBe("U");
    expect(streamMark("Update/Supported".toLowerCase())).toBe("U"); // "update/supported" not in map
  });

  test("falls back to the first uppercased character for unrecognized streams", () => {
    expect(streamMark("custom-stream")).toBe("C");
    expect(streamMark("z")).toBe("Z");
  });

  test("returns 'U' (the most stable assumption) for null / empty", () => {
    expect(streamMark(null)).toBe("U");
    expect(streamMark(undefined)).toBe("U");
    expect(streamMark("")).toBe("U");
  });
});

// ─── isUnityExternalHref ──────────────────────────────────────

describe("isUnityExternalHref", () => {
  test("matches every Unity-owned host we route to in a new tab", () => {
    expect(isUnityExternalHref("https://unity.com/releases")).toBe(true);
    expect(isUnityExternalHref("https://unity3d.com/some/page")).toBe(true);
    expect(isUnityExternalHref("https://issuetracker.unity3d.com/issues/12345")).toBe(true);
    expect(isUnityExternalHref("https://docs.unity3d.com/Manual/page.html")).toBe(true);
    expect(isUnityExternalHref("https://storage.googleapis.com/foo.md")).toBe(true);
    expect(isUnityExternalHref("https://github.com/Unity-Technologies/repo")).toBe(true);
  });

  test("treats subdomains of recognized hosts as external", () => {
    expect(isUnityExternalHref("https://docs.unity3d.com/Packages/com.unity.x@1.0/manual/index.html")).toBe(
      true
    );
  });

  test("internal site-relative URLs are NOT treated as external", () => {
    expect(isUnityExternalHref("/")).toBe(false);
    expect(isUnityExternalHref("/releases/6000.3.14f1")).toBe(false);
  });

  test("unrelated hosts are NOT treated as Unity-external", () => {
    // The helper is specifically for "is this a Unity-owned host that we
    // should mark with the external-link icon" — non-Unity links don't
    // need the icon even though ExternalLink would still open them in a
    // new tab.
    expect(isUnityExternalHref("https://example.com")).toBe(false);
    expect(isUnityExternalHref("http://localhost:3000")).toBe(false);
  });

  test("malformed URLs fall back to a regex-based heuristic", () => {
    expect(isUnityExternalHref("ftp://unknown")).toBe(false);
    expect(isUnityExternalHref("not a url at all")).toBe(false);
    expect(isUnityExternalHref("")).toBe(false);
  });
});

// ─── issueTrackerHref ─────────────────────────────────────────

describe("issueTrackerHref", () => {
  test("emits a lowercased Unity Issue Tracker URL", () => {
    expect(issueTrackerHref("UUM-12345")).toBe("https://issuetracker.unity3d.com/issues/uum-12345");
    expect(issueTrackerHref("uum-12345")).toBe("https://issuetracker.unity3d.com/issues/uum-12345");
  });

  test("preserves the input shape rather than trying to rewrite the id", () => {
    expect(issueTrackerHref("FOO-1")).toContain("foo-1");
  });
});
