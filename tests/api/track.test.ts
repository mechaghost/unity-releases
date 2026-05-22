import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Mock the DB-touching analytics helpers so the route's branching can
// be exercised without a Postgres connection.
const analytics = vi.hoisted(() => ({
  recordPageView: vi.fn(async () => {}),
  recordEvent: vi.fn(async () => {})
}));

vi.mock("@/lib/analytics-server", () => ({
  recordPageView: analytics.recordPageView,
  recordEvent: analytics.recordEvent
}));

import { POST } from "../../src/app/api/track/route";

beforeEach(() => {
  analytics.recordPageView.mockClear();
  analytics.recordEvent.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function postRequest(body: unknown, opts: { userAgent?: string | null } = {}): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  // Default to a real browser UA so the bot filter inside the route
  // doesn't short-circuit the request before the body checks run.
  const ua = opts.userAgent === undefined ? BROWSER_UA : opts.userAgent;
  if (ua) headers["user-agent"] = ua;
  return new Request("http://localhost/api/track", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body)
  });
}

describe("POST /api/track", () => {
  test("records a pageview when kind=pageview", async () => {
    const res = await POST(postRequest({ kind: "pageview", path: "/releases/6000.3.15f1" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(analytics.recordPageView).toHaveBeenCalledWith("/releases/6000.3.15f1");
    expect(analytics.recordEvent).not.toHaveBeenCalled();
  });

  test("records an event when kind=event, forwarding path + metadata", async () => {
    const res = await POST(
      postRequest({
        kind: "event",
        eventType: "filter_applied",
        path: "/compare",
        metadata: { lanes: ["blockers", "breaking"] }
      })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(analytics.recordEvent).toHaveBeenCalledWith("filter_applied", {
      path: "/compare",
      metadata: { lanes: ["blockers", "breaking"] }
    });
    expect(analytics.recordPageView).not.toHaveBeenCalled();
  });

  test("rejects pageview with non-string path", async () => {
    const res = await POST(postRequest({ kind: "pageview", path: 42 }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "invalid_path" });
    expect(analytics.recordPageView).not.toHaveBeenCalled();
  });

  test("rejects event with empty type", async () => {
    const res = await POST(postRequest({ kind: "event", eventType: "" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "invalid_event_type" });
    expect(analytics.recordEvent).not.toHaveBeenCalled();
  });

  test("rejects event with oversized metadata to prevent table-blob abuse", async () => {
    const huge = "x".repeat(3000);
    const res = await POST(
      postRequest({ kind: "event", eventType: "test", metadata: { blob: huge } })
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "metadata_too_large" });
    expect(analytics.recordEvent).not.toHaveBeenCalled();
  });

  test("rejects unknown kinds", async () => {
    const res = await POST(postRequest({ kind: "telemetry" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "unknown_kind" });
  });

  test("rejects invalid JSON", async () => {
    const res = await POST(postRequest("not json"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "invalid_json" });
  });

  test("skips tracking when the user-agent looks like a bot", async () => {
    const res = await POST(
      postRequest(
        { kind: "pageview", path: "/" },
        { userAgent: "Googlebot/2.1 (+http://www.google.com/bot.html)" }
      )
    );
    // 204 No Content distinguishes bot skips from real success (200) in
    // Railway access logs. sendBeacon still treats both as success.
    expect(res.status).toBe(204);
    expect(analytics.recordPageView).not.toHaveBeenCalled();
  });

  test("skips tracking when the user-agent header is missing", async () => {
    const res = await POST(postRequest({ kind: "pageview", path: "/" }, { userAgent: null }));
    expect(res.status).toBe(204);
    expect(analytics.recordPageView).not.toHaveBeenCalled();
  });
});
