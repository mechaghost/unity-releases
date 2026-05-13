import type { MetadataRoute } from "next";
import { listReleases, listTopIssueIds } from "@/lib/db/repositories";
import { siteUrl } from "@/lib/site";

// Sitemap is regenerated at most once an hour - release pages change
// when new versions ship and when notes get reparsed.
export const revalidate = 3600;

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
    { url: `${origin}/resources`, lastModified: now, changeFrequency: "daily", priority: 0.6 },
    { url: `${origin}/news`, lastModified: now, changeFrequency: "daily", priority: 0.5 },
    { url: `${origin}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.6 }
  ];

  let releases: ReleaseRow[] = [];
  try {
    releases = (await listReleases(500)) as ReleaseRow[];
  } catch {
    // If the DB is unreachable at build time, ship the static entries
    // alone rather than failing the whole sitemap. Indexers will pick
    // up release pages on the next regeneration.
    return staticEntries;
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
  } catch {
    topIssues = [];
  }
  const issueEntries: MetadataRoute.Sitemap = topIssues.map((id) => ({
    url: `${origin}/issues/${encodeURIComponent(id)}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.5
  }));

  return [...staticEntries, ...releaseEntries, ...issueEntries];
}
