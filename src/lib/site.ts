import type { Metadata } from "next";

/**
 * Canonical absolute origin for the site, used for `metadataBase`,
 * Open Graph URLs, sitemap entries, and robots.txt.
 *
 * Override locally or in staging by setting `NEXT_PUBLIC_SITE_URL`
 * (e.g. `https://staging.unityreleases.com` or
 * `http://localhost:3000`). The fallback is the production origin
 * Railway serves.
 */
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return "https://unityreleases.com";
  // Strip trailing slash so callers can confidently concatenate with
  // a leading-slash path.
  return raw.replace(/\/+$/, "");
}

export const SITE_NAME = "Unity Releases";

/**
 * Generation-neutral on purpose. These are module constants feeding the root
 * layout's metadata, so they can't read the database - and naming a single
 * generation ("Unity 6") would need a manual edit the day Unity 7 ships. The
 * data-driven version scope lives on /faq and /llms.txt instead.
 */
export const SITE_TAGLINE = "Unity release & upgrade intelligence";
export const SITE_DESCRIPTION =
  "Diff any two Unity editor versions. Every blocker, breaking change, API change, package bump, and known issue - bucketed by impact and exportable as markdown for an LLM. Independent project, not affiliated with Unity Technologies.";

/**
 * Build per-page Open Graph + Twitter metadata so each route surfaces
 * its own title/description/url when shared on Slack, Discord, X, etc.
 *
 * The root layout's default OG image is inherited automatically when
 * the page's metadata doesn't specify one - Next.js merges OG fields
 * shallowly across the layout/page boundary.
 */
export function pageSocialMetadata(opts: {
  title: string;
  description: string;
  path: string;
}): Pick<Metadata, "openGraph" | "twitter"> {
  const fullTitle = `${opts.title} - ${SITE_NAME}`;
  const url = `${siteUrl()}${opts.path}`;
  return {
    openGraph: {
      title: fullTitle,
      description: opts.description,
      url,
      type: "website",
      siteName: SITE_NAME,
      locale: "en_US"
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description: opts.description
    }
  };
}

/**
 * Serialize a JSON-LD payload for use inside a `<script type="application/ld+json">`
 * via `dangerouslySetInnerHTML`. Replaces every `<` with `<` so a
 * release-note body or user-supplied param can never close the surrounding
 * `</script>` tag.
 */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
