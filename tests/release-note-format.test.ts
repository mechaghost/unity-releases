import { describe, expect, test } from "vitest";
import {
  cleanReleaseNoteText,
  issueTrackerSearchUrl,
  normalizeIssueLinks,
  parseAreaVersionList,
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

  test("unescapes the full markdown-escapable set, not just parens", () => {
    // All three shapes were rendering literally on production pages.
    expect(cleanReleaseNoteText("Assert gPersistentManager \\!= NULL on exit")).toBe(
      "Assert gPersistentManager != NULL on exit"
    );
    expect(cleanReleaseNoteText("\\[WebGPU\\] Fixed a crash when resizing the swapchain")).toBe(
      "[WebGPU] Fixed a crash when resizing the swapchain"
    );
    expect(cleanReleaseNoteText("Crash in demangling\\_unexpected\\_handler")).toBe(
      "Crash in demangling_unexpected_handler"
    );
  });

  test("keeps escaped emphasis literal instead of stripping it as markdown", () => {
    // Unescaping must run AFTER the emphasis strip - `\*ptr\*` means a
    // literal asterisk, not italics to remove.
    expect(cleanReleaseNoteText("Dereferencing \\*ptr\\* crashes il2cpp")).toBe(
      "Dereferencing *ptr* crashes il2cpp"
    );
  });

  test("decodes HTML entities, including the double-encoded arrow", () => {
    expect(cleanReleaseNoteText("Project Settings -&gt; Physics resets values")).toBe(
      "Project Settings -> Physics resets values"
    );
    expect(cleanReleaseNoteText("Project Settings -&amp;gt; Physics resets values")).toBe(
      "Project Settings -> Physics resets values"
    );
    expect(cleanReleaseNoteText("Templates use &quot;2D Mobile&quot; &amp; &#39;3D&#39;")).toBe(
      "Templates use \"2D Mobile\" & '3D'"
    );
  });

  test("normalizes issue tracker links into compact UUM links", () => {
    expect(
      normalizeIssueLinks(
        ["UUM-141061"],
        [{ id: "UUM-141061", url: "https://issuetracker.unity3d.com/issues/crash-on-tlsf-free" }]
      )
    ).toEqual([{ id: "UUM-141061", url: "https://issuetracker.unity3d.com/issues/crash-on-tlsf-free" }]);
  });

  test("decodes the numeric arrow entity Unity uses as the version separator", () => {
    // Every "Package updates" row on a release-detail page rendered a
    // literal `10.1.0 &#x2192; 10.1.1` because only NAMED entities were
    // decoded (86 occurrences on /releases/6000.0.0b11 alone).
    expect(
      cleanReleaseNoteText(
        "[10.1.0](https://docs.unity3d.com/x) &#x2192; [10.1.1](https://docs.unity3d.com/y)"
      )
    ).toBe("10.1.0 → 10.1.1");
  });

  test("decodes decimal numeric entities and double-encoded forms", () => {
    expect(cleanReleaseNoteText("a &#8594; b")).toBe("a → b");
    // `&amp;` collapses first, so `&amp;#x2192;` resolves in one pass.
    expect(cleanReleaseNoteText("a &amp;#x2192; b")).toBe("a → b");
  });

  test("leaves control-character entities as literal text", () => {
    // A stray `&#0;`/`&#8;` must not inject an invisible control char into
    // a body that feeds search indexing and the markdown export.
    expect(cleanReleaseNoteText("null byte &#0; here")).toBe("null byte &#0; here");
    expect(cleanReleaseNoteText("backspace &#8; here")).toBe("backspace &#8; here");
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

describe("parseAreaVersionList", () => {
  test("returns the version list when the area is purely versions + commas", () => {
    expect(parseAreaVersionList("6000.6.0a2,6000.4.4f1,6000.5.0b5")).toEqual([
      "6000.6.0a2",
      "6000.4.4f1",
      "6000.5.0b5"
    ]);
  });

  test("tolerates whitespace around commas", () => {
    expect(parseAreaVersionList("6000.6.0a2 , 6000.4.4f1 ,6000.5.0b5")).toEqual([
      "6000.6.0a2",
      "6000.4.4f1",
      "6000.5.0b5"
    ]);
  });

  test("returns null when there's only one version (caller renders normal pill)", () => {
    expect(parseAreaVersionList("6000.3.15f1")).toBeNull();
  });

  test("returns null when any segment isn't a version", () => {
    expect(parseAreaVersionList("Asset Pipeline,Editor")).toBeNull();
    expect(parseAreaVersionList("6000.6.0a2,Editor")).toBeNull();
    expect(parseAreaVersionList("Editor")).toBeNull();
  });

  test("returns null on empty or missing input", () => {
    expect(parseAreaVersionList(null)).toBeNull();
    expect(parseAreaVersionList(undefined)).toBeNull();
    expect(parseAreaVersionList("")).toBeNull();
    expect(parseAreaVersionList("   ")).toBeNull();
  });
});
