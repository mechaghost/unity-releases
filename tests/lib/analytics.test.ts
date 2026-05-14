import { describe, expect, test } from "vitest";

import {
  looksLikeBot,
  normalizePath,
  shouldTrackPath
} from "../../src/lib/analytics";

describe("shouldTrackPath", () => {
  test("tracks user-facing page paths", () => {
    expect(shouldTrackPath("/")).toBe(true);
    expect(shouldTrackPath("/releases")).toBe(true);
    expect(shouldTrackPath("/releases/6000.3.15f1")).toBe(true);
    expect(shouldTrackPath("/compare")).toBe(true);
    expect(shouldTrackPath("/stats")).toBe(true);
    expect(shouldTrackPath("/issues/UUM-12345")).toBe(true);
  });

  test("never tracks Next.js internals or API routes", () => {
    expect(shouldTrackPath("/_next/static/chunks/abc.js")).toBe(false);
    expect(shouldTrackPath("/api/health")).toBe(false);
    expect(shouldTrackPath("/api/track")).toBe(false);
  });

  test("ignores favicons, og images, and machine-readable docs", () => {
    expect(shouldTrackPath("/favicon.ico")).toBe(false);
    expect(shouldTrackPath("/icon")).toBe(false);
    expect(shouldTrackPath("/apple-icon")).toBe(false);
    expect(shouldTrackPath("/opengraph-image")).toBe(false);
    expect(shouldTrackPath("/robots.txt")).toBe(false);
    expect(shouldTrackPath("/sitemap.xml")).toBe(false);
    expect(shouldTrackPath("/llms.txt")).toBe(false);
  });

  test("refuses empty paths", () => {
    expect(shouldTrackPath("")).toBe(false);
  });
});

describe("looksLikeBot", () => {
  test("treats missing user-agent as a bot", () => {
    expect(looksLikeBot(null)).toBe(true);
    expect(looksLikeBot("")).toBe(true);
  });

  test("matches well-known crawlers and unfurlers", () => {
    expect(looksLikeBot("Googlebot/2.1 (+http://www.google.com/bot.html)")).toBe(true);
    expect(looksLikeBot("Mozilla/5.0 (compatible; Bingbot/2.0)")).toBe(true);
    expect(looksLikeBot("Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)")).toBe(true);
    expect(looksLikeBot("Discordbot/2.0 (+https://discordapp.com)")).toBe(true);
    expect(looksLikeBot("facebookexternalhit/1.1")).toBe(true);
    expect(looksLikeBot("Mozilla/5.0 (X11; Linux) HeadlessChrome/119.0")).toBe(true);
    expect(looksLikeBot("Mozilla/5.0 (Linux) Lighthouse/9.6")).toBe(true);
  });

  test("lets real browsers through", () => {
    expect(
      looksLikeBot(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15"
      )
    ).toBe(false);
    expect(
      looksLikeBot(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0 Safari/537.36"
      )
    ).toBe(false);
  });
});

describe("normalizePath", () => {
  test("strips query strings so /releases?page=2 doesn't fragment the path", () => {
    expect(normalizePath("/releases?page=2")).toBe("/releases");
    expect(normalizePath("/compare?from=6000.3.15f1&to=6000.5.0b7")).toBe("/compare");
  });

  test("collapses trailing slashes but keeps the root", () => {
    expect(normalizePath("/")).toBe("/");
    expect(normalizePath("/releases/")).toBe("/releases");
    expect(normalizePath("/releases///")).toBe("/releases");
  });

  test("defends against missing leading slash", () => {
    expect(normalizePath("releases")).toBe("/releases");
  });

  test("returns root for empty input", () => {
    expect(normalizePath("")).toBe("/");
  });
});
