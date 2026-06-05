import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  avatarUrl,
  buildDiscussionsHref,
  normalizeSort
} from "@/lib/discussions-view";

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

  test("passes through an already-absolute template", () => {
    expect(avatarUrl("https://cdn.example.com/a/{size}/x.png")).toBe(
      "https://cdn.example.com/a/48/x.png"
    );
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
