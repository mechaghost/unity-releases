import { describe, expect, test } from "vitest";
import { issueTrackerHref, normalizeIssueTrackerHref } from "../../src/lib/issue-tracker-links";
import { normalizeIssueLinks } from "../../src/lib/release-notes/format";

describe("Unity Issue Tracker links", () => {
  test("uses the browser-verified q parameter, not ignored search parameter", () => {
    expect(issueTrackerHref("uum-142773")).toBe("https://issuetracker.unity.com/?q=UUM-142773");
  });
  test.each([
    "https://issuetracker.unity3d.com/issues?search=UUM-142773",
    "https://issuetracker.unity.com/issues?search=UUM-142773",
    "https://issuetracker.unity.com/?search=UUM-142773",
    "https://ISSUETRACKER.UNITY3D.COM/issues/uum-142773",
    "https://issuetracker.unity.com/issues/UUM-142773/"
  ])("repairs old search and ID URL shapes: %s", url => {
    expect(normalizeIssueTrackerHref(url)).toBe("https://issuetracker.unity.com/?q=UUM-142773");
  });
  test("keeps known source slugs on their original host because the legacy redirect maps changed slugs", () => {
    const source="https://issuetracker.unity3d.com/issues/crash-on-mono-log-write-logfile-when-more-than-one-copy-of-bee-backend-is-running";
    expect(issueTrackerHref("UUM-142773",source)).toBe(source);
    expect(normalizeIssueLinks(["UUM-142773"],[{id:"UUM-142773",url:source}])).toEqual([{id:"UUM-142773",url:source}]);
  });
  test("keeps new numeric-and-slug issue destinations, query and fragment intact", () => {
    const source="https://issuetracker.unity.com/issues/12297/crash-on-monologwritelogfile-when-more-than-one-copy-of-bee-backend-is-running?view=full#details";
    expect(issueTrackerHref("UUM-142773",source)).toBe(source);
  });
  test.each(["javascript:alert(1)","https://evil.test/issue","https://issuetracker.unity.com.evil.test/issues/uum-142773","malformed","https://user:secret@issuetracker.unity.com/issues/example","https://issuetracker.unity.com/not-found","https://issuetracker.unity.com/issues"])('rejects unsafe/unrelated issue source %s', url=>{
    expect(issueTrackerHref("UUM-142773",url)).toBe("https://issuetracker.unity.com/?q=UUM-142773");
  });
  test("repairs stored raw links and fills missing URLs without a DB backfill", () => {
    expect(normalizeIssueLinks(["UUM-142773","UUM-155199"],[{id:"UUM-142773",url:"https://issuetracker.unity3d.com/issues/uum-142773"}])).toEqual([
      {id:"UUM-142773",url:"https://issuetracker.unity.com/?q=UUM-142773"},
      {id:"UUM-155199",url:"https://issuetracker.unity.com/?q=UUM-155199"}
    ]);
  });
});
