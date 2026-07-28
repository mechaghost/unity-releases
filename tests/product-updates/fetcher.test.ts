import { describe, expect, test, vi } from "vitest";
import { fetchProductUpdateTarget } from "../../src/lib/product-updates/fetcher";
import type {
  ProductUpdateTargetManifest,
  ProductUpdateTargetState
} from "../../src/lib/product-updates/types";

const target: ProductUpdateTargetManifest = {
  targetKey: "main",
  url: "https://unity.com/releases",
  allowedHosts: ["unity.com"]
};

const state: ProductUpdateTargetState = {
  sourceId: 1,
  targetId: 2,
  sourceKey: "unity-test",
  targetKey: "main",
  url: target.url,
  status: "active",
  nextDueAt: null,
  circuitOpenUntil: null,
  validatedEtag: '"accepted"',
  validatedLastModified: "Tue, 28 Jul 2026 00:00:00 GMT",
  validatedBodyHash: null,
  validatedParserVersion: "v1",
  validatedSnapshotId: null,
  observedSnapshotId: null,
  publishedParserVersion: "v1",
  lastValidatedRecordCount: 1
};

describe("Product Updates fetcher", () => {
  test("sends only validated conditional headers and streams a bounded response", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("if-none-match")).toBe('"accepted"');
      expect(headers.get("if-modified-since")).toContain("28 Jul 2026");
      return new Response("<html>release</html>", {
        status: 200,
        headers: { "content-type": "text/html", etag: '"next"' }
      });
    });
    const result = await fetchProductUpdateTarget(target, state, {
      timeoutMs: 1_000,
      maxResponseBytes: 10_000,
      retries: 0,
      fetchImpl
    });
    expect(result.kind).toBe("content");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test("rejects a redirect target before contacting it", async () => {
    const contacted: string[] = [];
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      contacted.push(String(input));
      return new Response(null, {
        status: 302,
        headers: { location: "https://example.com/private" }
      });
    });
    await expect(
      fetchProductUpdateTarget(target, state, {
        timeoutMs: 1_000,
        maxResponseBytes: 10_000,
        retries: 0,
        fetchImpl
      })
    ).rejects.toThrow(/not allowlisted/);
    expect(contacted).toEqual(["https://unity.com/releases"]);
  });

  test("aborts a chunked response after the byte limit", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("12345"));
          controller.enqueue(new TextEncoder().encode("67890"));
          controller.close();
        }
      });
      return new Response(body, {
        status: 200,
        headers: { "content-type": "text/plain" }
      });
    });
    await expect(
      fetchProductUpdateTarget(target, state, {
        timeoutMs: 1_000,
        maxResponseBytes: 6,
        retries: 0,
        fetchImpl
      })
    ).rejects.toThrow(/exceeds 6 bytes/);
  });

  test("returns a typed 304 without reading a body", async () => {
    const result = await fetchProductUpdateTarget(target, state, {
      timeoutMs: 1_000,
      maxResponseBytes: 10_000,
      retries: 0,
      fetchImpl: async () => new Response(null, { status: 304 })
    });
    expect(result.kind).toBe("not-modified");
  });
});
