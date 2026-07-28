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

  const health = await repositories.listProductUpdateHealth();
  assert.equal(
    health.find((source) => source.sourceKey === "db-contract")
      ?.consecutiveFailures,
    0
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

  await getPool().end();
  console.log("Product Updates database contract passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
