import { query } from "./db/client";
import { normalizePath, shouldTrackPath } from "./analytics";

/**
 * Node-only analytics helpers. They write to Postgres via the `pg`
 * driver, which pulls in Node's `crypto`/`stream`/`net` and therefore
 * cannot be imported from Edge-runtime code. Keep `src/middleware.ts`
 * pointed at `@/lib/analytics` (pure functions) and only import this
 * module from route handlers / server components that run on Node.
 *
 * Both helpers are best-effort: a failed insert never propagates - the
 * request path keeps going, and the failure shows up in our own logs.
 */

export async function recordPageView(path: string): Promise<void> {
  const normalized = normalizePath(path);
  if (!shouldTrackPath(normalized)) return;
  try {
    await query("INSERT INTO page_views (path) VALUES ($1)", [normalized]);
  } catch (err) {
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
