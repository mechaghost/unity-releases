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

  test("continues a family run after one adapter fails", async () => {
    mocks.adaptersForFamily.mockReturnValue([hub, cli]);
    mocks.runAdapter
      .mockRejectedValueOnce(new Error("Hub page drift"))
      .mockResolvedValueOnce([
        {
          sourceKey: "unity-cli",
          targetKey: "standalone",
          status: "success",
          recordsObserved: 2,
          recordsCreated: 2,
          recordsUpdated: 0
        }
      ]);

    const summary = await runProductUpdateGroup([
      "editor-tooling",
      "--force"
    ]);

    expect(summary).toMatchObject([
      { sourceKey: "unity-hub", ok: false, error: "Hub page drift" },
      { sourceKey: "unity-cli", ok: true }
    ]);
    expect(mocks.runAdapter).toHaveBeenCalledTimes(2);
    expect(process.exitCode).toBe(1);
  });

  test("rejects unknown sources and families before running", async () => {
    mocks.findAdapter.mockReturnValue(null);
    await expect(runProductUpdateJob(["unknown"])).rejects.toThrow(
      /Unknown Product Updates source/
    );
    await expect(runProductUpdateGroup(["unknown"])).rejects.toThrow(/Usage/);
    expect(mocks.runAdapter).not.toHaveBeenCalled();
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
