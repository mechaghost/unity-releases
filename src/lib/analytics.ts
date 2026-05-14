import { query } from "./db/client";

/**
 * Self-hosted analytics helpers. Designed to be best-effort: a failure
 * to write a row should never break the surrounding render or action.
 * The /stats page is the only consumer of this data.
 *
 * We deliberately don't store any identifier (IP, UA, cookie) - the
 * tables hold path + timestamp only. If we ever want unique-visitor
 * estimates we can add a hashed (ip + daily salt) column later.
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

export async function recordPageView(path: string): Promise<void> {
  const normalized = normalizePath(path);
  if (!shouldTrackPath(normalized)) return;
  try {
    await query("INSERT INTO page_views (path) VALUES ($1)", [normalized]);
  } catch (err) {
    // Analytics never breaks the request path.
    console.error(
      JSON.stringify({
        event: "analytics_pageview_failed",
        error: err instanceof Error ? err.message : String(err),
        path: normalized
      })
    );
  }
}

export async function recordEvent(
  eventType: string,
  options: { path?: string; metadata?: Record<string, unknown> } = {}
): Promise<void> {
  const { path, metadata } = options;
  try {
    await query(
      "INSERT INTO site_events (event_type, event_path, metadata) VALUES ($1, $2, $3)",
      [eventType, path ? normalizePath(path) : null, JSON.stringify(metadata ?? {})]
    );
  } catch (err) {
    console.error(
      JSON.stringify({
        event: "analytics_event_failed",
        error: err instanceof Error ? err.message : String(err),
        eventType
      })
    );
  }
}
