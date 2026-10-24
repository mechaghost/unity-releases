import { beforeEach, describe, expect, test, vi } from "vitest";
const search = vi.hoisted(() => vi.fn());
vi.mock("../../src/lib/db/repositories", () => ({ searchReleaseNotes: search }));
import { GET } from "../../src/app/api/release-notes/route";

describe("release notes pagination", () => {
  beforeEach(() => { search.mockReset(); search.mockResolvedValue([]); });
  test.each(["limit=-1", "limit=0", "limit=1.5", "limit=1001", "limit=Infinity", "limit=no", "limit=", "offset=-1", "offset=1.5", "offset=2147483648"])("rejects %s before querying", async query => {
    const response = await GET(new Request(`http://localhost/api/release-notes?${query}`));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/must be an integer/);
    expect(search).not.toHaveBeenCalled();
  });
  test("accepts bounded pagination and repeated filters", async () => {
    const response = await GET(new Request("http://localhost/api/release-notes?limit=1000&offset=20&platform=iOS&platform=Android"));
    expect(response.status).toBe(200);
    expect(search).toHaveBeenCalledWith(expect.objectContaining({ limit: 1000, offset: 20, platform: ["iOS", "Android"] }));
  });
  test("hides database errors", async () => {
    search.mockRejectedValue(new Error("password and PostgreSQL internal details"));
    const response = await GET(new Request("http://localhost/api/release-notes"));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Unable to complete the request." });
  });
});
