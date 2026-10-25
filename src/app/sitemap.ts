import { TOOLING_GUIDES, TOOLING_REVIEWED } from "@/lib/tooling-guides";
import { RELEASE_GUIDES, guideHref } from "@/lib/release-guides";
import { featureHref, guideFeatures } from "@/lib/release-features";
import type { MetadataRoute } from "next";
import { listReleaseSummaries, listTopIssueIds } from "@/lib/db/repositories";
import { siteUrl } from "@/lib/site";
import { productUpdateNavigationEnabled } from "@/lib/product-updates/flags";
import { PRODUCT_UPDATE_FAMILY_CATALOG } from "@/lib/product-updates/catalog";
import {
  listProductUpdateSitemapEntries,
  productUpdatesSchemaReady
} from "@/lib/product-updates/repositories";

// Rendered per request, not prerendered. Like /llms.txt (F5), a bare
// `revalidate` with no request-dependent API makes Next prerender this at BUILD
// time - and Railway's builder can't reach the runtime Postgres, so both DB
// reads below would throw, the catches would swallow them, and the built
// artifact would ship only the ~10 static URLs for the first hour after every
// deploy (crawlers told the whole site is 10 pages), with nothing logged.
// Sitemaps are fetched rarely, so per-request is a fine trade for correctness.
export const dynamic = "force-dynamic";

type ReleaseRow = { version: string; release_date: string | Date | null };

const TOP_ISSUE_LIMIT = 500;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteUrl();

  // Omit lastModified when no content update timestamp is available.
  const staticEntries: MetadataRoute.Sitemap = [
    ...TOOLING_GUIDES.map(guide => ({ url: `${origin}/whats-new/${guide.slug}`, lastModified: new Date(TOOLING_REVIEWED), changeFrequency: "weekly" as const, priority: 0.8 })),
    ...RELEASE_GUIDES.map(guide => ({ url: `${origin}${guideHref(guide)}`, lastModified: new Date(guide.reviewed), changeFrequency: "weekly" as const, priority: 0.8 })),
    ...RELEASE_GUIDES.flatMap(guide => guideFeatures(guide).map(feature => ({ url: `${origin}${featureHref(guide, feature)}`, lastModified: new Date(guide.reviewed), changeFrequency: "monthly" as const, priority: 0.7 }))),
    { url: `${origin}/`, changeFrequency: "daily", priority: 1.0 },
    { url: `${origin}/whats-new/unity-6-features`, changeFrequency: "weekly", priority: 0.85 },
    { url: `${origin}/whats-new/past-releases`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${origin}/compare`, changeFrequency: "daily", priority: 0.95 },
    { url: `${origin}/releases`, changeFrequency: "daily", priority: 0.9 },
    { url: `${origin}/packages`, changeFrequency: "daily", priority: 0.7 },
    { url: `${origin}/github`, changeFrequency: "daily", priority: 0.6 },
    { url: `${origin}/resources`, changeFrequency: "daily", priority: 0.6 },
    { url: `${origin}/discussions`, changeFrequency: "daily", priority: 0.6 },
    { url: `${origin}/news`, changeFrequency: "daily", priority: 0.5 },
    { url: `${origin}/stats`, changeFrequency: "daily", priority: 0.4 },
    { url: `${origin}/guides/agentic-coding-with-unity`, lastModified: new Date("2026-10-25"), changeFrequency: "monthly", priority: 0.7 },
    { url: `${origin}/faq`, changeFrequency: "monthly", priority: 0.6 },
    // Primary-nav pages that were missing from the static list (the per-issue
    // URLs below already made /issues/* crawlable; the index pages weren't).
    // /explorer stays out deliberately - it has a noindex directive.
    { url: `${origin}/issues`, changeFrequency: "daily", priority: 0.6 },
    { url: `${origin}/timeline`, changeFrequency: "daily", priority: 0.4 },
    { url: `${origin}/visualizer`, changeFrequency: "weekly", priority: 0.5 }
  ];
  const productEntries = await optionalProductUpdateEntries(origin);

  let releases: ReleaseRow[] = [];
  try {
    releases = await listReleaseSummaries();
  } catch (error) {
    // DB unreachable: ship the static entries alone rather than failing the
    // whole sitemap. Now force-dynamic (above), so this only fires on a real
    // runtime DB outage, not on every build - and it logs so that degradation
    // is visible rather than silent.
    console.error(
      JSON.stringify({
        route: "/sitemap.xml",
        event: "release_entries_fallback",
        error: error instanceof Error ? error.message : String(error)
      })
    );
    return [...staticEntries, ...productEntries];
  }

  const releaseEntries: MetadataRoute.Sitemap = releases.map((r) => ({
    url: `${origin}/releases/${encodeURIComponent(r.version)}`,
    lastModified: r.release_date ? new Date(r.release_date) : undefined,
    changeFrequency: "weekly" as const,
    priority: 0.8
  }));

  // Top-mentioned issues are valuable SEO targets - people search for
  // UUM-xxxxx when they hit a problem. Cap at TOP_ISSUE_LIMIT so the
  // sitemap stays well under search engines' 50,000-URL limit and
  // doesn't drown the more important release pages.
  let topIssues: string[] = [];
  try {
    topIssues = await listTopIssueIds(TOP_ISSUE_LIMIT);
  } catch (error) {
    console.error(
      JSON.stringify({
        route: "/sitemap.xml",
        event: "issue_entries_fallback",
        error: error instanceof Error ? error.message : String(error)
      })
    );
    topIssues = [];
  }
  const issueEntries: MetadataRoute.Sitemap = topIssues.map((id) => ({
    url: `${origin}/issues/${encodeURIComponent(id)}`,
    changeFrequency: "weekly" as const,
    priority: 0.5
  }));

  return [
    ...staticEntries,
    ...releaseEntries,
    ...issueEntries,
    ...productEntries
  ];
}

async function optionalProductUpdateEntries(
  origin: string
): Promise<MetadataRoute.Sitemap> {
  if (
    !productUpdateNavigationEnabled() ||
    !(await productUpdatesSchemaReady())
  ) {
    return [];
  }
  const familyEntries: MetadataRoute.Sitemap = [
    {
      url: `${origin}/updates`,
      changeFrequency: "daily",
      priority: 0.55
    },
    ...PRODUCT_UPDATE_FAMILY_CATALOG.map((family) => ({
      url: `${origin}/updates/${family.key}`,
      changeFrequency: "daily" as const,
      priority: family.priority === "core-adjacent" ? 0.55 : 0.35
    }))
  ];
  try {
    const entries = await listProductUpdateSitemapEntries();
    return [
      ...familyEntries,
      ...entries.products.map((product) => ({
        url: `${origin}/updates/products/${encodeURIComponent(product.slug)}`,
        lastModified: product.updatedAt ? new Date(product.updatedAt) : undefined,
        changeFrequency: "daily" as const,
        priority: 0.4
      })),
      ...entries.updates.map((update) => ({
        url: `${origin}/updates/products/${encodeURIComponent(update.productSlug)}/${encodeURIComponent(update.updateSlug)}`,
        lastModified: new Date(update.updatedAt),
        changeFrequency: "weekly" as const,
        priority: 0.3
      }))
    ];
  } catch (error) {
    console.error(
      JSON.stringify({
        route: "/sitemap.xml",
        event: "product_update_entries_fallback",
        error: error instanceof Error ? error.message : String(error)
      })
    );
    return familyEntries;
  }
}
