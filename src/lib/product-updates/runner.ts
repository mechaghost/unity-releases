import { hostname } from "node:os";
import {
  createProductUpdateRun,
  failProductUpdateRun,
  finishProductUpdateDryRun,
  finishProductUpdateNoChange,
  getProductUpdateTarget,
  heartbeatProductUpdateLease,
  loadProductUpdateSnapshot,
  productUpdatesSchemaReady,
  publishProductUpdateObservations,
  recordProductUpdateSnapshot,
  registerProductUpdateAdapter,
  releaseProductUpdateLease,
  tryAcquireProductUpdateLease
} from "./repositories";
import { fetchProductUpdateTarget, type ProductUpdateFetchOptions } from "./fetcher";
import type {
  ProductUpdateAdapter,
  ProductUpdateFetchResult,
  ProductUpdateRunResult,
  ProductUpdateSnapshot
} from "./types";
import { validateAdapterManifest, validateObservations } from "./validation";

export type RunProductUpdateOptions = {
  targetKey?: string;
  force?: boolean;
  dryRun?: boolean;
  fetchOptions?: Partial<ProductUpdateFetchOptions>;
  fetchImpl?: typeof fetch;
  now?: () => Date;
};

export async function runProductUpdateAdapter(
  adapter: ProductUpdateAdapter,
  options: RunProductUpdateOptions = {}
): Promise<ProductUpdateRunResult[]> {
  validateAdapterManifest(adapter.manifest);
  if (!(await productUpdatesSchemaReady())) {
    return adapter.manifest.targets.map((target) => ({
      sourceKey: adapter.manifest.sourceKey,
      targetKey: target.targetKey,
      status: "not-configured",
      recordsObserved: 0,
      recordsCreated: 0,
      recordsUpdated: 0
    }));
  }
  if (!options.force && process.env.PRODUCT_UPDATE_INGEST_ENABLED !== "true") {
    return adapter.manifest.targets.map((target) => ({
      sourceKey: adapter.manifest.sourceKey,
      targetKey: target.targetKey,
      status: "skipped-disabled",
      recordsObserved: 0,
      recordsCreated: 0,
      recordsUpdated: 0
    }));
  }
  const sourceAllowlist = new Set(
    (process.env.PRODUCT_UPDATE_SOURCES ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
  if (!options.force && !sourceAllowlist.has(adapter.manifest.sourceKey)) {
    return adapter.manifest.targets.map((target) => ({
      sourceKey: adapter.manifest.sourceKey,
      targetKey: target.targetKey,
      status: "skipped-disabled",
      recordsObserved: 0,
      recordsCreated: 0,
      recordsUpdated: 0
    }));
  }

  await registerProductUpdateAdapter(adapter);
  const selectedTargets = options.targetKey
    ? adapter.manifest.targets.filter((target) => target.targetKey === options.targetKey)
    : adapter.manifest.targets;
  if (selectedTargets.length === 0) {
    throw new Error(`Unknown target ${options.targetKey} for ${adapter.manifest.sourceKey}`);
  }

  const results: ProductUpdateRunResult[] = [];
  for (const targetManifest of selectedTargets) {
    results.push(await runTarget(adapter, targetManifest.targetKey, options));
  }
  return results;
}

async function runTarget(
  adapter: ProductUpdateAdapter,
  targetKey: string,
  options: RunProductUpdateOptions
): Promise<ProductUpdateRunResult> {
  const targetManifest = adapter.manifest.targets.find((target) => target.targetKey === targetKey)!;
  const target = await getProductUpdateTarget(adapter.manifest.sourceKey, targetKey);
  if (!target) throw new Error(`Target registration failed for ${adapter.manifest.sourceKey}/${targetKey}`);
  const now = options.now?.() ?? new Date();
  if (!options.force && target.nextDueAt && new Date(target.nextDueAt) > now) {
    return result(adapter, targetKey, "skipped-not-due");
  }
  if (
    !options.force &&
    target.circuitOpenUntil &&
    new Date(target.circuitOpenUntil) > now &&
    process.env.PRODUCT_UPDATE_CIRCUIT_BREAKER_ENABLED !== "false"
  ) {
    return result(adapter, targetKey, "skipped-circuit-open");
  }

  const deadlineMs = Math.max(adapter.manifest.timeoutMs * 4, 30_000);
  const lease = await tryAcquireProductUpdateLease(adapter.manifest.sourceKey, targetKey, {
    owner: `${hostname()}:${process.pid}`,
    leaseMs: deadlineMs
  });
  if (!lease) return result(adapter, targetKey, "skipped-overlap");

  const runId = await createProductUpdateRun(
    lease.target,
    adapter.manifest.parserVersion,
    deadlineMs
  );
  const heartbeat = setInterval(() => {
    void heartbeatProductUpdateLease(lease.target.targetId, lease.token, deadlineMs).catch(
      () => undefined
    );
  }, Math.max(Math.floor(deadlineMs / 3), 5_000));
  heartbeat.unref();

  let stage: "fetch" | "parse" | "publish" = "fetch";
  try {
    let fetched = await fetchProductUpdateTarget(targetManifest, lease.target, {
      timeoutMs: adapter.manifest.timeoutMs,
      maxResponseBytes: adapter.manifest.maxResponseBytes,
      fetchImpl: options.fetchImpl,
      ...options.fetchOptions
    });
    let snapshotId: number;

    if (fetched.kind === "not-modified") {
      if (
        lease.target.validatedParserVersion === adapter.manifest.parserVersion &&
        lease.target.publishedParserVersion === adapter.manifest.parserVersion
      ) {
        await finishProductUpdateNoChange({
          target: lease.target,
          leaseToken: lease.token,
          runId
        });
        return result(adapter, targetKey, "not-modified");
      }
      const replaySnapshotId =
        lease.target.observedSnapshotId ?? lease.target.validatedSnapshotId;
      if (!replaySnapshotId) {
        throw new Error("Parser version changed but no snapshot is available for replay");
      }
      const replay = await loadProductUpdateSnapshot(replaySnapshotId);
      if (!replay) throw new Error(`Snapshot ${replaySnapshotId} is unavailable for replay`);
      snapshotId = Number(replay.id);
      fetched = {
        kind: "content",
        requestedUrl: replay.requested_url,
        finalUrl: replay.final_url,
        status: replay.http_status,
        etag: replay.etag,
        lastModified: replay.last_modified,
        sha256: replay.content_sha256,
        text: replay.content_text
      };
    } else {
      snapshotId = await recordProductUpdateSnapshot(lease.target, runId, fetched);
    }

    stage = "parse";
    const snapshot: ProductUpdateSnapshot = {
      sourceKey: adapter.manifest.sourceKey,
      targetKey,
      requestedUrl: fetched.requestedUrl,
      finalUrl: fetched.finalUrl,
      fetchedAt: new Date().toISOString(),
      status: fetched.status,
      etag: fetched.etag,
      lastModified: fetched.lastModified,
      sha256: fetched.sha256,
      text: fetched.text
    };
    const observations = validateObservations(
      adapter.parse(snapshot),
      adapter.manifest,
      lease.target.lastValidatedRecordCount
    );

    if (options.dryRun) {
      await finishProductUpdateDryRun({ runId, recordsObserved: observations.length });
      return {
        ...result(adapter, targetKey, "dry-run"),
        recordsObserved: observations.length,
        snapshotId
      };
    }

    stage = "publish";
    const counts = await publishProductUpdateObservations({
      adapter,
      target: lease.target,
      leaseToken: lease.token,
      runId,
      snapshotId,
      fetched,
      observations
    });
    return {
      sourceKey: adapter.manifest.sourceKey,
      targetKey,
      status: "success",
      recordsObserved: observations.length,
      recordsCreated: counts.created,
      recordsUpdated: counts.updated,
      snapshotId
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failProductUpdateRun({
      target: lease.target,
      leaseToken: lease.token,
      runId,
      status: stage === "parse" ? "quarantined" : "failed",
      error: message
    }).catch(() => undefined);
    throw error;
  } finally {
    clearInterval(heartbeat);
    await releaseProductUpdateLease(lease.target.targetId, lease.token).catch(() => undefined);
  }
}

function result(
  adapter: ProductUpdateAdapter,
  targetKey: string,
  status: ProductUpdateRunResult["status"]
): ProductUpdateRunResult {
  return {
    sourceKey: adapter.manifest.sourceKey,
    targetKey,
    status,
    recordsObserved: 0,
    recordsCreated: 0,
    recordsUpdated: 0
  };
}
