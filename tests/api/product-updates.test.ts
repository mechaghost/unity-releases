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
      limit: 1,
      before: null
    });
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
        consecutiveFailures: 1,
        circuitOpenUntil: null
      }
    ]);
    const response = await getHealth();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      configured: true,
      status: "degraded"
    });
  });
});
