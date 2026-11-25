import { looksLikeBot } from "@/lib/analytics";
import { recordEvent, recordPageView } from "@/lib/analytics-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Fire-and-forget tracking endpoint. Called by `PageviewBeacon` (a
 * client component mounted in the root layout) via
 * `navigator.sendBeacon()` on every pathname change.
 *
 * Was previously called by Edge middleware, but Railway's Edge runtime
 * can't reach back to the Node service via the public hostname — every
 * fetch surfaced as a generic "fetch failed". Beacon from the browser
 * sidesteps the Edge → service network boundary entirely.
 *
 * We keep the surface small (two event kinds) so a misbehaving caller
 * can't stuff arbitrary data into the analytics tables.
 */
type TrackBody =
  | { kind: "pageview"; path: string }
  | { kind: "event"; eventType: string; path?: string; metadata?: Record<string, unknown> };

// Railway's HTTP logs include the status but omit the rejection reason.
// Log only the reason, at most once per hour per reason in each process.
const lastRejectionLog = new Map<string, number>();

function rejectTracking(reason: string) {
  const now = Date.now();
  const last = lastRejectionLog.get(reason);
  if (last === undefined || now - last >= 60 * 60 * 1000) {
    lastRejectionLog.set(reason, now);
    console.warn(JSON.stringify({ event: "analytics_request_rejected", reason }));
  }
  return Response.json({ ok: false, error: reason }, { status: 400 });
}

export async function POST(request: Request) {
  // Bot filter (UA-based). Bots overwhelmingly skip JS so most never
  // reach this point, but headless-Chrome scrapers do and we filter
  // them at the route now that middleware no longer wraps them. 204 so
  // the skip is distinguishable from a real success (200) in Railway
  // access logs without breaking the sendBeacon contract — both are
  // "success" from the browser's perspective.
  if (looksLikeBot(request.headers.get("user-agent"))) {
    return new Response(null, { status: 204 });
  }

  let body: TrackBody;
  try {
    body = (await request.json()) as TrackBody;
  } catch {
    return rejectTracking("invalid_json");
  }

  if (!body || typeof body !== "object") {
    return rejectTracking("invalid_body");
  }

  if (body.kind === "pageview") {
    if (typeof body.path !== "string") {
      return rejectTracking("invalid_path");
    }
    await recordPageView(body.path);
    return Response.json({ ok: true });
  }

  if (body.kind === "event") {
    if (typeof body.eventType !== "string" || body.eventType.length === 0) {
      return rejectTracking("invalid_event_type");
    }
    // Cap the metadata size so a runaway client can't dump megabytes
    // into the analytics table.
    const metadata = body.metadata ?? {};
    const serialized = JSON.stringify(metadata);
    if (serialized.length > 2048) {
      return rejectTracking("metadata_too_large");
    }
    await recordEvent(body.eventType, {
      path: body.path,
      metadata
    });
    return Response.json({ ok: true });
  }

  return rejectTracking("unknown_kind");
}
