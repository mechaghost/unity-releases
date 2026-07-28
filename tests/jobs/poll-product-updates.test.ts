import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ProductUpdateAdapter } from "../../src/lib/product-updates/types";

const mocks = vi.hoisted(() => ({
  runAdapter: vi.fn(),
  findAdapter: vi.fn(),
  adaptersForFamily: vi.fn()
}));

vi.mock("../../src/lib/product-updates/runner", () => ({
  runProductUpdateAdapter: mocks.runAdapter
}));

vi.mock("../../src/lib/product-updates/sources", () => ({
  findProductUpdateAdapter: mocks.findAdapter,
  productUpdateAdaptersForFamily: mocks.adaptersForFamily
}));

import { runProductUpdateJob } from "../../src/jobs/poll-product-update";
import { runProductUpdateGroup } from "../../src/jobs/poll-product-update-group";

const hub = adapter("unity-hub");
const cli = adapter("unity-cli");

beforeEach(() => {
  mocks.runAdapter.mockReset();
  mocks.findAdapter.mockReset();
  mocks.adaptersForFamily.mockReset();
  process.exitCode = undefined;
});

afterEach(() => {
  process.exitCode = undefined;
});

describe("Product Updates jobs", () => {
  test("passes explicit safety controls to a single source", async () => {
    mocks.findAdapter.mockReturnValue(hub);
    mocks.runAdapter.mockResolvedValue([
      {
        sourceKey: "unity-hub",
        targetKey: "all-channels",
        status: "dry-run",
        recordsObserved: 2,
        recordsCreated: 0,
        recordsUpdated: 0
      }
    ]);

    await runProductUpdateJob([
      "unity-hub",
      "--target=all-channels",
      "--force",
      "--dry-run"
    ]);

    expect(mocks.runAdapter).toHaveBeenCalledWith(hub, {
      targetKey: "all-channels",
      force: true,
      dryRun: true
    });
  });

  test("accepts named source, target, and explicit snapshot replay options", async () => {
    mocks.findAdapter.mockReturnValue(hub);
    mocks.runAdapter.mockResolvedValue([
      {
        sourceKey: "unity-hub",
        targetKey: "all-channels",
        status: "dry-run",
        recordsObserved: 2,
        recordsCreated: 0,
        recordsUpdated: 0,
        snapshotId: 42
      }
    ]);

    await runProductUpdateJob([
      "--source",
      "unity-hub",
      "--target",
      "all-channels",
      "--replay",
      "42",
      "--dry-run"
    ]);

    expect(mocks.runAdapter).toHaveBeenCalledWith(hub, {
      targetKey: "all-channels",
      force: false,
      dryRun: true,
      replaySnapshotId: 42
    });
  });

  test("continues a family run after one adapter fails", async () => {
    mocks.adaptersForFamily.mockReturnValue([hub, cli]);
    const runSource = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        exitCode: 1,
        signal: null,
        timedOut: false,
        durationMs: 20,
        error: "Hub page drift"
      })
      .mockResolvedValueOnce({
        ok: true,
        exitCode: 0,
        signal: null,
        timedOut: false,
        durationMs: 10,
        output: { event: "product_update_job_complete" }
      });

    const summary = await runProductUpdateGroup([
      "editor-tooling",
      "--force"
    ], { runSource, concurrency: 1 });

    expect(summary).toMatchObject([
      {
        sourceKey: "unity-hub",
        ok: false,
        status: "failed",
        error: "Hub page drift"
      },
      { sourceKey: "unity-cli", ok: true, status: "success" }
    ]);
    expect(runSource).toHaveBeenCalledTimes(2);
    expect(process.exitCode).toBe(1);
  });

  test("records unstarted work as skipped when the group budget expires", async () => {
    mocks.adaptersForFamily.mockReturnValue([hub, cli]);
    let clock = 0;
    const runSource = vi.fn(async () => {
      clock = 10_000;
      return {
        ok: true,
        exitCode: 0,
        signal: null,
        timedOut: false,
        durationMs: 10_000
      };
    });
    const summary = await runProductUpdateGroup(
      ["editor-tooling", "--force"],
      {
        runSource,
        concurrency: 1,
        groupDeadlineMs: 10_000,
        sourceDeadlineMs: 10_000,
        now: () => clock
      }
    );
    expect(summary).toMatchObject([
      { sourceKey: "unity-hub", status: "success", ok: true },
      { sourceKey: "unity-cli", status: "skipped-budget", ok: true }
    ]);
    expect(runSource).toHaveBeenCalledTimes(1);
    expect(process.exitCode).toBeUndefined();
  });

  test("rejects unknown sources and families before running", async () => {
    mocks.findAdapter.mockReturnValue(null);
    await expect(runProductUpdateJob(["unknown"])).rejects.toThrow(
      /Unknown Product Updates source/
    );
    await expect(runProductUpdateGroup(["unknown"])).rejects.toThrow(/Usage/);
    expect(mocks.runAdapter).not.toHaveBeenCalled();
  });

  test("fails closed when named option values are missing", async () => {
    await expect(
      runProductUpdateJob(["--source", "--force"])
    ).rejects.toThrow(/Usage/);
    await expect(
      runProductUpdateJob(["--target", "all-channels", "unity-hub"])
    ).rejects.toThrow(/Usage/);
    expect(mocks.findAdapter).not.toHaveBeenCalled();
  });
});

function adapter(sourceKey: string): ProductUpdateAdapter {
  return {
    manifest: {
      sourceKey,
      displayName: sourceKey,
      family: "editor-tooling",
      parserVersion: "test-v1",
      cadenceHours: 12,
      timeoutMs: 1_000,
      maxResponseBytes: 10_000,
      minimumExpectedRecords: 1,
      targets: [
        {
          targetKey: sourceKey === "unity-hub" ? "all-channels" : "standalone",
          url: `https://unity.com/${sourceKey}`,
          allowedHosts: ["unity.com"]
        }
      ]
    },
    parse: () => []
  };
}
