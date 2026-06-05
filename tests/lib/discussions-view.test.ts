import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  avatarUrl,
  buildDiscussionsHref,
  cleanExcerpt,
  normalizeSort
} from "@/lib/discussions-view";

describe("cleanExcerpt", () => {
  test("returns empty string for nullish input", () => {
    expect(cleanExcerpt(null)).toBe("");
    expect(cleanExcerpt(undefined)).toBe("");
    expect(cleanExcerpt("")).toBe("");
  });

  test("strips HTML tags down to readable text", () => {
    expect(
      cleanExcerpt('Read the <a href="https://discussions.unity.com/t/1">beta notes</a> now')
    ).toBe("Read the beta notes now");
  });

  test("decodes the common HTML entities", () => {
    expect(cleanExcerpt('Tom &amp; Jerry &quot;quoted&quot; it&#39;s fine')).toBe(
      'Tom & Jerry "quoted" it\'s fine'
    );
  });

  test("collapses whitespace left behind by stripped block tags", () => {
    expect(cleanExcerpt("<p>line one</p>\n<p>line two</p>")).toBe("line one line two");
  });
});

describe("normalizeSort", () => {
  test("passes through known sorts", () => {
    expect(normalizeSort("newest")).toBe("newest");
    expect(normalizeSort("popular")).toBe("popular");
    expect(normalizeSort("edited")).toBe("edited");
    expect(normalizeSort("recent")).toBe("recent");
  });

  test("falls back to recent for unknown or missing values", () => {
    expect(normalizeSort(undefined)).toBe("recent");
    expect(normalizeSort("")).toBe("recent");
    expect(normalizeSort("bogus")).toBe("recent");
  });
});

describe("buildDiscussionsHref", () => {
  test("omits defaults so the canonical page is a bare path", () => {
    expect(buildDiscussionsHref({})).toBe("/discussions");
    expect(buildDiscussionsHref({ sort: "recent", page: 1 })).toBe("/discussions");
  });

  test("serializes only non-default filter state", () => {
    expect(
      buildDiscussionsHref({
        q: "addressables",
        category: "graphics",
        author: "unity_dev",
        sort: "popular",
        edited: true,
        page: 3
      })
    ).toBe(
      "/discussions?q=addressables&category=graphics&author=unity_dev&sort=popular&edited=1&page=3"
    );
  });

  test("drops page=1 and sort=recent but keeps other filters", () => {
    expect(buildDiscussionsHref({ q: "burst", sort: "recent", page: 1 })).toBe(
      "/discussions?q=burst"
    );
  });

  test("serializes includeReplies as replies=1 (default topics-only view stays bare)", () => {
    expect(buildDiscussionsHref({ includeReplies: true })).toBe("/discussions?replies=1");
    expect(buildDiscussionsHref({ includeReplies: false })).toBe("/discussions");
  });

  test("url-encodes filter values", () => {
    expect(buildDiscussionsHref({ q: "input system" })).toBe(
      "/discussions?q=input+system"
    );
  });
});

describe("avatarUrl", () => {
  test("returns null when no template", () => {
    expect(avatarUrl(null)).toBeNull();
    expect(avatarUrl(undefined)).toBeNull();
    expect(avatarUrl("")).toBeNull();
  });

  test("substitutes {size} and absolutizes a relative template", () => {
    expect(avatarUrl("/user_avatar/discussions.unity.com/dev/{size}/12_2.png")).toBe(
      "https://discussions.unity.com/user_avatar/discussions.unity.com/dev/48/12_2.png"
    );
  });

  test("honors a custom size", () => {
    expect(avatarUrl("/a/{size}/x.png", 96)).toBe(
      "https://discussions.unity.com/a/96/x.png"
    );
  });

  test("honors absolute https URLs on allowed Unity / Discourse-CDN hosts", () => {
    expect(avatarUrl("https://discussions.unity.com/a/{size}/x.png")).toBe(
      "https://discussions.unity.com/a/48/x.png"
    );
    expect(avatarUrl("https://sjc1.discourse-cdn.com/unity/a/{size}/x.png")).toBe(
      "https://sjc1.discourse-cdn.com/unity/a/48/x.png"
    );
  });

  test("blocks absolute URLs on untrusted hosts (anti-tracking-pixel)", () => {
    expect(avatarUrl("https://evil.example.com/a/{size}/x.png")).toBeNull();
    // A host that merely contains, but does not end with, an allowed
    // suffix must not slip through.
    expect(avatarUrl("https://unity.com.evil.test/x.png")).toBeNull();
  });

  test("blocks non-https schemes", () => {
    expect(avatarUrl("http://discussions.unity.com/a/{size}/x.png")).toBeNull();
  });

  test("returns null for an unusable (non-path, non-url) template", () => {
    expect(avatarUrl("data:image/png;base64,AAAA")).toBeNull();
  });
});

describe("discussions page wiring", () => {
  test("the left nav links to /discussions", () => {
    const nav = readFileSync("src/app/_components/LeftNav.tsx", "utf8");
    expect(nav).toContain('href: "/discussions"');
    expect(nav).toContain('label: "Staff Discussions"');
  });

  test("the sitemap includes the discussions route", () => {
    const sitemap = readFileSync("src/app/sitemap.ts", "utf8");
    expect(sitemap).toContain("/discussions");
  });

  test("the FAQ documents discussions.unity.com as a source", () => {
    const faq = readFileSync("src/app/faq/page.tsx", "utf8");
    expect(faq).toContain("discussions.unity.com");
    expect(faq).toContain("Six public Unity sources");
  });
});
