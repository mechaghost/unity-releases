import { expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({ freshness: vi.fn() }));
vi.mock("../../src/lib/db/repositories", () => ({ listIngestionFreshness: mocks.freshness }));
import { GET } from "../../src/app/api/health/route";

test("database failures return 503", async () => {
  mocks.freshness.mockRejectedValueOnce(new Error("database unavailable"));
  const response = await GET();
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({ status: "error" });
});

test.each([
  { label: "empty", rows: [] },
  { label: "stale", rows: [{ isStale: true }] },
  { label: "fresh", rows: [{ isStale: false }] }
])("reachable database remains healthy when ingestion is $label", async ({ rows }) => {
  mocks.freshness.mockResolvedValueOnce(rows);
  expect((await GET()).status).toBe(200);
});
