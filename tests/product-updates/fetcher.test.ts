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
  failureKind: null,
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

  test("honors bounded Retry-After and retries 429 or 5xx responses", async () => {
    const rateLimited = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 429,
          headers: { "retry-after": "0" }
        })
      )
      .mockResolvedValueOnce(
        new Response("recovered", {
          status: 200,
          headers: { "content-type": "text/plain" }
        })
      );
    await expect(
      fetchProductUpdateTarget(target, state, {
        timeoutMs: 1_000,
        maxResponseBytes: 10_000,
        retries: 1,
        fetchImpl: rateLimited
      })
    ).resolves.toMatchObject({ kind: "content", text: "recovered" });
    expect(rateLimited).toHaveBeenCalledTimes(2);

    const unavailable = vi.fn<typeof fetch>(async () =>
      new Response(null, { status: 503 })
    );
    await expect(
      fetchProductUpdateTarget(target, state, {
        timeoutMs: 1_000,
        maxResponseBytes: 10_000,
        retries: 1,
        fetchImpl: unavailable
      })
    ).rejects.toMatchObject({ status: 503 });
    expect(unavailable).toHaveBeenCalledTimes(2);
  });

  test("aborts an upstream request at the configured timeout", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async (_input, init) =>
        await new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(init.signal?.reason),
            { once: true }
          );
        })
    );
    await expect(
      fetchProductUpdateTarget(target, state, {
        timeoutMs: 20,
        maxResponseBytes: 10_000,
        retries: 0,
        fetchImpl
      })
    ).rejects.toThrow();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test("rejects redirect loops and redirect-hop exhaustion", async () => {
    const loop = vi.fn<typeof fetch>(async () =>
      new Response(null, {
        status: 302,
        headers: { location: target.url }
      })
    );
    await expect(
      fetchProductUpdateTarget(target, state, {
        timeoutMs: 1_000,
        maxResponseBytes: 10_000,
        retries: 0,
        fetchImpl: loop
      })
    ).rejects.toThrow(/Redirect loop/);
    expect(loop).toHaveBeenCalledTimes(1);

    const endless = vi.fn<typeof fetch>(async (input) =>
      new Response(null, {
        status: 302,
        headers: {
          location: `${String(input).replace(/\/$/, "")}/next`
        }
      })
    );
    await expect(
      fetchProductUpdateTarget(target, state, {
        timeoutMs: 1_000,
        maxResponseBytes: 10_000,
        retries: 0,
        maxRedirects: 1,
        fetchImpl: endless
      })
    ).rejects.toThrow(/Too many redirects/);
    expect(endless).toHaveBeenCalledTimes(2);
  });

  test("rejects unsupported content and declared oversize responses", async () => {
    await expect(
      fetchProductUpdateTarget(target, state, {
        timeoutMs: 1_000,
        maxResponseBytes: 10_000,
        retries: 0,
        fetchImpl: async () =>
          new Response("binary", {
            status: 200,
            headers: { "content-type": "application/octet-stream" }
          })
      })
    ).rejects.toThrow(/Unsupported content type/);

    await expect(
      fetchProductUpdateTarget(target, state, {
        timeoutMs: 1_000,
        maxResponseBytes: 5,
        retries: 0,
        fetchImpl: async () =>
          new Response("tiny", {
            status: 200,
            headers: {
              "content-type": "text/plain",
              "content-length": "100"
            }
          })
      })
    ).rejects.toThrow(/exceeds 5 bytes/);
  });
});
