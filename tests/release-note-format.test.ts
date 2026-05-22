import { describe, expect, test } from "vitest";
import {
  cleanReleaseNoteText,
  issueTrackerSearchUrl,
  normalizeIssueLinks,
  tokenizeReleaseNoteBody
} from "../src/lib/release-notes/format";

describe("release note formatting", () => {
  test("removes markdown links, break tags, emphasis, and escaped punctuation", () => {
    expect(
      cleanReleaseNoteText(
        "Crash on tlsf_free ([UUM-141061](https://issuetracker.unity3d.com/issues/crash-on-tlsf-free)) <br>*Fixed in 6000.5.0b7.*"
      )
    ).toBe("Crash on tlsf_free (UUM-141061) Fixed in 6000.5.0b7.");
  });

  test("removes stray leading punctuation from parsed release notes", () => {
    expect(cleanReleaseNoteText(": Crash on core::base_hash_set (UUM-139722)")).toBe(
      "Crash on core::base_hash_set"
    );
  });

  test("strips trailing (UUM-XXX) suffixes since the issue chip already shows them", () => {
    expect(
      cleanReleaseNoteText("Fixed crash when using UIElements in URP with Vulkan. (UUM-100171)")
    ).toBe("Fixed crash when using UIElements in URP with Vulkan.");
  });

  test("strips trailing parenthesised lists of issue ids", () => {
    expect(
      cleanReleaseNoteText("Editor freezes when opening project (UUM-12345, UUM-67890)")
    ).toBe("Editor freezes when opening project");
  });

  test("normalizes issue tracker links into compact UUM links", () => {
    expect(
      normalizeIssueLinks(
        ["UUM-141061"],
        [{ id: "UUM-141061", url: "https://issuetracker.unity3d.com/issues/crash-on-tlsf-free" }]
      )
    ).toEqual([{ id: "UUM-141061", url: "https://issuetracker.unity3d.com/issues/crash-on-tlsf-free" }]);
  });

  test("falls back to issue tracker search for issue ids without parsed urls", () => {
    expect(issueTrackerSearchUrl("UUM-136929")).toBe(
      "https://issuetracker.unity3d.com/issues?search=UUM-136929"
    );
  });
});

describe("tokenizeReleaseNoteBody", () => {
  test("returns a single text token when no Unity version is present", () => {
    expect(tokenizeReleaseNoteBody("Crash on tlsf_free when loading a scene")).toEqual([
      { kind: "text", value: "Crash on tlsf_free when loading a scene" }
    ]);
  });

  test("returns an empty list for empty input", () => {
    expect(tokenizeReleaseNoteBody("")).toEqual([]);
  });

  test("splits a single inline version mention into text + version + text", () => {
    expect(
      tokenizeReleaseNoteBody("Fixed in 6000.5.0b7.")
    ).toEqual([
      { kind: "text", value: "Fixed in " },
      { kind: "version", version: "6000.5.0b7" },
      { kind: "text", value: "." }
    ]);
  });

  test("captures multiple inline mentions in order", () => {
    const result = tokenizeReleaseNoteBody(
      "Regressed in 6000.3.0b1, fixed in 6000.3.15f1, backported to 2022.3.55f1."
    );
    expect(result).toEqual([
      { kind: "text", value: "Regressed in " },
      { kind: "version", version: "6000.3.0b1" },
      { kind: "text", value: ", fixed in " },
      { kind: "version", version: "6000.3.15f1" },
      { kind: "text", value: ", backported to " },
      { kind: "version", version: "2022.3.55f1" },
      { kind: "text", value: "." }
    ]);
  });

  test("handles a version at the start or end of the body", () => {
    expect(tokenizeReleaseNoteBody("6000.3.15f1 fixes the crash")).toEqual([
      { kind: "version", version: "6000.3.15f1" },
      { kind: "text", value: " fixes the crash" }
    ]);
    expect(tokenizeReleaseNoteBody("Originally regressed in 6000.5.0a9")).toEqual([
      { kind: "text", value: "Originally regressed in " },
      { kind: "version", version: "6000.5.0a9" }
    ]);
  });

  test("matches alpha, beta, final, and patch channels", () => {
    const tokens = tokenizeReleaseNoteBody(
      "Affects 6000.5.0a9 6000.5.0b7 6000.3.15f1 2017.4.30p1"
    );
    const versions = tokens
      .filter((t): t is { kind: "version"; version: string } => t.kind === "version")
      .map((t) => t.version);
    expect(versions).toEqual([
      "6000.5.0a9",
      "6000.5.0b7",
      "6000.3.15f1",
      "2017.4.30p1"
    ]);
  });

  test("ignores numeric strings that aren't Unity-version-shaped", () => {
    // IP addresses have 4 dotted groups and no channel letter, so the
    // regex's `[abfp]<digits>` tail rejects them. Same for arbitrary
    // floats / decimals.
    expect(tokenizeReleaseNoteBody("Hit 192.168.1.1 in the test")).toEqual([
      { kind: "text", value: "Hit 192.168.1.1 in the test" }
    ]);
    expect(tokenizeReleaseNoteBody("Saw 1.2.3 release tag")).toEqual([
      { kind: "text", value: "Saw 1.2.3 release tag" }
    ]);
    expect(tokenizeReleaseNoteBody("CPU at 3.14.15g9 idle")).toEqual([
      // g isn't a valid channel letter
      { kind: "text", value: "CPU at 3.14.15g9 idle" }
    ]);
  });

  test("round-trips back to the original cleaned body when concatenated", () => {
    const body = "Regressed in 6000.3.0b1, fixed in 6000.3.15f1, edge case in 2022.3.55f1!";
    const tokens = tokenizeReleaseNoteBody(body);
    const rejoined = tokens
      .map((t) => (t.kind === "text" ? t.value : t.version))
      .join("");
    expect(rejoined).toBe(body);
  });
});
