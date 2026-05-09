import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPackage: vi.fn()
}));

vi.mock("@/lib/db/repositories", () => ({
  getPackage: mocks.getPackage
}));

import { GET } from "@/app/api/packages/[name]/versions/route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/packages/[name]/versions", () => {
  test("rejects invalid package-name shapes before querying", async () => {
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ name: "../../../release_notes" })
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid-name" });
    expect(mocks.getPackage).not.toHaveBeenCalled();
  });

  test("rejects malformed percent-encoded names before querying", async () => {
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ name: "%E0%A4%A" })
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid-name" });
    expect(mocks.getPackage).not.toHaveBeenCalled();
  });

  test("accepts Unity package names and trims returned changelogs", async () => {
    mocks.getPackage.mockResolvedValueOnce({
      package: {
        name: "com.unity.inputsystem",
        display_name: "Input System",
        description: "Input package",
        source_url: "https://example.test"
      },
      versions: [
        {
          version: "1.0.0",
          published_at: "2026-01-01T00:00:00Z",
          is_prerelease: false,
          unity_compatibility: "6000.0",
          changelog: "  Fixed input.  "
        }
      ]
    });

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ name: "com.unity.inputsystem" })
    });

    expect(response.status).toBe(200);
    expect(mocks.getPackage).toHaveBeenCalledWith("com.unity.inputsystem");
    await expect(response.json()).resolves.toMatchObject({
      name: "com.unity.inputsystem",
      totalVersions: 1,
      versions: [{ changelog: "Fixed input." }]
    });
  });
});
