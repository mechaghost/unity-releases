import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { jsonLdString, pageSocialMetadata, siteUrl } from "../../src/lib/site";

describe("pageSocialMetadata", () => {
  const originalEnv = process.env.NEXT_PUBLIC_SITE_URL;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = originalEnv;
  });

  test("renders the page-specific title with the site suffix and absolute URL", () => {
    const meta = pageSocialMetadata({
      title: "Editor Releases",
      description: "Every indexed Unity editor release.",
      path: "/releases"
    });
    const og = meta.openGraph as Record<string, unknown>;
    const twitter = meta.twitter as Record<string, unknown>;
    expect(og.title).toBe("Editor Releases - Unity Releases");
    expect(og.description).toBe("Every indexed Unity editor release.");
    expect(og.url).toBe("https://unityreleases.com/releases");
    expect(og.siteName).toBe("Unity Releases");
    expect(og.locale).toBe("en_US");
    expect(twitter.card).toBe("summary_large_image");
    expect(twitter.title).toBe("Editor Releases - Unity Releases");
    expect(twitter.description).toBe("Every indexed Unity editor release.");
  });

  test("honors NEXT_PUBLIC_SITE_URL so staging/local builds get the right OG url", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://staging.unityreleases.com/";
    const meta = pageSocialMetadata({
      title: "FAQ",
      description: "Disclaimer.",
      path: "/faq"
    });
    const og = meta.openGraph as Record<string, unknown>;
    expect(og.url).toBe("https://staging.unityreleases.com/faq");
  });

  test("preserves query-style paths so /compare?from=...&to=... unfurls correctly", () => {
    const meta = pageSocialMetadata({
      title: "Unity 6000.3.15f1 → 6000.5.0b7 upgrade diff",
      description: "Diff details.",
      path: "/compare?from=6000.3.15f1&to=6000.5.0b7"
    });
    const og = meta.openGraph as Record<string, unknown>;
    expect(og.url).toBe(
      "https://unityreleases.com/compare?from=6000.3.15f1&to=6000.5.0b7"
    );
  });
});

describe("siteUrl", () => {
  const originalEnv = process.env.NEXT_PUBLIC_SITE_URL;
  afterEach(() => {
    if (originalEnv === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = originalEnv;
  });

  test("strips trailing slashes from the env override", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000///";
    expect(siteUrl()).toBe("http://localhost:3000");
  });

  test("falls back to production when env is empty", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "   ";
    expect(siteUrl()).toBe("https://unityreleases.com");
  });
});

describe("jsonLdString", () => {
  test("produces valid JSON that round-trips through JSON.parse", () => {
    const out = jsonLdString({ "@type": "TechArticle", headline: "Hello" });
    expect(JSON.parse(out)).toEqual({ "@type": "TechArticle", headline: "Hello" });
  });

  test("escapes `<` so an embedded `</script>` can't close the script tag", () => {
    const out = jsonLdString({ body: "before </script><script>alert(1)</script> after" });
    expect(out).not.toContain("</script>");
    expect(out).not.toContain("<script>");
    expect(out).toContain("\\u003c/script>");
    expect(out).toContain("\\u003cscript>");
    // The round-trip still produces the original payload.
    expect(JSON.parse(out)).toEqual({
      body: "before </script><script>alert(1)</script> after"
    });
  });
});
