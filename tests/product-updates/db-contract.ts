import assert from "node:assert/strict";
import { setupE2eDatabase } from "../e2e/setup-db";
import { scopedDatabaseUrl } from "../e2e/test-database";

async function main() {
  await setupE2eDatabase();
  process.env.DATABASE_URL = scopedDatabaseUrl();
  process.env.PRODUCT_UPDATE_INGEST_ENABLED = "true";
  process.env.PRODUCT_UPDATE_CIRCUIT_BREAKER_ENABLED = "true";

  const [{ getPool, query }, { runProductUpdateAdapter }, repositories, coreRepositories] =
    await Promise.all([
    import("../../src/lib/db/client"),
    import("../../src/lib/product-updates/runner"),
    import("../../src/lib/product-updates/repositories"),
    import("../../src/lib/db/repositories")
  ]);

  const coreRunsBefore = await query<{ count: string }>("SELECT COUNT(*)::text AS count FROM ingestion_runs");
  const stableFreshness = async () =>
    (await coreRepositories.listIngestionFreshness()).map(
      ({ sourceType, lastSuccessAt, lastRunAt, isStale }) => ({
        sourceType,
        lastSuccessAt,
        lastRunAt,
        isStale
      })
    );
  const coreFreshnessBefore = JSON.stringify(await stableFreshness());
  const coreTimelineBefore = JSON.stringify(await coreRepositories.listTimelineFeed());
  const productStatsBefore = await repositories.getProductUpdateStats();
  const adapter = {
    manifest: {
      sourceKey: "db-contract",
      displayName: "DB Contract",
      family: "editor-tooling" as const,
      parserVersion: "db-v1",
      allowedEvidenceHosts: ["unity.com", "docs.unity.com"],
      cadenceHours: 24,
      timeoutMs: 1_000,
      maxResponseBytes: 100_000,
      minimumExpectedRecords: 1,
      maximumExpectedRecords: 5,
      maximumRecordDropFraction: 0.75,
      targets: [
        {
          targetKey: "main",
          url: "https://unity.com/db-contract",
          allowedHosts: ["unity.com"]
        }
      ]
    },
    parse: () => [
      {
        productKey: "db-contract-product",
        productSlug: "db-contract-product",
        productName: "DB Contract Product",
        componentKey: "main",
        sourceUpdateKey: "1.0.0",
        canonicalKey: "version:1.0.0",
        updateSlug: "1.0.0",
        version: "1.0.0",
        releaseDate: "2026-07-28T00:00:00.000Z",
        title: "DB Contract 1.0.0",
        summary: "A deterministic Product Updates database contract.",
        sourceUrl: "https://unity.com/db-contract/1.0.0",
        items: [
          {
            itemKey: "change-1",
            section: "Changes",
            changeKind: "change",
            body: "First deterministic change.",
            platforms: [],
            tags: ["contract"],
            sourceOrder: 0
          }
        ]
      }
    ]
  };

  const response = () =>
    new Response("<html>db contract</html>", {
      status: 200,
      headers: {
        "content-type": "text/html",
        etag: '"db-contract-v1"',
        "last-modified": "Tue, 28 Jul 2026 00:00:00 GMT"
      }
    });

  const first = await runProductUpdateAdapter(adapter, {
    force: true,
    fetchImpl: async () => response()
  });
  assert.equal(first[0].status, "success");
  assert.equal(first[0].recordsCreated, 1);
  assert.ok(first[0].snapshotId);

  const stableTargetState = async () =>
    (
      await query<{ state: Record<string, unknown> }>(
        `
          SELECT to_jsonb(target) - 'updated_at' AS state
          FROM product_update_targets target
          JOIN product_update_sources source ON source.id = target.source_id
          WHERE source.source_key = 'db-contract'
            AND target.target_key = 'main'
        `
      )
    ).rows[0].state;
  const initialSnapshotOwner = await query<{ run_id: string; fetched_at: string }>(
    `
      SELECT run_id::text, fetched_at
      FROM product_update_snapshots
      WHERE id = $1
    `,
    [first[0].snapshotId]
  );
  const targetBeforeDryRuns = JSON.stringify(await stableTargetState());
  const sameBodyDryRun = await runProductUpdateAdapter(adapter, {
    force: true,
    dryRun: true,
    fetchImpl: async () => response()
  });
  assert.equal(sameBodyDryRun[0].status, "dry-run");
  assert.equal(
    JSON.stringify(await stableTargetState()),
    targetBeforeDryRuns,
    "successful dry-run must not mutate target state"
  );
  const snapshotOwnerAfterDryRun = await query<{
    run_id: string;
    fetched_at: string;
  }>(
    `
      SELECT run_id::text, fetched_at
      FROM product_update_snapshots
      WHERE id = $1
    `,
    [first[0].snapshotId]
  );
  assert.deepEqual(
    snapshotOwnerAfterDryRun.rows[0],
    initialSnapshotOwner.rows[0],
    "snapshot deduplication must preserve original run provenance"
  );
  const notModifiedDryRun = await runProductUpdateAdapter(adapter, {
    force: true,
    dryRun: true,
    fetchImpl: async () => new Response(null, { status: 304 })
  });
  assert.equal(notModifiedDryRun[0].status, "dry-run");
  assert.equal(
    JSON.stringify(await stableTargetState()),
    targetBeforeDryRuns,
    "304 dry-run must not mark a target successful or advance its schedule"
  );

  const brokenDryRunAdapter = {
    ...adapter,
    manifest: { ...adapter.manifest, parserVersion: "db-dry-broken-v1" },
    parse: () => {
      throw new Error("intentional dry-run parser failure");
    }
  };
  await assert.rejects(
    runProductUpdateAdapter(brokenDryRunAdapter, {
      force: true,
      dryRun: true,
      fetchImpl: async () =>
        new Response("<html>dry-run changed structure</html>", {
          status: 200,
          headers: {
            "content-type": "text/html",
            etag: '"db-contract-dry-broken"'
          }
        })
    }),
    /intentional dry-run parser failure/
  );
  assert.equal(
    JSON.stringify(await stableTargetState()),
    targetBeforeDryRuns,
    "failed dry-run must not mutate health, circuit, or validated state"
  );

  process.env.PRODUCT_UPDATE_SOURCES = "db-contract";
  const explicitReplay = await runProductUpdateAdapter(adapter, {
    dryRun: true,
    replaySnapshotId: first[0].snapshotId,
    fetchImpl: async () => {
      throw new Error("explicit replay must not fetch");
    }
  });
  assert.equal(explicitReplay[0].status, "dry-run");
  assert.equal(explicitReplay[0].snapshotId, first[0].snapshotId);

  const productEvents = await coreRepositories.listFeedEvents(10, {
    productUpdates: "only"
  });
  const contractEvent = productEvents.find(
    (event) => event.title === "DB Contract 1.0.0"
  );
  assert.ok(contractEvent);
  assert.equal(contractEvent.event_type, "product_update");
  assert.equal(
    contractEvent.source_url,
    "/updates/products/db-contract-product/1.0.0"
  );
  const defaultEvents = await coreRepositories.listFeedEvents();
  assert.equal(
    defaultEvents.some((event) => event.event_type === "product_update"),
    false
  );
  const productStats = await repositories.getProductUpdateStats();
  assert.equal(
    productStats?.products,
    (productStatsBefore?.products ?? 0) + 1
  );
  assert.equal(
    productStats?.updates,
    (productStatsBefore?.updates ?? 0) + 1
  );

  const second = await runProductUpdateAdapter(adapter, {
    force: true,
    fetchImpl: async () => response()
  });
  assert.equal(second[0].status, "success");
  assert.equal(second[0].recordsCreated, 0);
  assert.equal(second[0].recordsUpdated, 1);

  const brokenAdapter = {
    ...adapter,
    manifest: { ...adapter.manifest, parserVersion: "db-v2" },
    parse: () => {
      throw new Error("intentional parser drift");
    }
  };
  await assert.rejects(
    runProductUpdateAdapter(brokenAdapter, {
      force: true,
      fetchImpl: async () =>
        new Response("<html>changed structure</html>", {
          status: 200,
          headers: { "content-type": "text/html", etag: '"db-contract-v2"' }
        })
    }),
    /intentional parser drift/
  );

  const multiTargetAdapter = {
    ...adapter,
    manifest: {
      ...adapter.manifest,
      sourceKey: "db-multi-target",
      displayName: "DB Multi-target Contract",
      parserVersion: "db-multi-v1",
      targets: [
        {
          targetKey: "broken",
          url: "https://unity.com/db-multi-target/broken",
          allowedHosts: ["unity.com"]
        },
        {
          targetKey: "healthy",
          url: "https://unity.com/db-multi-target/healthy",
          allowedHosts: ["unity.com"]
        }
      ]
    },
    parse: (snapshot: { targetKey: string }) => {
      if (snapshot.targetKey === "broken") {
        throw new Error("isolated target drift");
      }
      return adapter.parse();
    }
  };
  await assert.rejects(
    async () => {
      await runProductUpdateAdapter(multiTargetAdapter, {
        force: true,
        dryRun: true,
        fetchImpl: async () => response()
      });
    },
    (error: unknown) => {
      assert.ok(error && typeof error === "object" && "results" in error);
      const results = (
        error as {
          results: Array<{ targetKey: string; status: string; error?: string }>;
        }
      ).results;
      assert.deepEqual(
        results.map(({ targetKey, status }) => ({ targetKey, status })),
        [
          { targetKey: "broken", status: "quarantined" },
          { targetKey: "healthy", status: "dry-run" }
        ]
      );
      assert.match(results[0].error ?? "", /isolated target drift/);
      return true;
    }
  );

  const afterQuarantine = await repositories.listProductUpdateHealth();
  const quarantined = afterQuarantine.find(
    (source) => source.sourceKey === "db-contract"
  );
  assert.equal(quarantined?.status, "quarantined");
  assert.equal(quarantined?.consecutiveFailures, 1);

  const repairedAdapter = {
    ...adapter,
    manifest: { ...adapter.manifest, parserVersion: "db-v3" }
  };
  const replayed = await runProductUpdateAdapter(repairedAdapter, {
    force: true,
    fetchImpl: async () => new Response(null, { status: 304 })
  });
  assert.equal(replayed[0].status, "success");

  const updates = await repositories.listProductUpdates({ product: "db-contract-product" });
  assert.equal(updates.length, 1);
  assert.equal(updates[0].sourceCount, 1);
  const nextPage = await repositories.listProductUpdates({
    product: "db-contract-product",
    before: { sortTime: updates[0].sortTime, id: updates[0].id }
  });
  assert.deepEqual(nextPage, []);
  const products = await repositories.listUnityProducts("editor-tooling");
  const contractProduct = products.find(
    (product) => product.productKey === "db-contract-product"
  );
  assert.equal(contractProduct?.updateCount, 1);
  const detail = await repositories.getProductUpdateDetail(
    "db-contract-product",
    "1.0.0"
  );
  assert.equal(detail?.observations.length, 1);
  assert.equal(detail?.observations[0].items.length, 1);

  const sharedObservation = (title: string, summary: string) => [
    {
      productKey: "db-shared-product",
      productSlug: "db-shared-product",
      productName: "DB Shared Product",
      componentKey: "unity",
      sourceUpdateKey: "1.0.0",
      canonicalKey: "version:1.0.0",
      updateSlug: "1.0.0",
      version: "1.0.0",
      releaseDate: null,
      title,
      summary,
      sourceUrl: "https://docs.unity.com/db-shared/1.0.0",
      items: [
        {
          itemKey: "shared-change",
          section: "Changes",
          changeKind: "change",
          body: summary,
          platforms: [],
          tags: [],
          sourceOrder: 0
        }
      ]
    }
  ];
  const aggregateAdapter = {
    manifest: {
      ...adapter.manifest,
      sourceKey: "db-aggregate",
      displayName: "DB Aggregate",
      family: "platform-services" as const,
      parserVersion: "aggregate-v1",
      displayPriority: 50,
      targets: [
        {
          targetKey: "aggregate",
          url: "https://docs.unity.com/db-aggregate",
          allowedHosts: ["docs.unity.com"]
        }
      ]
    },
    parse: () => sharedObservation("Aggregate title", "Aggregate summary")
  };
  const specificAdapter = {
    manifest: {
      ...aggregateAdapter.manifest,
      sourceKey: "db-specific",
      displayName: "DB Specific",
      parserVersion: "specific-v1",
      displayPriority: 10,
      targets: [
        {
          targetKey: "specific",
          url: "https://docs.unity.com/db-specific",
          allowedHosts: ["docs.unity.com"]
        }
      ]
    },
    parse: () => sharedObservation("Specific title", "Specific summary")
  };
  const productResponse = (body: string) =>
    new Response(body, {
      status: 200,
      headers: { "content-type": "text/html", etag: `"${body}"` }
    });
  await runProductUpdateAdapter(aggregateAdapter, {
    force: true,
    fetchImpl: async () => productResponse("aggregate-v1")
  });
  await runProductUpdateAdapter(specificAdapter, {
    force: true,
    fetchImpl: async () => productResponse("specific-v1")
  });
  await runProductUpdateAdapter(
    {
      ...aggregateAdapter,
      manifest: { ...aggregateAdapter.manifest, parserVersion: "aggregate-v2" },
      parse: () =>
        sharedObservation("Changed aggregate title", "Changed aggregate summary")
    },
    {
      force: true,
      fetchImpl: async () => productResponse("aggregate-v2")
    }
  );
  const reconciled = await repositories.listProductUpdates({
    product: "db-shared-product"
  });
  assert.equal(reconciled.length, 1);
  assert.equal(reconciled[0].title, "Specific title");
  assert.equal(reconciled[0].summary, "Specific summary");
  assert.equal(reconciled[0].sourceCount, 2);

  const targetPriorityAdapter = {
    manifest: {
      ...adapter.manifest,
      sourceKey: "db-target-priority",
      displayName: "DB Target Priority",
      parserVersion: "target-priority-v1",
      targets: [
        {
          targetKey: "index",
          url: "https://docs.unity.com/db-target-priority",
          allowedHosts: ["docs.unity.com"],
          displayPriority: 100
        },
        {
          targetKey: "detail",
          url: "https://docs.unity.com/db-target-priority/1.0.0",
          allowedHosts: ["docs.unity.com"],
          displayPriority: 10
        }
      ]
    },
    parse: (snapshot: { targetKey: string }) => {
      const detailed = snapshot.targetKey === "detail";
      return [
        {
          ...adapter.parse()[0],
          productKey: "db-target-priority-product",
          productSlug: "db-target-priority-product",
          productName: detailed
            ? "Detailed Product Name"
            : "Generic Product Name",
          productDescription: detailed
            ? "Detailed product description."
            : "Generic index description.",
          productCanonicalUrl:
            "https://docs.unity.com/db-target-priority/product",
          sourceUpdateKey: detailed ? "detail:1.0.0" : "index:1.0.0",
          title: detailed ? "Detailed release title" : "Generic index title",
          summary: detailed
            ? "Detailed release summary."
            : "Generic index summary.",
          sourceUrl: detailed
            ? "https://docs.unity.com/db-target-priority/1.0.0"
            : "https://docs.unity.com/db-target-priority"
        }
      ];
    }
  };
  await runProductUpdateAdapter(targetPriorityAdapter, {
    force: true,
    fetchImpl: async (input) => productResponse(String(input))
  });
  const targetPriorityUpdate = await repositories.listProductUpdates({
    product: "db-target-priority-product"
  });
  assert.equal(targetPriorityUpdate[0].title, "Detailed release title");
  assert.equal(targetPriorityUpdate[0].summary, "Detailed release summary.");
  const targetPriorityProduct = await repositories.getUnityProductBySlug(
    "db-target-priority-product"
  );
  assert.equal(targetPriorityProduct?.displayName, "Detailed Product Name");
  assert.equal(
    targetPriorityProduct?.description,
    "Detailed product description."
  );

  const bulkObservationCount = 149;
  const bulkItemsPerObservation = 24;
  const bulkAdapter = {
    manifest: {
      ...adapter.manifest,
      sourceKey: "db-bulk-contract",
      displayName: "DB Bulk Publish Contract",
      parserVersion: "db-bulk-v1",
      maximumExpectedRecords: 200,
      targets: [
        {
          targetKey: "main",
          url: "https://unity.com/db-bulk-contract",
          allowedHosts: ["unity.com"]
        }
      ]
    },
    parse: () =>
      Array.from({ length: bulkObservationCount }, (_, observationIndex) => {
        const version = `1.0.${observationIndex + 1}`;
        return {
          ...adapter.parse()[0],
          productKey: "db-bulk-product",
          productSlug: "db-bulk-product",
          productName: "DB Bulk Product",
          sourceUpdateKey: version,
          canonicalKey: `version:${version}`,
          updateSlug: version,
          version,
          title: `DB Bulk Product ${version}`,
          sourceUrl: `https://unity.com/db-bulk-contract/${version}`,
          items: Array.from(
            { length: bulkItemsPerObservation },
            (_, itemIndex) => ({
              itemKey: `item-${itemIndex + 1}`,
              section: "Changes",
              changeKind: "change",
              body: `Bulk change ${itemIndex + 1} for ${version}.`,
              platforms: ["Windows", "macOS"],
              tags: ["bulk-contract"],
              sourceOrder: itemIndex
            })
          )
        };
      })
  };
  const bulkStartedAt = Date.now();
  const bulkPublished = await runProductUpdateAdapter(bulkAdapter, {
    force: true,
    fetchImpl: async () => productResponse("bulk-contract")
  });
  const bulkDurationMs = Date.now() - bulkStartedAt;
  assert.equal(bulkPublished[0].recordsCreated, bulkObservationCount);
  const bulkItemCount = await query<{ count: string }>(
    `
      SELECT COUNT(*)::text AS count
      FROM product_update_observation_items item
      JOIN product_update_observations observation
        ON observation.id = item.observation_id
      JOIN product_updates product_update
        ON product_update.id = observation.product_update_id
      JOIN unity_products product ON product.id = product_update.product_id
      WHERE product.product_key = 'db-bulk-product'
    `
  );
  assert.equal(
    Number(bulkItemCount.rows[0].count),
    bulkObservationCount * bulkItemsPerObservation
  );
  assert.ok(
    bulkDurationMs < 10_000,
    `bulk publish took ${bulkDurationMs}ms; expected substantial margin under the 30s deadline`
  );

  const retirementAdapter = {
    manifest: {
      ...adapter.manifest,
      sourceKey: "db-retirement",
      displayName: "DB Retirement",
      parserVersion: "retirement-v1",
      targets: [
        {
          targetKey: "main",
          url: "https://unity.com/db-retirement",
          allowedHosts: ["unity.com"]
        }
      ]
    },
    parse: () => [
      {
        ...adapter.parse()[0],
        productKey: "db-retirement-product",
        productSlug: "db-retirement-product",
        productName: "DB Retirement Product",
        sourceUrl: "https://unity.com/db-retirement/1.0.0"
      }
    ]
  };
  for (let probe = 1; probe <= 3; probe += 1) {
    await assert.rejects(
      runProductUpdateAdapter(retirementAdapter, {
        force: true,
        fetchImpl: async () =>
          new Response("missing", {
            status: 404,
            headers: { "content-type": "text/plain" }
          })
      }),
      /HTTP 404/
    );
    const retirementHealth = (
      await repositories.listProductUpdateHealth()
    ).find((source) => source.sourceKey === "db-retirement");
    assert.equal(retirementHealth?.notFoundProbeCount, probe);
    assert.equal(
      retirementHealth?.status,
      probe === 3 ? "suspected-retired" : "not-found-candidate"
    );
    if (probe < 3) {
      await query(
        `
          UPDATE product_update_targets target
          SET last_attempt_at = now() - interval '7 hours'
          FROM product_update_sources source
          WHERE target.source_id = source.id
            AND source.source_key = 'db-retirement'
            AND target.target_key = 'main'
        `
      );
    }
  }

  const retirementRecovery = await runProductUpdateAdapter(
    retirementAdapter,
    {
      force: true,
      fetchImpl: async () => productResponse("retirement-recovered")
    }
  );
  assert.equal(retirementRecovery[0].status, "success");
  const recoveredHealth = (
    await repositories.listProductUpdateHealth()
  ).find((source) => source.sourceKey === "db-retirement");
  assert.equal(recoveredHealth?.status, "active");
  assert.equal(recoveredHealth?.notFoundProbeCount, 0);

  const manualRetirement = await runProductUpdateAdapter(
    {
      ...retirementAdapter,
      manifest: {
        ...retirementAdapter.manifest,
        targets: retirementAdapter.manifest.targets.map((target) => ({
          ...target,
          retired: true
        }))
      }
    },
    { force: true }
  );
  assert.equal(manualRetirement[0].status, "skipped-retired");
  const reactivated = await runProductUpdateAdapter(retirementAdapter, {
    force: true,
    fetchImpl: async () => productResponse("retirement-reactivated")
  });
  assert.equal(reactivated[0].status, "success");

  const health = await repositories.listProductUpdateHealth();
  assert.equal(
    health.find((source) => source.sourceKey === "db-contract")
      ?.consecutiveFailures,
    0
  );

  const leaseAdapter = {
    ...adapter,
    manifest: {
      ...adapter.manifest,
      sourceKey: "db-lease-contract",
      displayName: "DB Lease Contract",
      parserVersion: "db-lease-v1",
      targets: [
        {
          targetKey: "main",
          url: "https://unity.com/db-lease-contract",
          allowedHosts: ["unity.com"]
        }
      ]
    }
  };
  await repositories.registerProductUpdateAdapter(leaseAdapter);
  const simultaneousLeases = await Promise.all([
    repositories.tryAcquireProductUpdateLease(
      "db-lease-contract",
      "main",
      { owner: "lease-a", leaseMs: 30_000 }
    ),
    repositories.tryAcquireProductUpdateLease(
      "db-lease-contract",
      "main",
      { owner: "lease-b", leaseMs: 30_000 }
    )
  ]);
  assert.equal(
    simultaneousLeases.filter(Boolean).length,
    1,
    "only one concurrent worker may acquire a target"
  );
  const winningLease = simultaneousLeases.find(Boolean);
  assert.ok(winningLease);
  await repositories.releaseProductUpdateLease(
    winningLease.target.targetId,
    winningLease.token
  );

  const fencedLease = await repositories.tryAcquireProductUpdateLease(
    "db-lease-contract",
    "main",
    { owner: "lease-fence", leaseMs: 30_000 }
  );
  assert.ok(fencedLease);
  const fencedRunId = await repositories.createProductUpdateRun(
    fencedLease.target,
    leaseAdapter.manifest.parserVersion,
    30_000
  );
  const observedBeforeFence = (
    await repositories.getProductUpdateTarget("db-lease-contract", "main")
  )?.observedSnapshotId;
  await assert.rejects(
    repositories.recordProductUpdateSnapshot(
      fencedLease.target,
      "stale-lease-token",
      fencedRunId,
      {
        kind: "content",
        requestedUrl: fencedLease.target.url,
        finalUrl: fencedLease.target.url,
        status: 200,
        etag: '"lease-fence"',
        lastModified: null,
        sha256: "lease-fence-snapshot",
        text: "lease fence body"
      }
    ),
    /lease was lost before snapshot promotion/
  );
  assert.equal(
    (
      await repositories.getProductUpdateTarget(
        "db-lease-contract",
        "main"
      )
    )?.observedSnapshotId,
    observedBeforeFence
  );
  await repositories.finishProductUpdateDryRunFailure({
    runId: fencedRunId,
    error: "intentional lease-fence contract"
  });
  await repositories.releaseProductUpdateLease(
    fencedLease.target.targetId,
    fencedLease.token
  );

  const abandonedAdapter = {
    ...leaseAdapter,
    manifest: {
      ...leaseAdapter.manifest,
      sourceKey: "db-abandoned-contract",
      displayName: "DB Abandoned Contract"
    }
  };
  await repositories.registerProductUpdateAdapter(abandonedAdapter);
  const abandonedTarget = await repositories.getProductUpdateTarget(
    "db-abandoned-contract",
    "main"
  );
  assert.ok(abandonedTarget);
  await query(
    `
      INSERT INTO product_update_runs (
        source_id, target_id, job_name, parser_version, started_at,
        deadline_at, status
      )
      SELECT
        $1, $2, 'abandoned-contract-' || value, 'db-abandoned-v1',
        now() - interval '2 hours', now() - interval '1 hour', 'running'
      FROM generate_series(1, 3) AS value
    `,
    [abandonedTarget.sourceId, abandonedTarget.targetId]
  );
  const recoveryLease = await repositories.tryAcquireProductUpdateLease(
    "db-abandoned-contract",
    "main",
    { owner: "abandoned-recovery", leaseMs: 30_000 }
  );
  assert.ok(recoveryLease);
  const abandonedState = await query<{
    consecutive_failures: number;
    circuit_open_until: string | null;
    next_due_at: string | null;
  }>(
    `
      SELECT consecutive_failures, circuit_open_until, next_due_at
      FROM product_update_targets
      WHERE id = $1
    `,
    [abandonedTarget.targetId]
  );
  assert.equal(Number(abandonedState.rows[0].consecutive_failures), 3);
  assert.ok(abandonedState.rows[0].circuit_open_until);
  assert.ok(abandonedState.rows[0].next_due_at);
  await repositories.releaseProductUpdateLease(
    recoveryLease.target.targetId,
    recoveryLease.token
  );

  const coreRunsAfter = await query<{ count: string }>("SELECT COUNT(*)::text AS count FROM ingestion_runs");
  assert.equal(coreRunsAfter.rows[0].count, coreRunsBefore.rows[0].count);
  assert.equal(JSON.stringify(await stableFreshness()), coreFreshnessBefore);
  assert.equal(JSON.stringify(await coreRepositories.listTimelineFeed()), coreTimelineBefore);

  const canonicalCount = await query<{ count: string }>(
    `
      SELECT COUNT(*)::text AS count
      FROM product_updates u
      JOIN unity_products p ON p.id = u.product_id
      WHERE p.product_key = 'db-contract-product'
    `
  );
  const itemCount = await query<{ count: string }>(
    `
      SELECT COUNT(*)::text AS count
      FROM product_update_observation_items i
      JOIN product_update_observations o ON o.id = i.observation_id
      JOIN product_updates u ON u.id = o.product_update_id
      JOIN unity_products p ON p.id = u.product_id
      WHERE p.product_key = 'db-contract-product'
    `
  );
  assert.equal(canonicalCount.rows[0].count, "1");
  assert.equal(itemCount.rows[0].count, "1");
  const accepted = await query<{
    validated_etag: string;
    validated_parser_version: string;
    observed_etag: string;
  }>(
    `
      SELECT validated_etag, validated_parser_version, observed_etag
      FROM product_update_targets t
      JOIN product_update_sources s ON s.id = t.source_id
      WHERE s.source_key = 'db-contract' AND t.target_key = 'main'
    `
  );
  assert.equal(accepted.rows[0].observed_etag, '"db-contract-v2"');
  assert.equal(accepted.rows[0].validated_etag, '"db-contract-v2"');
  assert.equal(accepted.rows[0].validated_parser_version, "db-v3");

  try {
    await query(
      "ALTER TABLE product_update_observation_items RENAME TO unavailable_product_update_observation_items"
    );
    assert.equal(await repositories.productUpdatesSchemaReady(), false);
    await query(
      "ALTER TABLE content_events DROP COLUMN product_update_id"
    );
    assert.equal(await repositories.productUpdatesSchemaReady(), false);
    assert.equal(
      (await coreRepositories.listFeedEvents()).some(
        (event) => event.event_type === "product_update"
      ),
      false
    );
    assert.equal(
      JSON.stringify(await coreRepositories.listTimelineFeed()),
      coreTimelineBefore,
      "core timeline must survive a missing optional migration"
    );
    await coreRepositories.listFeedEventsByType("blog_post");
  } finally {
    await setupE2eDatabase();
  }
  assert.equal(await repositories.productUpdatesSchemaReady(), true);

  await getPool().end();
  console.log("Product Updates database contract passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
