import { hostname } from "node:os";
import {
  createProductUpdateRun,
  failProductUpdateRun,
  finishProductUpdateDryRun,
  finishProductUpdateDryRunFailure,
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
import {
  fetchProductUpdateTarget,
  ProductUpdateHttpError,
  type ProductUpdateFetchOptions
} from "./fetcher";
import type {
  ProductUpdateAdapter,
  ProductUpdateFailureKind,
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
  replaySnapshotId?: number;
};

export class ProductUpdateAdapterRunError extends Error {
  constructor(
    public readonly sourceKey: string,
    public readonly results: ProductUpdateRunResult[]
  ) {
    const failures = results.filter(
      (result) => result.status === "failed" || result.status === "quarantined"
    );
    super(
      `${sourceKey} failed for ${failures.length} ${failures.length === 1 ? "target" : "targets"}: ${failures
        .map((failure) => `${failure.targetKey} (${failure.error ?? failure.status})`)
        .join(", ")}`
    );
    this.name = "ProductUpdateAdapterRunError";
  }
}

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
    try {
      results.push(await runTarget(adapter, targetManifest.targetKey, options));
    } catch (error) {
      if (error instanceof ProductUpdateTargetRunError) {
        results.push({
          ...result(adapter, targetManifest.targetKey, error.status),
          error: error.message
        });
        continue;
      }
      throw error;
    }
  }
  if (
    results.some(
      (targetResult) =>
        targetResult.status === "failed" ||
        targetResult.status === "quarantined"
    )
  ) {
    throw new ProductUpdateAdapterRunError(adapter.manifest.sourceKey, results);
  }
  return results;
}

class ProductUpdateTargetRunError extends Error {
  constructor(
    public readonly status: "failed" | "quarantined",
    message: string
  ) {
    super(message);
    this.name = "ProductUpdateTargetRunError";
  }
}

async function runTarget(
  adapter: ProductUpdateAdapter,
  targetKey: string,
  options: RunProductUpdateOptions
): Promise<ProductUpdateRunResult> {
  const targetManifest = adapter.manifest.targets.find((target) => target.targetKey === targetKey)!;
  const target = await getProductUpdateTarget(adapter.manifest.sourceKey, targetKey);
  if (!target) throw new Error(`Target registration failed for ${adapter.manifest.sourceKey}/${targetKey}`);
  if (target.status === "manually-retired") {
    return result(adapter, targetKey, "skipped-retired");
  }
  const replaySnapshot = options.replaySnapshotId
    ? await loadProductUpdateSnapshot(options.replaySnapshotId)
    : null;
  if (options.replaySnapshotId && !replaySnapshot) {
    throw new Error(`Snapshot ${options.replaySnapshotId} is unavailable for replay`);
  }
  if (replaySnapshot && Number(replaySnapshot.target_id) !== target.targetId) {
    throw new Error(
      `Snapshot ${replaySnapshot.id} belongs to another Product Updates target`
    );
  }
  const now = options.now?.() ?? new Date();
  const bypassSchedule = options.force || replaySnapshot !== null;
  if (!bypassSchedule && target.nextDueAt && new Date(target.nextDueAt) > now) {
    return result(adapter, targetKey, "skipped-not-due");
  }
  if (
    !bypassSchedule &&
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

  let runId: number | null = null;
  let heartbeat: NodeJS.Timeout | null = null;
  let stage: "fetch" | "parse" | "publish" = "fetch";
  try {
    runId = await createProductUpdateRun(
      lease.target,
      adapter.manifest.parserVersion,
      deadlineMs
    );
    heartbeat = setInterval(() => {
      void heartbeatProductUpdateLease(
        lease.target.targetId,
        lease.token,
        deadlineMs
      ).catch(() => undefined);
    }, Math.max(Math.floor(deadlineMs / 3), 5_000));
    heartbeat.unref();

    let fetched: ProductUpdateFetchResult;
    let snapshotId: number | null = null;

    if (replaySnapshot) {
      snapshotId = Number(replaySnapshot.id);
      fetched = {
        kind: "content",
        requestedUrl: replaySnapshot.requested_url,
        finalUrl: replaySnapshot.final_url,
        status: replaySnapshot.http_status,
        etag: replaySnapshot.etag,
        lastModified: replaySnapshot.last_modified,
        sha256: replaySnapshot.content_sha256,
        text: replaySnapshot.content_text
      };
    } else {
      fetched = await fetchProductUpdateTarget(targetManifest, lease.target, {
        timeoutMs: adapter.manifest.timeoutMs,
        maxResponseBytes: adapter.manifest.maxResponseBytes,
        fetchImpl: options.fetchImpl,
        ...options.fetchOptions
      });
    }

    if (fetched.kind === "not-modified") {
      if (
        lease.target.validatedParserVersion === adapter.manifest.parserVersion &&
        lease.target.publishedParserVersion === adapter.manifest.parserVersion
      ) {
        if (options.dryRun) {
          await finishProductUpdateDryRun({ runId, recordsObserved: 0 });
          return result(adapter, targetKey, "dry-run");
        }
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
    } else if (!replaySnapshot) {
      snapshotId = await recordProductUpdateSnapshot(
        lease.target,
        lease.token,
        runId,
        fetched,
        { promoteObserved: !options.dryRun }
      );
    }

    if (snapshotId === null) {
      throw new Error("Product Updates snapshot resolution failed");
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
    if (runId !== null) {
      if (options.dryRun) {
        await finishProductUpdateDryRunFailure({ runId, error: message }).catch(
          () => undefined
        );
      } else {
        await failProductUpdateRun({
          target: lease.target,
          leaseToken: lease.token,
          runId,
          status: stage === "parse" ? "quarantined" : "failed",
          failureKind: classifyProductUpdateFailure(error, stage),
          error: message
        }).catch(() => undefined);
      }
    }
    throw new ProductUpdateTargetRunError(
      stage === "parse" ? "quarantined" : "failed",
      message
    );
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    await releaseProductUpdateLease(lease.target.targetId, lease.token).catch(() => undefined);
  }
}

export function classifyProductUpdateFailure(
  error: unknown,
  stage: "fetch" | "parse" | "publish"
): ProductUpdateFailureKind {
  if (stage === "parse") return "parser-drift";
  if (error instanceof ProductUpdateHttpError) {
    if (error.status === 429) return "rate-limited";
    if (error.status === 404 || error.status === 410) {
      return "not-found-candidate";
    }
    if (error.status === 401 || error.status === 403) {
      return "access-configuration-blocked";
    }
    if (error.status >= 500) return "transient";
    return "unknown";
  }
  if (
    error instanceof TypeError ||
    (error instanceof Error &&
      (error.name === "AbortError" || error.name === "TimeoutError"))
  ) {
    return "transient";
  }
  return "unknown";
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
