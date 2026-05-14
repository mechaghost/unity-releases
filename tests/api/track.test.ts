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

function postRequest(body: unknown): Request {
  return new Request("http://localhost/api/track", {
    method: "POST",
    headers: { "content-type": "application/json" },
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
});
