const TRACKER_ORIGIN = "https://issuetracker.unity.com";
const TRACKER_HOSTS = new Set(["issuetracker.unity.com", "issuetracker.unity3d.com"]);

function trackerUrl(href: string): URL | null {
  try {
    const url = new URL(href);
    return /^https?:$/.test(url.protocol) && !url.username && !url.password && TRACKER_HOSTS.has(url.hostname) ? url : null;
  } catch {
    return null;
  }
}

function searchHref(id: string): string {
  // Verified against the hydrated tracker search UI. `search=` is ignored.
  return `${TRACKER_ORIGIN}/?q=${encodeURIComponent(id.trim().toUpperCase())}`;
}

/**
 * Repair obsolete ID/search shapes while preserving actual source slugs.
 * Legacy slugs must keep their original host: Unity's redirect service maps
 * them to new numeric-and-slug routes; replacing only the host breaks them.
 */
export function normalizeIssueTrackerHref(href: string): string {
  const url = trackerUrl(href);
  if (!url) return href;
  const path = url.pathname.replace(/\/+$/, "");
  const idPath = /^\/issues\/((?:UUM|UVSB|DOTS|URP|HDRP|LOC|TMP|SGB|ADDR|IN)-\d+)$/i.exec(path);
  if (idPath) return searchHref(idPath[1]);
  if (path === "" || path === "/issues") {
    const id = url.searchParams.get("q") || url.searchParams.get("search");
    if (id) return searchHref(id);
  }
  return href;
}

export function issueTrackerHref(issueId: string, sourceUrl?: string | null): string {
  const source = sourceUrl ? trackerUrl(sourceUrl) : null;
  if (source && sourceUrl) {
    const path = source.pathname.replace(/\/+$/, "");
    const emptyDestination = ["", "/issues", "/not-found"].includes(path)
      && !source.searchParams.get("q") && !source.searchParams.get("search");
    if (!emptyDestination) return normalizeIssueTrackerHref(sourceUrl);
  }
  return searchHref(issueId);
}
