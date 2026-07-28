import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { getPool, query } from "../db/client";
import { sha256 } from "../ingest/hash";
import { normalizedObservationHash } from "./normalization";
import type {
  NormalizedProductUpdateObservation,
  ProductUpdateAdapter,
  ProductUpdateFetchResult,
  ProductUpdateTargetState
} from "./types";

type RegisteredTarget = ProductUpdateTargetState & {
  cadenceHours: number;
};

export async function productUpdatesSchemaReady() {
  try {
    const result = await query<{ ready: boolean }>(
      `SELECT to_regclass('product_update_runs') IS NOT NULL
          AND to_regclass('product_update_targets') IS NOT NULL
          AND to_regclass('product_update_observations') IS NOT NULL AS ready`
    );
    return result.rows[0]?.ready ?? false;
  } catch {
    return false;
  }
}

export async function registerProductUpdateAdapter(adapter: ProductUpdateAdapter) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const sourceResult = await client.query<{ id: number }>(
      `
        INSERT INTO product_update_sources (
          source_key, display_name, family, parser_version, display_priority,
          enabled_by_default
        )
        VALUES ($1, $2, $3, $4, $5, false)
        ON CONFLICT (source_key) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          family = EXCLUDED.family,
          parser_version = EXCLUDED.parser_version,
          display_priority = EXCLUDED.display_priority,
          updated_at = now()
        RETURNING id
      `,
      [
        adapter.manifest.sourceKey,
        adapter.manifest.displayName,
        adapter.manifest.family,
        adapter.manifest.parserVersion,
        adapter.manifest.displayPriority ?? 100
      ]
    );
    const sourceId = sourceResult.rows[0].id;

    for (const target of adapter.manifest.targets) {
      await client.query(
        `
          INSERT INTO product_update_targets (
            source_id, target_key, url, cadence_hours, next_due_at
          )
          VALUES ($1, $2, $3, $4, now())
          ON CONFLICT (source_id, target_key) DO UPDATE SET
            url = EXCLUDED.url,
            cadence_hours = EXCLUDED.cadence_hours,
            updated_at = now()
        `,
        [sourceId, target.targetKey, target.url, adapter.manifest.cadenceHours]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function getProductUpdateTarget(
  sourceKey: string,
  targetKey: string
): Promise<RegisteredTarget | null> {
  const result = await query<{
    source_id: number;
    target_id: number;
    source_key: string;
    target_key: string;
    url: string;
    status: string;
    cadence_hours: number;
    next_due_at: string | null;
    circuit_open_until: string | null;
    validated_etag: string | null;
    validated_last_modified: string | null;
    validated_body_hash: string | null;
    validated_parser_version: string | null;
    validated_snapshot_id: number | null;
    observed_snapshot_id: number | null;
    published_parser_version: string | null;
    last_validated_record_count: number | null;
  }>(
    `
      SELECT
        s.id AS source_id,
        t.id AS target_id,
        s.source_key,
        t.target_key,
        t.url,
        t.status,
        t.cadence_hours,
        t.next_due_at,
        t.circuit_open_until,
        t.validated_etag,
        t.validated_last_modified,
        t.validated_body_hash,
        t.validated_parser_version,
        t.validated_snapshot_id,
        t.observed_snapshot_id,
        t.published_parser_version,
        t.last_validated_record_count
      FROM product_update_targets t
      JOIN product_update_sources s ON s.id = t.source_id
      WHERE s.source_key = $1 AND t.target_key = $2
    `,
    [sourceKey, targetKey]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    sourceId: Number(row.source_id),
    targetId: Number(row.target_id),
    sourceKey: row.source_key,
    targetKey: row.target_key,
    url: row.url,
    status: row.status,
    cadenceHours: Number(row.cadence_hours),
    nextDueAt: row.next_due_at,
    circuitOpenUntil: row.circuit_open_until,
    validatedEtag: row.validated_etag,
    validatedLastModified: row.validated_last_modified,
    validatedBodyHash: row.validated_body_hash,
    validatedParserVersion: row.validated_parser_version,
    validatedSnapshotId: row.validated_snapshot_id ? Number(row.validated_snapshot_id) : null,
    observedSnapshotId: row.observed_snapshot_id ? Number(row.observed_snapshot_id) : null,
    publishedParserVersion: row.published_parser_version,
    lastValidatedRecordCount:
      row.last_validated_record_count === null ? null : Number(row.last_validated_record_count)
  };
}

export type ProductUpdateLease = {
  token: string;
  target: RegisteredTarget;
};

export async function tryAcquireProductUpdateLease(
  sourceKey: string,
  targetKey: string,
  options: { owner: string; leaseMs: number }
): Promise<ProductUpdateLease | null> {
  const client = await getPool().connect();
  const token = randomUUID();
  try {
    await client.query("BEGIN");
    const lockResult = await client.query<{ locked: boolean }>(
      `SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0)) AS locked`,
      [`product-update:${sourceKey}:${targetKey}`]
    );
    if (!lockResult.rows[0]?.locked) {
      await client.query("ROLLBACK");
      return null;
    }

    const targetResult = await client.query<{ id: number }>(
      `
        SELECT t.id
        FROM product_update_targets t
        JOIN product_update_sources s ON s.id = t.source_id
        WHERE s.source_key = $1 AND t.target_key = $2
        FOR UPDATE
      `,
      [sourceKey, targetKey]
    );
    const targetId = targetResult.rows[0]?.id;
    if (!targetId) {
      await client.query("ROLLBACK");
      return null;
    }

    const abandoned = await client.query<{ id: number }>(
      `
        UPDATE product_update_runs
        SET status = 'abandoned',
            finished_at = now(),
            error_message = COALESCE(error_message, 'Run lease expired before completion')
        WHERE target_id = $1
          AND status = 'running'
          AND deadline_at IS NOT NULL
          AND deadline_at < now()
        RETURNING id
      `,
      [targetId]
    );
    if ((abandoned.rowCount ?? 0) > 0) {
      await client.query(
        `
          UPDATE product_update_targets
          SET consecutive_failures = consecutive_failures + $2,
              last_error = 'Prior run lease expired before completion',
              updated_at = now()
          WHERE id = $1
        `,
        [targetId, abandoned.rowCount ?? 0]
      );
    }

    const leaseResult = await client.query(
      `
        UPDATE product_update_targets
        SET lease_token = $2,
            lease_owner = $3,
            lease_expires_at = now() + ($4::text || ' milliseconds')::interval,
            heartbeat_at = now(),
            updated_at = now()
        WHERE id = $1
          AND (lease_token IS NULL OR lease_expires_at IS NULL OR lease_expires_at < now())
        RETURNING id
      `,
      [targetId, token, options.owner, options.leaseMs]
    );
    if ((leaseResult.rowCount ?? 0) === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query("COMMIT");
    const target = await getProductUpdateTarget(sourceKey, targetKey);
    if (!target) {
      await releaseProductUpdateLease(targetId, token);
      return null;
    }
    return { token, target };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function heartbeatProductUpdateLease(targetId: number, token: string, leaseMs: number) {
  const result = await query(
    `
      UPDATE product_update_targets
      SET heartbeat_at = now(),
          lease_expires_at = now() + ($3::text || ' milliseconds')::interval,
          updated_at = now()
      WHERE id = $1 AND lease_token = $2
    `,
    [targetId, token, leaseMs]
  );
  return (result.rowCount ?? 0) === 1;
}

export async function releaseProductUpdateLease(targetId: number, token: string) {
  await query(
    `
      UPDATE product_update_targets
      SET lease_token = NULL,
          lease_owner = NULL,
          lease_expires_at = NULL,
          heartbeat_at = NULL,
          updated_at = now()
      WHERE id = $1 AND lease_token = $2
    `,
    [targetId, token]
  );
}

export async function createProductUpdateRun(
  target: ProductUpdateTargetState,
  parserVersion: string,
  deadlineMs: number
) {
  const result = await query<{ id: number }>(
    `
      INSERT INTO product_update_runs (
        source_id, target_id, job_name, parser_version, deadline_at, heartbeat_at
      )
      VALUES ($1, $2, $3, $4, now() + ($5::text || ' milliseconds')::interval, now())
      RETURNING id
    `,
    [
      target.sourceId,
      target.targetId,
      `poll-product-update:${target.sourceKey}:${target.targetKey}`,
      parserVersion,
      deadlineMs
    ]
  );
  return Number(result.rows[0].id);
}

export async function recordProductUpdateSnapshot(
  target: ProductUpdateTargetState,
  runId: number,
  fetched: Extract<ProductUpdateFetchResult, { kind: "content" }>
) {
  const result = await query<{ id: number }>(
    `
      INSERT INTO product_update_snapshots (
        source_id, target_id, run_id, requested_url, final_url, http_status,
        etag, last_modified, content_sha256, content_text
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (target_id, content_sha256) DO UPDATE SET
        run_id = EXCLUDED.run_id,
        fetched_at = now(),
        http_status = EXCLUDED.http_status,
        etag = EXCLUDED.etag,
        last_modified = EXCLUDED.last_modified
      RETURNING id
    `,
    [
      target.sourceId,
      target.targetId,
      runId,
      fetched.requestedUrl,
      fetched.finalUrl,
      fetched.status,
      fetched.etag,
      fetched.lastModified,
      fetched.sha256,
      fetched.text
    ]
  );
  const snapshotId = Number(result.rows[0].id);
  await query(
    `
      UPDATE product_update_targets
      SET last_attempt_at = now(),
          observed_etag = $2,
          observed_last_modified = $3,
          observed_body_hash = $4,
          observed_snapshot_id = $5,
          updated_at = now()
      WHERE id = $1
    `,
    [target.targetId, fetched.etag, fetched.lastModified, fetched.sha256, snapshotId]
  );
  return snapshotId;
}

export async function loadProductUpdateSnapshot(snapshotId: number) {
  const result = await query<{
    id: number;
    source_id: number;
    target_id: number;
    requested_url: string;
    final_url: string;
    fetched_at: string;
    http_status: number;
    etag: string | null;
    last_modified: string | null;
    content_sha256: string;
    content_text: string;
  }>(
    `
      SELECT id, source_id, target_id, requested_url, final_url, fetched_at, http_status, etag,
             last_modified, content_sha256, content_text
      FROM product_update_snapshots
      WHERE id = $1
    `,
    [snapshotId]
  );
  return result.rows[0] ?? null;
}

async function upsertProduct(
  client: PoolClient,
  observation: NormalizedProductUpdateObservation,
  family: string
) {
  const result = await client.query<{ id: number }>(
    `
      INSERT INTO unity_products (
        product_key, slug, display_name, family, description, canonical_url
      )
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (product_key) DO UPDATE SET
        slug = EXCLUDED.slug,
        display_name = EXCLUDED.display_name,
        family = EXCLUDED.family,
        description = EXCLUDED.description,
        canonical_url = EXCLUDED.canonical_url,
        updated_at = now()
      RETURNING id
    `,
    [
      observation.productKey,
      observation.productSlug,
      observation.productName,
      family,
      observation.productDescription ?? "",
      observation.productCanonicalUrl ?? null
    ]
  );
  return Number(result.rows[0].id);
}

export async function publishProductUpdateObservations(options: {
  adapter: ProductUpdateAdapter;
  target: ProductUpdateTargetState;
  leaseToken: string;
  runId: number;
  snapshotId: number;
  fetched: Extract<ProductUpdateFetchResult, { kind: "content" }>;
  observations: NormalizedProductUpdateObservation[];
}) {
  const client = await getPool().connect();
  let created = 0;
  let updated = 0;
  try {
    await client.query("BEGIN");
    const lease = await client.query(
      `SELECT id FROM product_update_targets WHERE id = $1 AND lease_token = $2 FOR UPDATE`,
      [options.target.targetId, options.leaseToken]
    );
    if ((lease.rowCount ?? 0) !== 1) {
      throw new Error("Product Updates target lease was lost before publish");
    }

    for (const observation of options.observations) {
      const productId = await upsertProduct(client, observation, options.adapter.manifest.family);
      const observationHash = normalizedObservationHash(observation);
      const updateResult = await client.query<{ id: number; inserted: boolean }>(
        `
          INSERT INTO product_updates (
            product_id, component_key, canonical_key, slug, version, channel,
            release_date, title, summary, normalized_sha256
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
          ON CONFLICT (product_id, component_key, canonical_key) DO UPDATE SET
            slug = EXCLUDED.slug,
            version = EXCLUDED.version,
            channel = EXCLUDED.channel,
            release_date = EXCLUDED.release_date,
            title = EXCLUDED.title,
            summary = EXCLUDED.summary,
            normalized_sha256 = EXCLUDED.normalized_sha256,
            last_seen_at = now(),
            updated_at = now()
          RETURNING id, (xmax = 0) AS inserted
        `,
        [
          productId,
          observation.componentKey,
          observation.canonicalKey,
          observation.updateSlug,
          observation.version ?? null,
          observation.channel ?? null,
          observation.releaseDate ?? null,
          observation.title,
          observation.summary ?? "",
          observationHash
        ]
      );
      const productUpdateId = Number(updateResult.rows[0].id);
      if (updateResult.rows[0].inserted) created += 1;
      else updated += 1;

      const observationResult = await client.query<{ id: number }>(
        `
          INSERT INTO product_update_observations (
            product_update_id, source_id, target_id, source_update_key,
            source_snapshot_id, run_id, parser_version, normalized_sha256,
            observed_at, published_at, source_title, source_summary,
            source_version, source_channel, source_release_date, source_url,
            metadata_json
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now(),now(),$9,$10,$11,$12,$13,$14,$15)
          ON CONFLICT (source_id, target_id, source_update_key) DO UPDATE SET
            product_update_id = EXCLUDED.product_update_id,
            source_snapshot_id = EXCLUDED.source_snapshot_id,
            run_id = EXCLUDED.run_id,
            parser_version = EXCLUDED.parser_version,
            normalized_sha256 = EXCLUDED.normalized_sha256,
            observed_at = now(),
            published_at = now(),
            source_title = EXCLUDED.source_title,
            source_summary = EXCLUDED.source_summary,
            source_version = EXCLUDED.source_version,
            source_channel = EXCLUDED.source_channel,
            source_release_date = EXCLUDED.source_release_date,
            source_url = EXCLUDED.source_url,
            metadata_json = EXCLUDED.metadata_json,
            updated_at = now()
          RETURNING id
        `,
        [
          productUpdateId,
          options.target.sourceId,
          options.target.targetId,
          observation.sourceUpdateKey,
          options.snapshotId,
          options.runId,
          options.adapter.manifest.parserVersion,
          observationHash,
          observation.title,
          observation.summary ?? "",
          observation.version ?? null,
          observation.channel ?? null,
          observation.releaseDate ?? null,
          observation.sourceUrl,
          observation.metadata ?? {}
        ]
      );
      const observationId = Number(observationResult.rows[0].id);
      await client.query(
        `DELETE FROM product_update_observation_items WHERE observation_id = $1`,
        [observationId]
      );
      for (const item of observation.items) {
        await client.query(
          `
            INSERT INTO product_update_observation_items (
              observation_id, item_key, section, change_kind, body, platforms,
              tags, source_order, metadata_json, normalized_sha256
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
          `,
          [
            observationId,
            item.itemKey,
            item.section,
            item.changeKind,
            item.body,
            item.platforms,
            item.tags,
            item.sourceOrder,
            item.metadata ?? {},
            sha256(item)
          ]
        );
      }

      // Canonical display fields are projected from the highest-priority
      // supporting source, not whichever adapter happened to run last.
      // Product-specific notes use a lower display_priority than aggregate
      // feeds such as UGS. Ties resolve by stable source key.
      await client.query(
        `
          UPDATE product_updates canonical
          SET version = preferred.source_version,
              channel = preferred.source_channel,
              release_date = COALESCE(
                preferred.source_release_date,
                (
                  SELECT MAX(candidate.source_release_date)
                  FROM product_update_observations candidate
                  WHERE candidate.product_update_id = canonical.id
                )
              ),
              title = preferred.source_title,
              summary = preferred.source_summary,
              normalized_sha256 = preferred.normalized_sha256,
              updated_at = now()
          FROM (
            SELECT
              candidate.product_update_id,
              candidate.source_version,
              candidate.source_channel,
              candidate.source_release_date,
              candidate.source_title,
              candidate.source_summary,
              candidate.normalized_sha256
            FROM product_update_observations candidate
            JOIN product_update_sources source ON source.id = candidate.source_id
            WHERE candidate.product_update_id = $1
            ORDER BY source.display_priority, source.source_key, candidate.id
            LIMIT 1
          ) preferred
          WHERE canonical.id = preferred.product_update_id
        `,
        [productUpdateId]
      );
      await client.query(
        `
          INSERT INTO content_events (
            event_type, title, summary, event_time, source_url,
            product_update_id, tags, stable_guid
          )
          SELECT
            'product_update',
            canonical_update.title,
            canonical_update.summary,
            COALESCE(canonical_update.release_date, canonical_update.first_seen_at),
            '/updates/products/' || product.slug || '/' || canonical_update.slug,
            canonical_update.id,
            ARRAY[product.family, product.slug, canonical_update.component_key],
            'product-update:' || canonical_update.id::text
          FROM product_updates canonical_update
          JOIN unity_products product ON product.id = canonical_update.product_id
          WHERE canonical_update.id = $1
          ON CONFLICT (stable_guid) DO UPDATE SET
            title = EXCLUDED.title,
            summary = EXCLUDED.summary,
            event_time = EXCLUDED.event_time,
            source_url = EXCLUDED.source_url,
            product_update_id = EXCLUDED.product_update_id,
            tags = EXCLUDED.tags
        `,
        [productUpdateId]
      );
    }

    await client.query(
      `
        UPDATE product_update_targets
        SET last_attempt_at = now(),
            last_success_at = now(),
            next_due_at = now() + (cadence_hours::text || ' hours')::interval,
            status = 'active',
            validated_etag = $3,
            validated_last_modified = $4,
            validated_body_hash = $5,
            validated_parser_version = $6,
            validated_snapshot_id = $7,
            published_etag = $3,
            published_last_modified = $4,
            published_body_hash = $5,
            published_parser_version = $6,
            published_snapshot_id = $7,
            consecutive_failures = 0,
            circuit_open_until = NULL,
            last_error = NULL,
            last_validated_record_count = $8,
            updated_at = now()
        WHERE id = $1 AND lease_token = $2
      `,
      [
        options.target.targetId,
        options.leaseToken,
        options.fetched.etag,
        options.fetched.lastModified,
        options.fetched.sha256,
        options.adapter.manifest.parserVersion,
        options.snapshotId,
        options.observations.length
      ]
    );
    await client.query(
      `
        UPDATE product_update_runs
        SET status = 'success',
            finished_at = now(),
            heartbeat_at = now(),
            records_observed = $2,
            records_created = $3,
            records_updated = $4
        WHERE id = $1
      `,
      [options.runId, options.observations.length, created, updated]
    );
    await client.query("COMMIT");
    return { created, updated };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function finishProductUpdateNoChange(options: {
  target: ProductUpdateTargetState;
  leaseToken: string;
  runId: number;
}) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const targetResult = await client.query(
      `
        UPDATE product_update_targets
        SET last_attempt_at = now(),
            last_success_at = now(),
            next_due_at = now() + (cadence_hours::text || ' hours')::interval,
            consecutive_failures = 0,
            circuit_open_until = NULL,
            last_error = NULL,
            updated_at = now()
        WHERE id = $1 AND lease_token = $2
      `,
      [options.target.targetId, options.leaseToken]
    );
    if ((targetResult.rowCount ?? 0) !== 1) {
      throw new Error("Product Updates target lease was lost before no-change completion");
    }
    await client.query(
      `
        UPDATE product_update_runs
        SET status = 'success', finished_at = now(), heartbeat_at = now()
        WHERE id = $1
      `,
      [options.runId]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function finishProductUpdateDryRun(options: {
  runId: number;
  recordsObserved: number;
}) {
  await query(
    `
      UPDATE product_update_runs
      SET status = 'success',
          finished_at = now(),
          heartbeat_at = now(),
          records_observed = $2,
          metadata_json = metadata_json || '{"dryRun":true}'::jsonb
      WHERE id = $1
    `,
    [options.runId, options.recordsObserved]
  );
}

export async function failProductUpdateRun(options: {
  target: ProductUpdateTargetState;
  leaseToken: string;
  runId: number;
  status: "failed" | "quarantined" | "timed-out";
  error: string;
}) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `
        UPDATE product_update_targets
        SET last_attempt_at = now(),
            status = CASE WHEN $3 = 'quarantined' THEN 'quarantined' ELSE status END,
            consecutive_failures = consecutive_failures + 1,
            circuit_open_until = CASE
              WHEN consecutive_failures + 1 >= 3 THEN now() + interval '6 hours'
              ELSE circuit_open_until
            END,
            last_error = $4,
            updated_at = now()
        WHERE id = $1 AND lease_token = $2
      `,
      [options.target.targetId, options.leaseToken, options.status, options.error]
    );
    await client.query(
      `
        UPDATE product_update_runs
        SET status = $2, finished_at = now(), error_message = $3, heartbeat_at = now()
        WHERE id = $1
      `,
      [options.runId, options.status, options.error]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export type ProductUpdateHealth = {
  sourceKey: string;
  targetKey: string;
  url: string;
  status: string;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  consecutiveFailures: number;
  circuitOpenUntil: string | null;
  lastError: string | null;
};

export async function listProductUpdateHealth(): Promise<ProductUpdateHealth[]> {
  if (!(await productUpdatesSchemaReady())) return [];
  const result = await query<{
    source_key: string;
    target_key: string;
    url: string;
    status: string;
    last_attempt_at: string | null;
    last_success_at: string | null;
    consecutive_failures: number;
    circuit_open_until: string | null;
    last_error: string | null;
  }>(
    `
      SELECT s.source_key, t.target_key, t.url, t.status, t.last_attempt_at,
             t.last_success_at, t.consecutive_failures, t.circuit_open_until,
             t.last_error
      FROM product_update_targets t
      JOIN product_update_sources s ON s.id = t.source_id
      ORDER BY s.source_key, t.target_key
    `
  );
  return result.rows.map((row) => ({
    sourceKey: row.source_key,
    targetKey: row.target_key,
    url: row.url,
    status: row.status,
    lastAttemptAt: row.last_attempt_at,
    lastSuccessAt: row.last_success_at,
    consecutiveFailures: Number(row.consecutive_failures),
    circuitOpenUntil: row.circuit_open_until,
    lastError: row.last_error
  }));
}

export type ProductUpdateStats = {
  products: number;
  updates: number;
  items: number;
  sources: number;
  targets: number;
  families: Array<{
    family: string;
    products: number;
    updates: number;
  }>;
};

export async function getProductUpdateStats(): Promise<ProductUpdateStats | null> {
  if (!(await productUpdatesSchemaReady())) return null;
  const [totals, families] = await Promise.all([
    query<{
      products: string;
      updates: string;
      items: string;
      sources: string;
      targets: string;
    }>(`
      SELECT
        (SELECT COUNT(*) FROM unity_products) AS products,
        (SELECT COUNT(*) FROM product_updates) AS updates,
        (SELECT COUNT(*) FROM product_update_observation_items) AS items,
        (SELECT COUNT(*) FROM product_update_sources) AS sources,
        (SELECT COUNT(*) FROM product_update_targets) AS targets
    `),
    query<{ family: string; products: string; updates: string }>(`
      SELECT
        product.family,
        COUNT(DISTINCT product.id)::text AS products,
        COUNT(update.id)::text AS updates
      FROM unity_products product
      LEFT JOIN product_updates update ON update.product_id = product.id
      GROUP BY product.family
      ORDER BY
        CASE product.family
          WHEN 'editor-tooling' THEN 1
          WHEN 'platform-services' THEN 2
          WHEN 'monetization' THEN 3
          WHEN 'industry-enterprise' THEN 4
          ELSE 5
        END
    `)
  ]);
  const row = totals.rows[0];
  if (!row) return null;
  return {
    products: Number(row.products),
    updates: Number(row.updates),
    items: Number(row.items),
    sources: Number(row.sources),
    targets: Number(row.targets),
    families: families.rows.map((family) => ({
      family: family.family,
      products: Number(family.products),
      updates: Number(family.updates)
    }))
  };
}

export async function listProductUpdates(options: {
  family?: string;
  product?: string;
  limit?: number;
  before?: { sortTime: string; id: number } | null;
} = {}) {
  if (!(await productUpdatesSchemaReady())) return [];
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const params: unknown[] = [];
  const where: string[] = [];
  if (options.family) {
    params.push(options.family);
    where.push(`p.family = $${params.length}`);
  }
  if (options.product) {
    params.push(options.product);
    where.push(`p.slug = $${params.length}`);
  }
  if (options.before) {
    params.push(options.before.sortTime, options.before.id);
    where.push(
      `(COALESCE(u.release_date, u.first_seen_at), u.id) < ($${params.length - 1}::timestamptz, $${params.length}::bigint)`
    );
  }
  params.push(limit);
  const result = await query<{
    id: number;
    product_key: string;
    product_slug: string;
    product_name: string;
    family: string;
    component_key: string;
    slug: string;
    version: string | null;
    channel: string | null;
    release_date: string | null;
    sort_time: string;
    title: string;
    summary: string;
    source_count: string;
  }>(
    `
      SELECT
        u.id,
        p.product_key,
        p.slug AS product_slug,
        p.display_name AS product_name,
        p.family,
        u.component_key,
        u.slug,
        u.version,
        u.channel,
        u.release_date,
        COALESCE(u.release_date, u.first_seen_at) AS sort_time,
        u.title,
        u.summary,
        COUNT(o.id)::text AS source_count
      FROM product_updates u
      JOIN unity_products p ON p.id = u.product_id
      LEFT JOIN product_update_observations o ON o.product_update_id = u.id
      ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
      GROUP BY u.id, p.id
      ORDER BY COALESCE(u.release_date, u.first_seen_at) DESC, u.id DESC
      LIMIT $${params.length}
    `,
    params
  );
  return result.rows.map((row) => ({
    id: Number(row.id),
    productKey: row.product_key,
    productSlug: row.product_slug,
    productName: row.product_name,
    family: row.family,
    componentKey: row.component_key,
    slug: row.slug,
    version: row.version,
    channel: row.channel,
    releaseDate: row.release_date,
    sortTime: row.sort_time,
    title: row.title,
    summary: row.summary,
    sourceCount: Number(row.source_count)
  }));
}

export async function listUnityProducts(family?: string) {
  if (!(await productUpdatesSchemaReady())) return [];
  const result = await query<{
    product_key: string;
    slug: string;
    display_name: string;
    family: string;
    description: string;
    status: string;
    canonical_url: string | null;
    update_count: string;
    latest_update_at: string | null;
  }>(
    `
      SELECT
        p.product_key,
        p.slug,
        p.display_name,
        p.family,
        p.description,
        p.status,
        p.canonical_url,
        COUNT(u.id)::text AS update_count,
        MAX(COALESCE(u.release_date, u.first_seen_at)) AS latest_update_at
      FROM unity_products p
      LEFT JOIN product_updates u ON u.product_id = p.id
      WHERE ($1::text IS NULL OR p.family = $1)
      GROUP BY p.id
      ORDER BY
        CASE p.family
          WHEN 'editor-tooling' THEN 1
          WHEN 'platform-services' THEN 2
          WHEN 'monetization' THEN 3
          WHEN 'industry-enterprise' THEN 4
          ELSE 5
        END,
        p.display_name
    `,
    [family ?? null]
  );
  return result.rows.map((row) => ({
    productKey: row.product_key,
    slug: row.slug,
    displayName: row.display_name,
    family: row.family,
    description: row.description,
    status: row.status,
    canonicalUrl: row.canonical_url,
    updateCount: Number(row.update_count),
    latestUpdateAt: row.latest_update_at
  }));
}

export async function getProductUpdateDetail(productSlug: string, updateSlug: string) {
  if (!(await productUpdatesSchemaReady())) return null;
  const updateResult = await query<{
    id: number;
    product_key: string;
    product_slug: string;
    product_name: string;
    family: string;
    product_description: string;
    canonical_url: string | null;
    component_key: string;
    slug: string;
    version: string | null;
    channel: string | null;
    release_date: string | null;
    title: string;
    summary: string;
  }>(
    `
      SELECT
        u.id,
        p.product_key,
        p.slug AS product_slug,
        p.display_name AS product_name,
        p.family,
        p.description AS product_description,
        p.canonical_url,
        u.component_key,
        u.slug,
        u.version,
        u.channel,
        u.release_date,
        u.title,
        u.summary
      FROM product_updates u
      JOIN unity_products p ON p.id = u.product_id
      WHERE p.slug = $1 AND u.slug = $2
    `,
    [productSlug, updateSlug]
  );
  const update = updateResult.rows[0];
  if (!update) return null;
  const observationsResult = await query<{
    id: number;
    source_key: string;
    source_name: string;
    source_title: string;
    source_summary: string;
    source_version: string | null;
    source_channel: string | null;
    source_release_date: string | null;
    source_url: string;
    published_at: string | null;
  }>(
    `
      SELECT
        o.id,
        s.source_key,
        s.display_name AS source_name,
        o.source_title,
        o.source_summary,
        o.source_version,
        o.source_channel,
        o.source_release_date,
        o.source_url,
        o.published_at
      FROM product_update_observations o
      JOIN product_update_sources s ON s.id = o.source_id
      WHERE o.product_update_id = $1
      ORDER BY o.published_at DESC NULLS LAST, o.id
    `,
    [update.id]
  );
  const observationIds = observationsResult.rows.map((row) => Number(row.id));
  const itemsResult =
    observationIds.length === 0
      ? { rows: [] as Array<{
          observation_id: number;
          item_key: string;
          section: string;
          change_kind: string;
          body: string;
          platforms: string[];
          tags: string[];
          source_order: number;
        }> }
      : await query<{
          observation_id: number;
          item_key: string;
          section: string;
          change_kind: string;
          body: string;
          platforms: string[];
          tags: string[];
          source_order: number;
        }>(
          `
            SELECT observation_id, item_key, section, change_kind, body,
                   platforms, tags, source_order
            FROM product_update_observation_items
            WHERE observation_id = ANY($1::bigint[])
            ORDER BY observation_id, source_order, id
          `,
          [observationIds]
        );
  const itemsByObservation = new Map<number, typeof itemsResult.rows>();
  for (const item of itemsResult.rows) {
    const observationId = Number(item.observation_id);
    const items = itemsByObservation.get(observationId) ?? [];
    items.push(item);
    itemsByObservation.set(observationId, items);
  }
  return {
    product: {
      productKey: update.product_key,
      slug: update.product_slug,
      displayName: update.product_name,
      family: update.family,
      description: update.product_description,
      canonicalUrl: update.canonical_url
    },
    update: {
      id: Number(update.id),
      componentKey: update.component_key,
      slug: update.slug,
      version: update.version,
      channel: update.channel,
      releaseDate: update.release_date,
      title: update.title,
      summary: update.summary
    },
    observations: observationsResult.rows.map((observation) => ({
      id: Number(observation.id),
      sourceKey: observation.source_key,
      sourceName: observation.source_name,
      title: observation.source_title,
      summary: observation.source_summary,
      version: observation.source_version,
      channel: observation.source_channel,
      releaseDate: observation.source_release_date,
      sourceUrl: observation.source_url,
      publishedAt: observation.published_at,
      items: (itemsByObservation.get(Number(observation.id)) ?? []).map((item) => ({
        itemKey: item.item_key,
        section: item.section,
        changeKind: item.change_kind,
        body: item.body,
        platforms: item.platforms,
        tags: item.tags,
        sourceOrder: Number(item.source_order)
      }))
    }))
  };
}
