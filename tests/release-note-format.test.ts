import { describe, expect, test } from "vitest";
import {
  cleanReleaseNoteText,
  issueTrackerSearchUrl,
  normalizeIssueLinks
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
