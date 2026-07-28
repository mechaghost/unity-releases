import { z } from "zod";
import {
  PRODUCT_UPDATE_FAMILIES,
  type NormalizedProductUpdateObservation,
  type ProductUpdateAdapterManifest
} from "./types";

const httpsUrl = z.string().url().refine((value) => new URL(value).protocol === "https:", {
  message: "Expected an HTTPS URL"
});

const itemSchema = z.object({
  itemKey: z.string().min(1).max(160),
  section: z.string().min(1).max(240),
  changeKind: z.string().min(1).max(80),
  body: z.string().min(1).max(100_000),
  platforms: z.array(z.string().min(1).max(80)).max(64),
  tags: z.array(z.string().min(1).max(80)).max(128),
  sourceOrder: z.number().int().nonnegative(),
  metadata: z.record(z.unknown()).optional()
});

export const observationSchema = z.object({
  productKey: z.string().regex(/^[a-z0-9][a-z0-9-]*$/).max(120),
  productSlug: z.string().regex(/^[a-z0-9][a-z0-9-]*$/).max(120),
  productName: z.string().min(1).max(200),
  productDescription: z.string().max(2_000).optional(),
  productCanonicalUrl: httpsUrl.nullish(),
  componentKey: z.string().regex(/^[a-z0-9][a-z0-9-]*$/).max(120),
  sourceUpdateKey: z.string().min(1).max(300),
  canonicalKey: z.string().min(1).max(300),
  updateSlug: z.string().regex(/^[a-z0-9][a-z0-9.-]*$/).max(160),
  version: z.string().max(120).nullish(),
  channel: z.string().max(80).nullish(),
  releaseDate: z.string().datetime({ offset: true }).nullish(),
  title: z.string().min(1).max(500),
  summary: z.string().max(8_000).optional(),
  sourceUrl: httpsUrl,
  metadata: z.record(z.unknown()).optional(),
  items: z.array(itemSchema).max(5_000)
});

export const adapterManifestSchema = z.object({
  sourceKey: z.string().regex(/^[a-z0-9][a-z0-9-]*$/).max(120),
  displayName: z.string().min(1).max(200),
  family: z.enum(PRODUCT_UPDATE_FAMILIES),
  parserVersion: z.string().min(1).max(120),
  displayPriority: z.number().int().min(0).max(10_000).optional(),
  cadenceHours: z.number().int().positive().max(24 * 31),
  timeoutMs: z.number().int().positive().max(120_000),
  maxResponseBytes: z.number().int().positive().max(20 * 1024 * 1024),
  minimumExpectedRecords: z.number().int().nonnegative(),
  maximumExpectedRecords: z.number().int().positive().optional(),
  maximumRecordDropFraction: z.number().min(0).max(1).optional(),
  targets: z
    .array(
      z.object({
        targetKey: z.string().regex(/^[a-z0-9][a-z0-9-]*$/).max(120),
        url: httpsUrl,
        allowedHosts: z.array(z.string().min(1)).min(1)
      })
    )
    .min(1)
});

export function validateAdapterManifest(manifest: ProductUpdateAdapterManifest) {
  const validated = adapterManifestSchema.parse(manifest);
  const targetKeys = new Set<string>();
  for (const target of validated.targets) {
    if (targetKeys.has(target.targetKey)) {
      throw new Error(`Duplicate target key ${target.targetKey} for ${manifest.sourceKey}`);
    }
    targetKeys.add(target.targetKey);
    if (!target.allowedHosts.includes(new URL(target.url).hostname)) {
      throw new Error(`Target host is not allowlisted for ${manifest.sourceKey}/${target.targetKey}`);
    }
  }
  return validated;
}

export function validateObservations(
  raw: unknown,
  manifest: ProductUpdateAdapterManifest,
  previousRecordCount: number | null
): NormalizedProductUpdateObservation[] {
  if (!Array.isArray(raw)) {
    throw new Error("Parser did not return an observation array");
  }

  const observations = raw.map((value) => observationSchema.parse(value));
  if (observations.length < manifest.minimumExpectedRecords) {
    throw new Error(
      `Parser returned ${observations.length} records; expected at least ${manifest.minimumExpectedRecords}`
    );
  }
  if (
    manifest.maximumExpectedRecords !== undefined &&
    observations.length > manifest.maximumExpectedRecords
  ) {
    throw new Error(
      `Parser returned ${observations.length} records; maximum is ${manifest.maximumExpectedRecords}`
    );
  }
  if (
    previousRecordCount !== null &&
    previousRecordCount > 0 &&
    manifest.maximumRecordDropFraction !== undefined
  ) {
    const dropFraction = 1 - observations.length / previousRecordCount;
    if (dropFraction > manifest.maximumRecordDropFraction) {
      throw new Error(
        `Parser record count dropped ${(dropFraction * 100).toFixed(1)}%; maximum allowed is ${(manifest.maximumRecordDropFraction * 100).toFixed(1)}%`
      );
    }
  }

  const sourceKeys = new Set<string>();
  for (const observation of observations) {
    if (sourceKeys.has(observation.sourceUpdateKey)) {
      throw new Error(`Duplicate source update key ${observation.sourceUpdateKey}`);
    }
    sourceKeys.add(observation.sourceUpdateKey);

    const itemKeys = new Set<string>();
    for (const item of observation.items) {
      if (itemKeys.has(item.itemKey)) {
        throw new Error(
          `Duplicate item key ${item.itemKey} in observation ${observation.sourceUpdateKey}`
        );
      }
      itemKeys.add(item.itemKey);
    }
  }

  return observations;
}
