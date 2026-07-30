import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  schemaReady: vi.fn(),
  listUpdates: vi.fn(),
  listHealth: vi.fn()
}));

vi.mock("../../src/lib/product-updates/repositories", () => ({
  productUpdatesSchemaReady: mocks.schemaReady,
  listProductUpdates: mocks.listUpdates,
  listProductUpdateHealth: mocks.listHealth
}));

import { GET as getUpdates } from "../../src/app/api/updates/route";
import { GET as getHealth } from "../../src/app/api/updates/health/route";

beforeEach(() => {
  mocks.schemaReady.mockReset();
  mocks.listUpdates.mockReset();
  mocks.listHealth.mockReset();
  delete process.env.PRODUCT_UPDATE_UI_ENABLED;
  delete process.env.PRODUCT_UPDATE_INGEST_ENABLED;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("Product Updates API", () => {
  test("stays undiscoverable while the read surface is disabled", async () => {
    const response = await getUpdates(new Request("https://example.test/api/updates"));
    expect(response.status).toBe(404);
    expect(mocks.schemaReady).not.toHaveBeenCalled();
  });

  test("fails safely when the optional schema is not installed", async () => {
    process.env.PRODUCT_UPDATE_UI_ENABLED = "true";
    mocks.schemaReady.mockResolvedValue(false);
    const response = await getUpdates(new Request("https://example.test/api/updates"));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ configured: false });
  });

  test("validates filters and emits a stable next cursor", async () => {
    process.env.PRODUCT_UPDATE_UI_ENABLED = "true";
    mocks.schemaReady.mockResolvedValue(true);
    mocks.listUpdates.mockResolvedValue([
      {
        id: 9,
        sortTime: "2026-07-28T00:00:00.000Z",
        productSlug: "unity-hub",
        title: "Unity Hub 3.14"
      }
    ]);
    const response = await getUpdates(
      new Request("https://example.test/api/updates?family=editor-tooling&limit=1")
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.configured).toBe(true);
    expect(body.nextCursor).toEqual(expect.any(String));
    expect(mocks.listUpdates).toHaveBeenCalledWith({
      family: "editor-tooling",
      product: undefined,
      changeKind: undefined,
      platform: undefined,
      version: undefined,
      channel: undefined,
      from: undefined,
      to: undefined,
      limit: 1,
      before: null
    });
  });

  test("passes bounded product filters to the isolated repository", async () => {
    process.env.PRODUCT_UPDATE_UI_ENABLED = "true";
    mocks.schemaReady.mockResolvedValue(true);
    mocks.listUpdates.mockResolvedValue([]);

    const response = await getUpdates(
      new Request(
        "https://example.test/api/updates?family=editor-tooling&product=unity-hub&kind=improvement&platform=Windows&version=3.14.0&channel=stable&from=2026-07-01&to=2026-07-31"
      )
    );

    expect(response.status).toBe(200);
    expect(mocks.listUpdates).toHaveBeenCalledWith(
      expect.objectContaining({
        family: "editor-tooling",
        product: "unity-hub",
        changeKind: "improvement",
        platform: "Windows",
        version: "3.14.0",
        channel: "stable",
        from: "2026-07-01",
        to: "2026-07-31"
      })
    );
  });

  test("cursor carries the has-date key so paging can't skip the boundary", async () => {
    // The feed ranks dated rows above dateless ones, so the cursor must
    // encode which section it left off in - otherwise the next page's
    // tuple compare jumps straight into the dateless tail.
    process.env.PRODUCT_UPDATE_UI_ENABLED = "true";
    mocks.schemaReady.mockResolvedValue(true);
    mocks.listUpdates.mockResolvedValue([
      {
        id: 9,
        releaseDate: null,
        sortTime: "2026-07-29T18:03:04.094Z",
        productSlug: "unity-levelplay-adapters",
        title: "YSO Network Android adapter 5.0.0"
      }
    ]);

    const response = await getUpdates(
      new Request("https://example.test/api/updates?limit=1")
    );
    const { nextCursor } = await response.json();
    const decoded = JSON.parse(Buffer.from(nextCursor, "base64url").toString("utf8"));
    expect(decoded).toEqual({
      hasReleaseDate: false,
      sortTime: "2026-07-29T18:03:04.094Z",
      id: 9
    });

    // And a dated row reports the other side of the boundary.
    mocks.listUpdates.mockResolvedValue([
      {
        id: 4,
        releaseDate: "2026-07-01T00:00:00.000Z",
        sortTime: "2026-07-01T00:00:00.000Z",
        productSlug: "unity-hub",
        title: "Unity Hub 3.14"
      }
    ]);
    const dated = await getUpdates(new Request("https://example.test/api/updates?limit=1"));
    const datedCursor = JSON.parse(
      Buffer.from((await dated.json()).nextCursor, "base64url").toString("utf8")
    );
    expect(datedCursor.hasReleaseDate).toBe(true);
  });

  test("accepts a legacy cursor that predates the has-date key", async () => {
    process.env.PRODUCT_UPDATE_UI_ENABLED = "true";
    mocks.schemaReady.mockResolvedValue(true);
    mocks.listUpdates.mockResolvedValue([]);
    const legacy = Buffer.from(
      JSON.stringify({ sortTime: "2026-07-28T00:00:00.000Z", id: 12 }),
      "utf8"
    ).toString("base64url");

    const response = await getUpdates(
      new Request(`https://example.test/api/updates?cursor=${legacy}`)
    );

    expect(response.status).toBe(200);
    expect(mocks.listUpdates).toHaveBeenCalledWith(
      expect.objectContaining({
        before: { sortTime: "2026-07-28T00:00:00.000Z", id: 12 }
      })
    );
  });

  test("rejects malformed cursors and unknown families", async () => {
    process.env.PRODUCT_UPDATE_UI_ENABLED = "true";
    mocks.schemaReady.mockResolvedValue(true);
    const cursorResponse = await getUpdates(
      new Request("https://example.test/api/updates?cursor=bad")
    );
    expect(cursorResponse.status).toBe(400);
    const familyResponse = await getUpdates(
      new Request("https://example.test/api/updates?family=other")
    );
    expect(familyResponse.status).toBe(400);
  });

  test("reports optional health without affecting core health", async () => {
    mocks.schemaReady.mockResolvedValue(true);
    mocks.listHealth.mockResolvedValue([
      {
        sourceKey: "unity-hub",
        targetKey: "main",
        status: "quarantined",
        lastSuccessAt: null,
        cadenceHours: 12,
        nextDueAt: null,
        consecutiveFailures: 1,
        circuitOpenUntil: null,
        leaseExpiresAt: null
      }
    ]);
    const response = await getHealth();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      configured: true,
      status: "degraded"
    });
  });

  test("degrades empty, never-succeeded, overdue, and expired-lease states", async () => {
    mocks.schemaReady.mockResolvedValue(true);
    mocks.listHealth.mockResolvedValueOnce([]);
    await expect((await getHealth()).json()).resolves.toMatchObject({
      status: "degraded",
      sources: []
    });

    mocks.listHealth.mockResolvedValueOnce([
      {
        sourceKey: "unity-hub",
        targetKey: "main",
        status: "active",
        lastSuccessAt: null,
        cadenceHours: 12,
        nextDueAt: "2020-01-01T00:00:00.000Z",
        consecutiveFailures: 0,
        circuitOpenUntil: null,
        leaseExpiresAt: "2020-01-01T00:00:00.000Z"
      }
    ]);
    const body = await (await getHealth()).json();
    expect(body.status).toBe("degraded");
    expect(body.sources[0].healthReasons).toEqual(
      expect.arrayContaining(["never-succeeded", "overdue", "expired-lease"])
    );
  });

  test("reports a current successful target as healthy", async () => {
    mocks.schemaReady.mockResolvedValue(true);
    mocks.listHealth.mockResolvedValue([
      {
        sourceKey: "unity-hub",
        targetKey: "main",
        status: "active",
        lastSuccessAt: "2026-07-28T00:00:00.000Z",
        cadenceHours: 12,
        nextDueAt: "2099-01-01T00:00:00.000Z",
        consecutiveFailures: 0,
        circuitOpenUntil: null,
        leaseExpiresAt: null
      }
    ]);
    await expect((await getHealth()).json()).resolves.toMatchObject({
      status: "ok",
      sources: [{ health: "ok", healthReasons: [] }]
    });
  });
});
