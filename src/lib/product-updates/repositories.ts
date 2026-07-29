import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { getPool, query } from "../db/client";
import { sha256 } from "../ingest/hash";
import { normalizedObservationHash } from "./normalization";
import type {
  NormalizedProductUpdateObservation,
  ProductUpdateAdapter,
  ProductUpdateFailureKind,
  ProductUpdateFetchResult,
  ProductUpdateTargetState
} from "./types";

type RegisteredTarget = ProductUpdateTargetState & {
  cadenceHours: number;
};

export async function productUpdatesSchemaReady() {
  try {
    const result = await query<{ ready: boolean }>(
      `
        SELECT
          NOT EXISTS (
            SELECT 1
            FROM (
              VALUES
                ('unity_products'),
                ('product_update_sources'),
                ('product_update_targets'),
                ('product_update_runs'),
                ('product_update_snapshots'),
                ('product_updates'),
                ('product_update_observations'),
                ('product_update_observation_items')
            ) AS required_relation(name)
            WHERE to_regclass(
              format('%I.%I', current_schema(), required_relation.name)
            ) IS NULL
          )
          AND EXISTS (
            SELECT 1
            FROM pg_attribute
            WHERE attrelid = to_regclass(
              format('%I.content_events', current_schema())
            )
              AND attname = 'product_update_id'
              AND NOT attisdropped
          ) AS ready
      `
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
        WHERE (
          product_update_sources.display_name,
          product_update_sources.family,
          product_update_sources.parser_version,
          product_update_sources.display_priority
        ) IS DISTINCT FROM (
          EXCLUDED.display_name,
          EXCLUDED.family,
          EXCLUDED.parser_version,
          EXCLUDED.display_priority
        )
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
    const sourceId =
      sourceResult.rows[0]?.id ??
      (
        await client.query<{ id: number }>(
          "SELECT id FROM product_update_sources WHERE source_key = $1",
          [adapter.manifest.sourceKey]
        )
      ).rows[0].id;

    for (const target of adapter.manifest.targets) {
      await client.query(
        `
          INSERT INTO product_update_targets (
            source_id, target_key, url, display_priority, cadence_hours, next_due_at, status
          )
          VALUES ($1, $2, $3, $4, $5, now(), $6)
          ON CONFLICT (source_id, target_key) DO UPDATE SET
            url = EXCLUDED.url,
            display_priority = EXCLUDED.display_priority,
            cadence_hours = EXCLUDED.cadence_hours,
            status = CASE
              WHEN EXCLUDED.status = 'manually-retired' THEN 'manually-retired'
              WHEN product_update_targets.status = 'manually-retired' THEN 'active'
              ELSE product_update_targets.status
            END,
            updated_at = now()
          WHERE (
            product_update_targets.url,
            product_update_targets.display_priority,
            product_update_targets.cadence_hours,
            product_update_targets.status
          ) IS DISTINCT FROM (
            EXCLUDED.url,
            EXCLUDED.display_priority,
            EXCLUDED.cadence_hours,
            CASE
              WHEN EXCLUDED.status = 'manually-retired' THEN 'manually-retired'
              WHEN product_update_targets.status = 'manually-retired' THEN 'active'
              ELSE product_update_targets.status
            END
          )
        `,
        [
          sourceId,
          target.targetKey,
          target.url,
          target.displayPriority ?? 100,
          adapter.manifest.cadenceHours,
          target.retired ? "manually-retired" : "active"
        ]
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
    failure_kind: ProductUpdateFailureKind | null;
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
        t.failure_kind,
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
    failureKind: row.failure_kind,
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
              failure_kind = 'transient',
              last_attempt_at = now(),
              next_due_at = now() + (cadence_hours::text || ' hours')::interval,
              circuit_open_until = CASE
                WHEN consecutive_failures + $2 >= 3 THEN now() + interval '6 hours'
                ELSE circuit_open_until
              END,
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
            heartbeat_at = now()
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
          lease_expires_at = now() + ($3::text || ' milliseconds')::interval
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
          heartbeat_at = NULL
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
  leaseToken: string,
  runId: number,
  fetched: Extract<ProductUpdateFetchResult, { kind: "content" }>,
  options: { promoteObserved?: boolean } = {}
) {
  const result = await query<{ id: number }>(
    `
      INSERT INTO product_update_snapshots (
        source_id, target_id, run_id, requested_url, final_url, http_status,
        etag, last_modified, content_sha256, content_text
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (target_id, content_sha256) DO UPDATE SET
        content_sha256 = product_update_snapshots.content_sha256
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
  if (options.promoteObserved === false) return snapshotId;
  const promotion = await query(
    `
      UPDATE product_update_targets
      SET last_attempt_at = now(),
          observed_etag = $2,
          observed_last_modified = $3,
          observed_body_hash = $4,
          observed_snapshot_id = $5,
          updated_at = now()
      WHERE id = $1 AND lease_token = $6
    `,
    [
      target.targetId,
      fetched.etag,
      fetched.lastModified,
      fetched.sha256,
      snapshotId,
      leaseToken
    ]
  );
  if ((promotion.rowCount ?? 0) !== 1) {
    throw new Error("Product Updates target lease was lost before snapshot promotion");
  }
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
  family: string,
  sourceKey: string,
  displayPriority: number,
  targetKey: string,
  targetDisplayPriority: number
) {
  const precedenceRank = [
    String(displayPriority).padStart(5, "0"),
    sourceKey,
    String(targetDisplayPriority).padStart(5, "0"),
    targetKey
  ].join(":");
  const result = await client.query<{ id: number }>(
    `
      INSERT INTO unity_products (
        product_key, slug, display_name, family, description, canonical_url,
        metadata_json
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,
        jsonb_build_object('precedenceRank', $7::text)
      )
      ON CONFLICT (product_key) DO UPDATE SET
        slug = CASE WHEN
          EXCLUDED.metadata_json->>'precedenceRank' <=
            COALESCE(unity_products.metadata_json->>'precedenceRank', '99999')
          THEN EXCLUDED.slug ELSE unity_products.slug END,
        display_name = CASE WHEN
          EXCLUDED.metadata_json->>'precedenceRank' <=
            COALESCE(unity_products.metadata_json->>'precedenceRank', '99999')
          THEN EXCLUDED.display_name ELSE unity_products.display_name END,
        family = CASE WHEN
          EXCLUDED.metadata_json->>'precedenceRank' <=
            COALESCE(unity_products.metadata_json->>'precedenceRank', '99999')
          THEN EXCLUDED.family ELSE unity_products.family END,
        description = CASE WHEN
          EXCLUDED.metadata_json->>'precedenceRank' <=
            COALESCE(unity_products.metadata_json->>'precedenceRank', '99999')
          THEN EXCLUDED.description ELSE unity_products.description END,
        canonical_url = CASE WHEN
          EXCLUDED.metadata_json->>'precedenceRank' <=
            COALESCE(unity_products.metadata_json->>'precedenceRank', '99999')
          THEN EXCLUDED.canonical_url ELSE unity_products.canonical_url END,
        metadata_json = CASE WHEN
          EXCLUDED.metadata_json->>'precedenceRank' <=
            COALESCE(unity_products.metadata_json->>'precedenceRank', '99999')
          THEN EXCLUDED.metadata_json ELSE unity_products.metadata_json END,
        updated_at = now()
      RETURNING id
    `,
    [
      observation.productKey,
      observation.productSlug,
      observation.productName,
      family,
      observation.productDescription ?? "",
      observation.productCanonicalUrl ?? null,
      precedenceRank
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
  const productIds = new Map<string, number>();
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
      let productId = productIds.get(observation.productKey);
      if (productId === undefined) {
        productId = await upsertProduct(
          client,
          observation,
          options.adapter.manifest.family,
          options.adapter.manifest.sourceKey,
          options.adapter.manifest.displayPriority ?? 100,
          options.target.targetKey,
          options.adapter.manifest.targets.find(
            (target) => target.targetKey === options.target.targetKey
          )?.displayPriority ?? 100
        );
        productIds.set(observation.productKey, productId);
      }
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
      if (observation.items.length > 0) {
        await client.query(
          `
            INSERT INTO product_update_observation_items (
              observation_id, item_key, section, change_kind, body, platforms,
              tags, source_order, metadata_json, normalized_sha256
            )
            SELECT
              $1,
              item.item_key,
              item.section,
              item.change_kind,
              item.body,
              ARRAY(
                SELECT jsonb_array_elements_text(item.platforms)
              ),
              ARRAY(
                SELECT jsonb_array_elements_text(item.tags)
              ),
              item.source_order,
              item.metadata_json,
              item.normalized_sha256
            FROM jsonb_to_recordset($2::jsonb) AS item(
              item_key text,
              section text,
              change_kind text,
              body text,
              platforms jsonb,
              tags jsonb,
              source_order integer,
              metadata_json jsonb,
              normalized_sha256 text
            )
          `,
          [
            observationId,
            JSON.stringify(
              observation.items.map((item) => ({
                item_key: item.itemKey,
                section: item.section,
                change_kind: item.changeKind,
                body: item.body,
                platforms: item.platforms,
                tags: item.tags,
                source_order: item.sourceOrder,
                metadata_json: item.metadata ?? {},
                normalized_sha256: sha256(item)
              }))
            )
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
            JOIN product_update_targets target ON target.id = candidate.target_id
            WHERE candidate.product_update_id = $1
            ORDER BY
              source.display_priority,
              source.source_key,
              target.display_priority,
              candidate.published_at DESC NULLS LAST,
              candidate.id DESC
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
            failure_kind = NULL,
            not_found_probe_count = 0,
            not_found_first_at = NULL,
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
            status = 'active',
            failure_kind = NULL,
            not_found_probe_count = 0,
            not_found_first_at = NULL,
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

export async function finishProductUpdateDryRunFailure(options: {
  runId: number;
  error: string;
}) {
  await query(
    `
      UPDATE product_update_runs
      SET status = 'failed',
          finished_at = now(),
          heartbeat_at = now(),
          error_message = $2,
          metadata_json = metadata_json || '{"dryRun":true}'::jsonb
      WHERE id = $1
    `,
    [options.runId, options.error]
  );
}

export async function failProductUpdateRun(options: {
  target: ProductUpdateTargetState;
  leaseToken: string;
  runId: number;
  status: "failed" | "quarantined" | "timed-out";
  failureKind: ProductUpdateFailureKind;
  error: string;
}) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const targetState = await client.query<{
      status: string;
      not_found_probe_count: number;
      probe_is_spaced: boolean;
    }>(
      `
        SELECT
          status,
          not_found_probe_count,
          last_attempt_at IS NULL
            OR last_attempt_at <= now() - interval '6 hours' AS probe_is_spaced
        FROM product_update_targets
        WHERE id = $1 AND lease_token = $2
        FOR UPDATE
      `,
      [options.target.targetId, options.leaseToken]
    );
    const current = targetState.rows[0];
    const notFoundProbeCount =
      options.failureKind === "not-found-candidate"
        ? Number(current?.not_found_probe_count ?? 0) +
          (current?.probe_is_spaced ? 1 : 0)
        : Number(current?.not_found_probe_count ?? 0);
    const targetStatus =
      options.failureKind === "parser-drift"
        ? "quarantined"
        : options.failureKind === "not-found-candidate"
          ? notFoundProbeCount >= 3
            ? "suspected-retired"
            : "not-found-candidate"
          : current?.status ?? "active";
    await client.query(
      `
        UPDATE product_update_targets
        SET last_attempt_at = now(),
            status = $3,
            failure_kind = $4,
            not_found_probe_count = $5,
            not_found_first_at = CASE
              WHEN $4 = 'not-found-candidate'
                THEN COALESCE(not_found_first_at, now())
              ELSE not_found_first_at
            END,
            next_due_at = CASE
              WHEN $3 = 'suspected-retired' THEN now() + interval '7 days'
              WHEN $4 = 'not-found-candidate' THEN now() + interval '24 hours'
              ELSE next_due_at
            END,
            consecutive_failures = consecutive_failures + 1,
            circuit_open_until = CASE
              WHEN consecutive_failures + 1 >= 3 THEN now() + interval '6 hours'
              ELSE circuit_open_until
            END,
            last_error = $6,
            updated_at = now()
        WHERE id = $1 AND lease_token = $2
      `,
      [
        options.target.targetId,
        options.leaseToken,
        targetStatus,
        options.failureKind,
        notFoundProbeCount,
        options.error
      ]
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
  failureKind: ProductUpdateFailureKind | null;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  cadenceHours: number;
  nextDueAt: string | null;
  consecutiveFailures: number;
  notFoundProbeCount: number;
  circuitOpenUntil: string | null;
  leaseExpiresAt: string | null;
  lastError: string | null;
};

export async function listProductUpdateHealth(): Promise<ProductUpdateHealth[]> {
  if (!(await productUpdatesSchemaReady())) return [];
  const result = await query<{
    source_key: string;
    target_key: string;
    url: string;
    status: string;
    failure_kind: ProductUpdateFailureKind | null;
    last_attempt_at: string | null;
    last_success_at: string | null;
    cadence_hours: number;
    next_due_at: string | null;
    consecutive_failures: number;
    not_found_probe_count: number;
    circuit_open_until: string | null;
    lease_expires_at: string | null;
    last_error: string | null;
  }>(
    `
      SELECT s.source_key, t.target_key, t.url, t.status, t.failure_kind,
             t.last_attempt_at, t.last_success_at, t.cadence_hours,
             t.next_due_at, t.consecutive_failures, t.not_found_probe_count,
             t.circuit_open_until, t.lease_expires_at, t.last_error
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
    failureKind: row.failure_kind,
    lastAttemptAt: row.last_attempt_at,
    lastSuccessAt: row.last_success_at,
    cadenceHours: Number(row.cadence_hours),
    nextDueAt: row.next_due_at,
    consecutiveFailures: Number(row.consecutive_failures),
    notFoundProbeCount: Number(row.not_found_probe_count),
    circuitOpenUntil: row.circuit_open_until,
    leaseExpiresAt: row.lease_expires_at,
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

export type ProductUpdateListOptions = {
  family?: string;
  product?: string;
  changeKind?: string;
  platform?: string;
  version?: string;
  channel?: string;
  from?: string;
  to?: string;
  limit?: number;
  before?: { sortTime: string; id: number } | null;
  offset?: number;
};

function productUpdateFilterSql(
  options: ProductUpdateListOptions,
  includeCursor = true
) {
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
  if (options.changeKind) {
    params.push(options.changeKind);
    where.push(
      `EXISTS (
        SELECT 1
        FROM product_update_observations filter_observation
        JOIN product_update_observation_items filter_item
          ON filter_item.observation_id = filter_observation.id
        WHERE filter_observation.product_update_id = u.id
          AND filter_item.change_kind = $${params.length}
      )`
    );
  }
  if (options.platform) {
    params.push(options.platform);
    where.push(
      `EXISTS (
        SELECT 1
        FROM product_update_observations platform_observation
        JOIN product_update_observation_items platform_item
          ON platform_item.observation_id = platform_observation.id
        WHERE platform_observation.product_update_id = u.id
          AND $${params.length} = ANY(platform_item.platforms)
      )`
    );
  }
  if (options.version) {
    params.push(options.version);
    where.push(`u.version = $${params.length}`);
  }
  if (options.channel) {
    params.push(options.channel);
    where.push(`u.channel = $${params.length}`);
  }
  if (options.from) {
    params.push(options.from);
    where.push(
      `COALESCE(u.release_date, u.first_seen_at) >= $${params.length}::date`
    );
  }
  if (options.to) {
    params.push(options.to);
    where.push(
      `COALESCE(u.release_date, u.first_seen_at) < $${params.length}::date + interval '1 day'`
    );
  }
  if (includeCursor && options.before) {
    params.push(options.before.sortTime, options.before.id);
    where.push(
      `(COALESCE(u.release_date, u.first_seen_at), u.id) < ($${params.length - 1}::timestamptz, $${params.length}::bigint)`
    );
  }
  return { params, where };
}

export async function listProductUpdates(options: ProductUpdateListOptions = {}) {
  if (!(await productUpdatesSchemaReady())) return [];
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const offset = Math.min(Math.max(options.offset ?? 0, 0), 100_000);
  const { params, where } = productUpdateFilterSql(options);
  params.push(limit);
  const limitParam = params.length;
  if (offset > 0) params.push(offset);
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
    product_status: string;
    last_validated_at: string | null;
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
        COUNT(DISTINCT o.id)::text AS source_count,
        CASE
          WHEN p.status <> 'active' THEN p.status
          WHEN BOOL_OR(
            target.id IS NOT NULL AND (
              target.status <> 'active'
              OR target.last_success_at IS NULL
              OR target.consecutive_failures > 0
              OR (
                target.lease_expires_at IS NOT NULL
                AND target.lease_expires_at < now()
              )
              OR (
                target.next_due_at IS NOT NULL
                AND target.next_due_at
                  + interval '1 hour' * GREATEST(1, target.cadence_hours / 4)
                  < now()
              )
            )
          ) THEN 'degraded'
          ELSE 'active'
        END AS product_status,
        MAX(target.last_success_at) AS last_validated_at
      FROM product_updates u
      JOIN unity_products p ON p.id = u.product_id
      LEFT JOIN product_update_observations o ON o.product_update_id = u.id
      LEFT JOIN product_update_targets target ON target.id = o.target_id
      ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
      GROUP BY u.id, p.id
      ORDER BY COALESCE(u.release_date, u.first_seen_at) DESC, u.id DESC
      LIMIT $${limitParam}
      ${offset > 0 ? `OFFSET $${params.length}` : ""}
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
    sourceCount: Number(row.source_count),
    productStatus: row.product_status,
    lastValidatedAt: row.last_validated_at
  }));
}

export async function countProductUpdates(
  options: Omit<ProductUpdateListOptions, "limit" | "before" | "offset"> = {}
) {
  if (!(await productUpdatesSchemaReady())) return 0;
  const { params, where } = productUpdateFilterSql(options, false);
  const result = await query<{ count: string }>(
    `
      SELECT COUNT(*)::text AS count
      FROM product_updates u
      JOIN unity_products p ON p.id = u.product_id
      ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
    `,
    params
  );
  return Number(result.rows[0]?.count ?? 0);
}

export type ProductUpdateFacets = {
  versions: string[];
  channels: string[];
  changeKinds: string[];
  platforms: string[];
};

export async function listProductUpdateFacets(options: {
  family?: string;
  product?: string;
} = {}): Promise<ProductUpdateFacets> {
  if (!(await productUpdatesSchemaReady())) {
    return { versions: [], channels: [], changeKinds: [], platforms: [] };
  }
  const result = await query<{
    versions: string[];
    channels: string[];
    change_kinds: string[];
    platforms: string[];
  }>(
    `
      WITH scoped_updates AS (
        SELECT scoped_update.id, scoped_update.version, scoped_update.channel
        FROM product_updates scoped_update
        JOIN unity_products product ON product.id = scoped_update.product_id
        WHERE ($1::text IS NULL OR product.family = $1)
          AND ($2::text IS NULL OR product.slug = $2)
      )
      SELECT
        ARRAY(
          SELECT DISTINCT version
          FROM scoped_updates
          WHERE version IS NOT NULL AND version <> ''
          ORDER BY version
        ) AS versions,
        ARRAY(
          SELECT DISTINCT channel
          FROM scoped_updates
          WHERE channel IS NOT NULL AND channel <> ''
          ORDER BY channel
        ) AS channels,
        ARRAY(
          SELECT DISTINCT item.change_kind
          FROM scoped_updates scoped
          JOIN product_update_observations observation
            ON observation.product_update_id = scoped.id
          JOIN product_update_observation_items item
            ON item.observation_id = observation.id
          WHERE item.change_kind <> ''
          ORDER BY item.change_kind
        ) AS change_kinds,
        ARRAY(
          SELECT DISTINCT platform
          FROM scoped_updates scoped
          JOIN product_update_observations observation
            ON observation.product_update_id = scoped.id
          JOIN product_update_observation_items item
            ON item.observation_id = observation.id
          CROSS JOIN LATERAL UNNEST(item.platforms) AS platform
          WHERE platform <> ''
          ORDER BY platform
        ) AS platforms
    `,
    [options.family ?? null, options.product ?? null]
  );
  const row = result.rows[0];
  return {
    versions: row?.versions ?? [],
    channels: row?.channels ?? [],
    changeKinds: row?.change_kinds ?? [],
    platforms: row?.platforms ?? []
  };
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
    effective_status: string;
    last_validated_at: string | null;
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
        COUNT(DISTINCT u.id)::text AS update_count,
        MAX(COALESCE(u.release_date, u.first_seen_at)) AS latest_update_at,
        CASE
          WHEN p.status <> 'active' THEN p.status
          WHEN BOOL_OR(
            target.id IS NOT NULL AND (
              target.status <> 'active'
              OR target.last_success_at IS NULL
              OR target.consecutive_failures > 0
              OR (
                target.lease_expires_at IS NOT NULL
                AND target.lease_expires_at < now()
              )
              OR (
                target.next_due_at IS NOT NULL
                AND target.next_due_at
                  + interval '1 hour' * GREATEST(1, target.cadence_hours / 4)
                  < now()
              )
            )
          ) THEN 'degraded'
          ELSE 'active'
        END AS effective_status,
        MAX(target.last_success_at) AS last_validated_at
      FROM unity_products p
      LEFT JOIN product_updates u ON u.product_id = p.id
      LEFT JOIN product_update_observations observation
        ON observation.product_update_id = u.id
      LEFT JOIN product_update_targets target
        ON target.id = observation.target_id
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
    status: row.effective_status,
    canonicalUrl: row.canonical_url,
    updateCount: Number(row.update_count),
    latestUpdateAt: row.latest_update_at,
    lastValidatedAt: row.last_validated_at
  }));
}

export async function getUnityProductBySlug(slug: string) {
  if (!(await productUpdatesSchemaReady())) return null;
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
    effective_status: string;
    last_validated_at: string | null;
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
        COUNT(DISTINCT u.id)::text AS update_count,
        MAX(COALESCE(u.release_date, u.first_seen_at)) AS latest_update_at,
        CASE
          WHEN p.status <> 'active' THEN p.status
          WHEN BOOL_OR(
            target.id IS NOT NULL AND (
              target.status <> 'active'
              OR target.last_success_at IS NULL
              OR target.consecutive_failures > 0
              OR (
                target.lease_expires_at IS NOT NULL
                AND target.lease_expires_at < now()
              )
              OR (
                target.next_due_at IS NOT NULL
                AND target.next_due_at
                  + interval '1 hour' * GREATEST(1, target.cadence_hours / 4)
                  < now()
              )
            )
          ) THEN 'degraded'
          ELSE 'active'
        END AS effective_status,
        MAX(target.last_success_at) AS last_validated_at
      FROM unity_products p
      LEFT JOIN product_updates u ON u.product_id = p.id
      LEFT JOIN product_update_observations observation
        ON observation.product_update_id = u.id
      LEFT JOIN product_update_targets target
        ON target.id = observation.target_id
      WHERE p.slug = $1
      GROUP BY p.id
    `,
    [slug]
  );
  const row = result.rows[0];
  return row
    ? {
        productKey: row.product_key,
        slug: row.slug,
        displayName: row.display_name,
        family: row.family,
        description: row.description,
        status: row.effective_status,
        canonicalUrl: row.canonical_url,
        updateCount: Number(row.update_count),
        latestUpdateAt: row.latest_update_at,
        lastValidatedAt: row.last_validated_at
      }
    : null;
}

export type ProductUpdateSitemapEntries = {
  products: Array<{
    slug: string;
    updatedAt: string | null;
  }>;
  updates: Array<{
    productSlug: string;
    updateSlug: string;
    updatedAt: string;
  }>;
};

export async function listProductUpdateSitemapEntries(
  limit = 10_000
): Promise<ProductUpdateSitemapEntries> {
  if (!(await productUpdatesSchemaReady())) {
    return { products: [], updates: [] };
  }
  const boundedLimit = Math.min(Math.max(limit, 1), 10_000);
  const [products, updates] = await Promise.all([
    query<{ slug: string; updated_at: string | null }>(
      `
        SELECT
          product.slug,
          MAX(COALESCE(product_update.updated_at, product.updated_at)) AS updated_at
        FROM unity_products product
        LEFT JOIN product_updates product_update
          ON product_update.product_id = product.id
        GROUP BY product.id
        ORDER BY product.slug
      `
    ),
    query<{
      product_slug: string;
      update_slug: string;
      updated_at: string;
    }>(
      `
        SELECT
          product.slug AS product_slug,
          product_update.slug AS update_slug,
          product_update.updated_at
        FROM product_updates product_update
        JOIN unity_products product ON product.id = product_update.product_id
        ORDER BY COALESCE(
                   product_update.release_date,
                   product_update.first_seen_at
                 ) DESC,
                 product_update.id DESC
        LIMIT $1
      `,
      [boundedLimit]
    )
  ]);
  return {
    products: products.rows.map((row) => ({
      slug: row.slug,
      updatedAt: row.updated_at
    })),
    updates: updates.rows.map((row) => ({
      productSlug: row.product_slug,
      updateSlug: row.update_slug,
      updatedAt: row.updated_at
    }))
  };
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
    product_status: string;
    last_validated_at: string | null;
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
        CASE
          WHEN p.status <> 'active' THEN p.status
          WHEN EXISTS (
            SELECT 1
            FROM product_update_observations health_observation
            JOIN product_update_targets health_target
              ON health_target.id = health_observation.target_id
            WHERE health_observation.product_update_id = u.id
              AND (
                health_target.status <> 'active'
                OR health_target.last_success_at IS NULL
                OR health_target.consecutive_failures > 0
                OR (
                  health_target.lease_expires_at IS NOT NULL
                  AND health_target.lease_expires_at < now()
                )
                OR (
                  health_target.next_due_at IS NOT NULL
                  AND health_target.next_due_at
                    + interval '1 hour'
                      * GREATEST(1, health_target.cadence_hours / 4)
                    < now()
                )
              )
          ) THEN 'degraded'
          ELSE 'active'
        END AS product_status,
        (
          SELECT MAX(health_target.last_success_at)
          FROM product_update_observations health_observation
          JOIN product_update_targets health_target
            ON health_target.id = health_observation.target_id
          WHERE health_observation.product_update_id = u.id
        ) AS last_validated_at,
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
      status: update.product_status,
      lastValidatedAt: update.last_validated_at,
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
