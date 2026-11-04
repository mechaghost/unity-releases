import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ProductUpdateAdapter } from "../../src/lib/product-updates/types";

const mocks = vi.hoisted(() => ({
  register: vi.fn(),
  schemaReady: vi.fn(),
  getTarget: vi.fn(),
  acquire: vi.fn(),
  createRun: vi.fn(),
  record: vi.fn(),
  publish: vi.fn(),
  load: vi.fn(),
  fail: vi.fn(),
  release: vi.fn()
}));

vi.mock("../../src/lib/product-updates/repositories", () => ({
  registerProductUpdateAdapter: mocks.register,
  productUpdatesSchemaReady: mocks.schemaReady,
  getProductUpdateTarget: mocks.getTarget,
  tryAcquireProductUpdateLease: mocks.acquire,
  createProductUpdateRun: mocks.createRun,
  releaseProductUpdateLease: mocks.release,
  failProductUpdateRun: mocks.fail,
  finishProductUpdateDryRun: vi.fn(),
  finishProductUpdateDryRunFailure: vi.fn(),
  finishProductUpdateNoChange: vi.fn(),
  heartbeatProductUpdateLease: vi.fn(),
  loadProductUpdateSnapshot: mocks.load,
  publishProductUpdateObservations: mocks.publish,
  recordProductUpdateSnapshot: mocks.record
}));

import { unityVersionControlAdapter } from "../../src/lib/product-updates/sources/unity-version-control";
import { levelPlayMediationAdapterSources } from "../../src/lib/product-updates/sources/levelplay-mediation-adapters";
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
  // next_due_at is stamped from the *success* time, a minute or two after
  // the cron fired, so the next day's cron reached the target a minute or
  // two before it was due and skipped the whole source. Daily sources were
  // landing ~3 days in 5 (Sep 5/7/8 ran, Sep 6/9 skipped).
  // The env gates sit in front of the due check; force:true would bypass
  // the schedule too, which is the very thing under test.
  const scheduled = { ingest: process.env.PRODUCT_UPDATE_INGEST_ENABLED, sources: process.env.PRODUCT_UPDATE_SOURCES };
  const enableScheduling = () => {
    process.env.PRODUCT_UPDATE_INGEST_ENABLED = "true";
    process.env.PRODUCT_UPDATE_SOURCES = adapter.manifest.sourceKey;
  };
  const restoreScheduling = () => {
    if (scheduled.ingest === undefined) delete process.env.PRODUCT_UPDATE_INGEST_ENABLED;
    else process.env.PRODUCT_UPDATE_INGEST_ENABLED = scheduled.ingest;
    if (scheduled.sources === undefined) delete process.env.PRODUCT_UPDATE_SOURCES;
    else process.env.PRODUCT_UPDATE_SOURCES = scheduled.sources;
  };

  test("runs a target that comes due within the tolerance window", async () => {
    enableScheduling();
    const now = new Date("2026-09-09T04:47:00Z");
    mocks.getTarget.mockResolvedValue({
      ...target,
      nextDueAt: "2026-09-09T04:49:00Z" // 2 minutes ahead, like the real drift
    });
    mocks.createRun.mockRejectedValue(new Error("reached the run stage"));

    await expect(
      runProductUpdateAdapter(adapter, { now: () => now })
    ).rejects.toThrow(/reached the run stage/);
    // Proof it went past the due gate: it took a lease.
    expect(mocks.acquire).toHaveBeenCalledOnce();
    restoreScheduling();
  });

  test("still skips a target that is due well outside the tolerance", async () => {
    enableScheduling();
    const now = new Date("2026-09-09T04:47:00Z");
    mocks.getTarget.mockResolvedValue({
      ...target,
      nextDueAt: "2026-09-09T08:00:00Z" // > 1h ahead on a 24h cadence
    });

    const results = await runProductUpdateAdapter(adapter, { now: () => now });
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("skipped-not-due");
    expect(mocks.acquire).not.toHaveBeenCalled();
    restoreScheduling();
  });

  test.each(["tencent-ios", "vk-ad-network-ios", "vk-ad-network-android"])("retired %s skips safely even when forced and never fetches or acquires a publication lease", async (targetKey) => {
    const retired = levelPlayMediationAdapterSources.find(a => a.manifest.sourceKey === `levelplay-adapter-${targetKey}`)!;
    mocks.getTarget.mockResolvedValue({ ...target, sourceKey: retired.manifest.sourceKey,
      targetKey, status: "manually-retired", lastValidatedRecordCount: 18 });
    const fetchImpl = vi.fn<typeof fetch>();
    const results = await runProductUpdateAdapter(retired, { force: true, fetchImpl });
    expect(results[0].status).toBe("skipped-retired");
    expect(mocks.register).toHaveBeenCalledWith(retired);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(mocks.acquire).not.toHaveBeenCalled();
    expect(mocks.createRun).not.toHaveBeenCalled();
  });

  test("releases a lease when run creation fails before heartbeat setup", async () => {
    mocks.createRun.mockRejectedValue(new Error("run insert unavailable"));

    await expect(
      runProductUpdateAdapter(adapter, { force: true })
    ).rejects.toThrow(/run insert unavailable/);
    expect(mocks.release).toHaveBeenCalledOnce();
    expect(mocks.release).toHaveBeenCalledWith(target.targetId, "lease-token");
  });
});


describe("complete Version Control evidence in the runner", () => {
  const fixture = (name: string) => readFileSync(new URL(`../fixtures/product-updates/markdown/uvcs-years/${name}.md`, import.meta.url), "utf8");
  const uvcsTarget = { ...target, sourceKey: "unity-version-control", targetKey: "major-11", url: unityVersionControlAdapter.manifest.targets[0].url, lastValidatedRecordCount: 156 };
  const setup = () => {
    mocks.getTarget.mockResolvedValue(uvcsTarget);
    mocks.acquire.mockResolvedValue({token: "lease-token",target: uvcsTarget});
    mocks.createRun.mockResolvedValue(1);
    mocks.record.mockResolvedValue(2);
    mocks.publish.mockResolvedValue({created: 0,updated: 156});
    mocks.fail.mockResolvedValue(undefined);
  };
  test("publishes only the complete collection and replays it without fetching", async () => {
    setup();
    const fetchImpl = vi.fn<typeof fetch>(async input => {
      const name = String(input).match(/\/(20\d{2})\.md$/)?.[1] ?? "index";
      return new Response(fixture(name), {headers: {"content-type":"text/markdown"}});
    });
    const results = await runProductUpdateAdapter(unityVersionControlAdapter, {force: true,fetchImpl});
    expect(results[0]).toMatchObject({status:"success",recordsObserved:156});
    const published = mocks.publish.mock.calls[0][0];
    expect(published.observations).toHaveLength(156);
    expect(JSON.parse(published.fetched.text).years).toHaveLength(5);
    mocks.load.mockResolvedValue({id:2,source_id:1,target_id:2,requested_url:uvcsTarget.url,final_url:uvcsTarget.url,http_status:200,etag:null,last_modified:null,content_sha256:published.fetched.sha256,content_text:published.fetched.text});
    fetchImpl.mockClear();
    const replay = await runProductUpdateAdapter(unityVersionControlAdapter,{force:true,replaySnapshotId:2,fetchImpl});
    expect(replay[0]).toMatchObject({status:"success",recordsObserved:156});
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(mocks.publish.mock.calls[1][0].observations).toEqual(published.observations);
  });
  test("does not publish or replace snapshots when a historical year fetch fails", async () => {
    setup();
    const fetchImpl = vi.fn<typeof fetch>(async input => {
      const name = String(input).match(/\/(20\d{2})\.md$/)?.[1] ?? "index";
      return name === "2022" ? new Response("",{status:503}) : new Response(fixture(name));
    });
    await expect(runProductUpdateAdapter(unityVersionControlAdapter,{force:true,fetchImpl,fetchOptions:{retries:0}})).rejects.toThrow(/503/);
    expect(mocks.publish).not.toHaveBeenCalled();
    expect(mocks.record).not.toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalledOnce();
  });
});
