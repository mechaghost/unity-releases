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
