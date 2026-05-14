/**
 * Edge-safe analytics helpers. ZERO non-Edge imports allowed - this
 * file is loaded by `src/middleware.ts` which runs in the Edge runtime
 * and can't tolerate Node-only deps (pg, crypto, fs, etc).
 *
 * DB-touching helpers (recordPageView, recordEvent) live in
 * `analytics-server.ts` and are only loaded by route handlers running
 * in the Node runtime.
 */

/** Paths we never track even if a request hits them. */
const IGNORED_PREFIXES = [
  "/_next/",
  "/api/",
  "/icon",
  "/apple-icon",
  "/opengraph-image",
  "/favicon",
  "/robots.txt",
  "/sitemap.xml",
  "/llms.txt"
];

/** Quick bot heuristic - matches the user agents that dominate our
 *  log volume without us caring about them. Imperfect but cheap. */
const BOT_USER_AGENT_PATTERNS = [
  /bot/i,
  /crawler/i,
  /spider/i,
  /facebookexternalhit/i,
  /slackbot/i,
  /discordbot/i,
  /preview/i,
  /lighthouse/i,
  /headlesschrome/i,
  /pingdom/i,
  /uptimerobot/i
];

export function shouldTrackPath(path: string): boolean {
  if (!path || path === "") return false;
  for (const prefix of IGNORED_PREFIXES) {
    if (path === prefix || path.startsWith(prefix)) return false;
  }
  return true;
}

export function looksLikeBot(userAgent: string | null): boolean {
  if (!userAgent) return true; // missing UA → almost always a bot
  return BOT_USER_AGENT_PATTERNS.some((re) => re.test(userAgent));
}

/** Strip query strings + trailing slashes so the same logical page
 *  isn't split into a long tail of distinct rows. Keep dynamic
 *  segments as-is so we can still see, e.g. /releases/6000.3.15f1. */
export function normalizePath(rawPath: string): string {
  if (!rawPath) return "/";
  const qIdx = rawPath.indexOf("?");
  let path = qIdx >= 0 ? rawPath.slice(0, qIdx) : rawPath;
  // Collapse trailing slash but keep the root.
  if (path.length > 1 && path.endsWith("/")) {
    path = path.replace(/\/+$/, "");
  }
  if (!path.startsWith("/")) path = `/${path}`;
  return path;
}
