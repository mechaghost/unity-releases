import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ExternalLink } from "../../src/app/_components/ExternalLink";
import { NewsRowClient } from "../../src/app/_components/NewsRowClient";
import { renderChangelog } from "../../src/lib/changelog-markdown";
import { REVIEWED_UNAVAILABLE_LINKS, resolveExternalLink } from "../../src/lib/external-links";

describe("reviewed unavailable links", () => {
  test.each(REVIEWED_UNAVAILABLE_LINKS)("retains text without a dead hyperlink: $url", ({url}) => {
    const html = renderToStaticMarkup(<ExternalLink href={url}>Original source title</ExternalLink>);
    expect(html).toContain("Original source title");
    expect(html).toContain("Source unavailable");
    expect(html).not.toContain('href=');
    expect(html).toContain('title=');
  });

  test("handles fragments and trailing slashes on a reviewed URL", () => {
    expect(resolveExternalLink("https://unity.com/blog/unity-plugin-for-codex/#details").href).toBeNull();
  });

  test("does not hide unverified or rate-limited sources", () => {
    const url = "https://discussions.unity.com/t/6-2-is-now-available/1677060";
    expect(resolveExternalLink(url).href).toBe(url);
  });

  test("stored tracker fallback links in changelogs use the same repaired URL", () => {
    const html=renderToStaticMarkup(<>{renderChangelog("[UUM-142773](https://issuetracker.unity3d.com/issues/uum-142773)")}</>);
    expect(html).toContain('href="https://issuetracker.unity.com/?q=UUM-142773"');
  });

  test("an unavailable news row cannot open its URL through a click handler", () => {
    const row = NewsRowClient({href:REVIEWED_UNAVAILABLE_LINKS[0].url,children:<td>Original story</td>});
    expect(row.props.onClick).toBeUndefined();
  });

  test("package changelog rendering retains unavailable link labels without an anchor", () => {
    const url = "https://github.com/Unity-Technologies/ktx-plugin/releases/tag/release-github%2F1.5.1";
    const html = renderToStaticMarkup(<>{renderChangelog(`Updated decoder. [Release notes](${url})`)}</>);
    expect(html).toContain("Updated decoder.");
    expect(html).toContain("Release notes");
    expect(html).toContain("Source unavailable");
    expect(html).not.toContain('href=');
  });
});

import { changelogLinks } from "../../src/lib/changelog-links";

test("checker extracts exactly the links the changelog renders", () => {
  const notes = [
    "# Changes",
    "[Open](https://example.com/good)",
    "`[Example](https://example.com/inline-code)`",
    "[Unsafe](javascript:alert)",
    "[Removed](https://github.com/LukeUnityDev)",
    "[Issue](https://issuetracker.unity3d.com/issues/uum-142773)",
    "",
    "```",
    "[Example](https://example.com/fenced-code)",
    "```",
    "",
    "- [List](/relative)",
    "",
    "> [Quote](https://example.com/quote)"
  ].join("\n");
  expect(changelogLinks(notes)).toEqual([
    "https://example.com/good", "https://issuetracker.unity.com/?q=UUM-142773", "/relative", "https://example.com/quote"
  ]);
  const html = renderToStaticMarkup(<>{renderChangelog(notes)}</>);
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map(match=>match[1].replaceAll("&amp;","&"));
  expect(hrefs).toEqual(changelogLinks(notes));
});
