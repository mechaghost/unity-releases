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
