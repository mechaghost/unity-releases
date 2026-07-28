import type { MetadataRoute } from "next";
import { listReleaseSummaries, listTopIssueIds } from "@/lib/db/repositories";
import { siteUrl } from "@/lib/site";
import { productUpdateNavigationEnabled } from "@/lib/product-updates/flags";
import { PRODUCT_UPDATE_FAMILY_CATALOG } from "@/lib/product-updates/catalog";
import { listProductUpdateSitemapEntries } from "@/lib/product-updates/repositories";

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
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${origin}/`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${origin}/compare`, lastModified: now, changeFrequency: "daily", priority: 0.95 },
    { url: `${origin}/releases`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${origin}/packages`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${origin}/github`, lastModified: now, changeFrequency: "daily", priority: 0.6 },
    { url: `${origin}/resources`, lastModified: now, changeFrequency: "daily", priority: 0.6 },
    { url: `${origin}/discussions`, lastModified: now, changeFrequency: "daily", priority: 0.6 },
    { url: `${origin}/news`, lastModified: now, changeFrequency: "daily", priority: 0.5 },
    { url: `${origin}/stats`, lastModified: now, changeFrequency: "daily", priority: 0.4 },
    { url: `${origin}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    // Primary-nav pages that were missing from the static list (the per-issue
    // URLs below already made /issues/* crawlable; the index pages weren't).
    // /explorer stays out deliberately - it's robots-disallowed.
    { url: `${origin}/issues`, lastModified: now, changeFrequency: "daily", priority: 0.6 },
    { url: `${origin}/timeline`, lastModified: now, changeFrequency: "daily", priority: 0.4 },
    { url: `${origin}/visualizer`, lastModified: now, changeFrequency: "weekly", priority: 0.5 }
  ];
  const productEntries = await optionalProductUpdateEntries(origin, now);

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
    lastModified: r.release_date ? new Date(r.release_date) : now,
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
    lastModified: now,
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
  origin: string,
  now: Date
): Promise<MetadataRoute.Sitemap> {
  if (!productUpdateNavigationEnabled()) return [];
  const familyEntries: MetadataRoute.Sitemap = [
    {
      url: `${origin}/updates`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.55
    },
    ...PRODUCT_UPDATE_FAMILY_CATALOG.map((family) => ({
      url: `${origin}/updates/${family.key}`,
      lastModified: now,
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
        lastModified: product.updatedAt ? new Date(product.updatedAt) : now,
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
