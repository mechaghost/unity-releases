import { recordEvent, recordPageView } from "@/lib/analytics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Fire-and-forget tracking endpoint called by `src/middleware.ts` for
 * every page request that survives the bot filter. We keep the
 * surface small (two event kinds) so a misbehaving caller can't
 * stuff arbitrary data into the analytics tables.
 */
type TrackBody =
  | { kind: "pageview"; path: string }
  | { kind: "event"; eventType: string; path?: string; metadata?: Record<string, unknown> };

export async function POST(request: Request) {
  let body: TrackBody;
  try {
    body = (await request.json()) as TrackBody;
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return Response.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  if (body.kind === "pageview") {
    if (typeof body.path !== "string") {
      return Response.json({ ok: false, error: "invalid_path" }, { status: 400 });
    }
    await recordPageView(body.path);
    return Response.json({ ok: true });
  }

  if (body.kind === "event") {
    if (typeof body.eventType !== "string" || body.eventType.length === 0) {
      return Response.json({ ok: false, error: "invalid_event_type" }, { status: 400 });
    }
    // Cap the metadata size so a runaway client can't dump megabytes
    // into the analytics table.
    const metadata = body.metadata ?? {};
    const serialized = JSON.stringify(metadata);
    if (serialized.length > 2048) {
      return Response.json({ ok: false, error: "metadata_too_large" }, { status: 400 });
    }
    await recordEvent(body.eventType, {
      path: body.path,
      metadata
    });
    return Response.json({ ok: true });
  }

  return Response.json({ ok: false, error: "unknown_kind" }, { status: 400 });
}
