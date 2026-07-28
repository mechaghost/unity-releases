import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listFeedEvents: vi.fn()
}));

vi.mock("../../src/lib/db/repositories", () => ({
  listFeedEvents: mocks.listFeedEvents
}));

import { GET } from "../../src/app/api/events/route";

beforeEach(() => {
  mocks.listFeedEvents.mockReset();
  mocks.listFeedEvents.mockResolvedValue([]);
  delete process.env.PRODUCT_UPDATE_UI_ENABLED;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("events API product-update scope", () => {
  test("preserves the core-only default feed", async () => {
    const response = await GET(new Request("https://example.test/api/events"));

    expect(response.status).toBe(200);
    expect(mocks.listFeedEvents).toHaveBeenCalledWith(50, {
      productUpdates: "exclude"
    });
  });

  test("keeps the optional scope unavailable while its UI is disabled", async () => {
    const response = await GET(
      new Request("https://example.test/api/events?scope=product-updates")
    );

    expect(response.status).toBe(404);
    expect(mocks.listFeedEvents).not.toHaveBeenCalled();
  });

  test("returns only product updates when explicitly enabled and selected", async () => {
    process.env.PRODUCT_UPDATE_UI_ENABLED = "true";

    const response = await GET(
      new Request("https://example.test/api/events?scope=product-updates")
    );

    expect(response.status).toBe(200);
    expect(mocks.listFeedEvents).toHaveBeenCalledWith(50, {
      productUpdates: "only"
    });
  });

  test("rejects unknown scopes without querying the feed", async () => {
    const response = await GET(
      new Request("https://example.test/api/events?scope=everything")
    );

    expect(response.status).toBe(400);
    expect(mocks.listFeedEvents).not.toHaveBeenCalled();
  });
});
