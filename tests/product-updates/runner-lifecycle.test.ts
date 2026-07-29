import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ProductUpdateAdapter } from "../../src/lib/product-updates/types";

const mocks = vi.hoisted(() => ({
  register: vi.fn(),
  schemaReady: vi.fn(),
  getTarget: vi.fn(),
  acquire: vi.fn(),
  createRun: vi.fn(),
  release: vi.fn()
}));

vi.mock("../../src/lib/product-updates/repositories", () => ({
  registerProductUpdateAdapter: mocks.register,
  productUpdatesSchemaReady: mocks.schemaReady,
  getProductUpdateTarget: mocks.getTarget,
  tryAcquireProductUpdateLease: mocks.acquire,
  createProductUpdateRun: mocks.createRun,
  releaseProductUpdateLease: mocks.release,
  failProductUpdateRun: vi.fn(),
  finishProductUpdateDryRun: vi.fn(),
  finishProductUpdateDryRunFailure: vi.fn(),
  finishProductUpdateNoChange: vi.fn(),
  heartbeatProductUpdateLease: vi.fn(),
  loadProductUpdateSnapshot: vi.fn(),
  publishProductUpdateObservations: vi.fn(),
  recordProductUpdateSnapshot: vi.fn()
}));

import { runProductUpdateAdapter } from "../../src/lib/product-updates/runner";

const target = {
  sourceId: 1,
  targetId: 2,
  sourceKey: "lifecycle-source",
  targetKey: "main",
  url: "https://unity.com/lifecycle",
  status: "active",
  failureKind: null,
  nextDueAt: null,
  circuitOpenUntil: null,
  validatedEtag: null,
  validatedLastModified: null,
  validatedBodyHash: null,
  validatedParserVersion: null,
  validatedSnapshotId: null,
  observedSnapshotId: null,
  publishedParserVersion: null,
  lastValidatedRecordCount: null
};

const adapter: ProductUpdateAdapter = {
  manifest: {
    sourceKey: "lifecycle-source",
    displayName: "Lifecycle Source",
    family: "editor-tooling",
    parserVersion: "lifecycle-v1",
    allowedEvidenceHosts: ["unity.com"],
    cadenceHours: 24,
    timeoutMs: 1_000,
    maxResponseBytes: 10_000,
    minimumExpectedRecords: 1,
    targets: [
      {
        targetKey: "main",
        url: target.url,
        allowedHosts: ["unity.com"]
      }
    ]
  },
  parse: () => []
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.schemaReady.mockResolvedValue(true);
  mocks.register.mockResolvedValue(undefined);
  mocks.getTarget.mockResolvedValue(target);
  mocks.acquire.mockResolvedValue({ token: "lease-token", target });
  mocks.release.mockResolvedValue(undefined);
});

describe("Product Updates runner lifecycle", () => {
  test("releases a lease when run creation fails before heartbeat setup", async () => {
    mocks.createRun.mockRejectedValue(new Error("run insert unavailable"));

    await expect(
      runProductUpdateAdapter(adapter, { force: true })
    ).rejects.toThrow(/run insert unavailable/);
    expect(mocks.release).toHaveBeenCalledOnce();
    expect(mocks.release).toHaveBeenCalledWith(target.targetId, "lease-token");
  });
});
