import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Health endpoint is operational, not content; explorer URLs are
        // dynamic faceted searches that produce near-infinite duplicate
        // pages - keep them out of the index. /api/track is the analytics
        // ingress; it's already under /api/ so the existing disallow
        // covers it.
        disallow: ["/api/", "/explorer"]
      }
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl()
  };
}
