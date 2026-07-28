import { sha256 } from "../ingest/hash";
import type {
  NormalizedProductUpdateItem,
  NormalizedProductUpdateObservation
} from "./types";

export function normalizeProductUpdateText(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

export function productUpdateSlug(value: string) {
  return normalizeProductUpdateText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

export function stableProductUpdateItemKey(
  item: Pick<NormalizedProductUpdateItem, "section" | "body" | "sourceOrder">
) {
  return sha256(
    `${normalizeProductUpdateText(item.section)}:${item.sourceOrder}:${normalizeProductUpdateText(item.body)}`
  ).slice(0, 24);
}

export function normalizedObservationHash(observation: NormalizedProductUpdateObservation) {
  return sha256({
    productKey: observation.productKey,
    componentKey: observation.componentKey,
    canonicalKey: observation.canonicalKey,
    version: observation.version ?? null,
    channel: observation.channel ?? null,
    releaseDate: observation.releaseDate ?? null,
    title: normalizeProductUpdateText(observation.title),
    summary: normalizeProductUpdateText(observation.summary ?? ""),
    items: observation.items.map((item) => ({
      itemKey: item.itemKey,
      section: normalizeProductUpdateText(item.section),
      changeKind: item.changeKind,
      body: normalizeProductUpdateText(item.body),
      platforms: [...item.platforms].sort(),
      tags: [...item.tags].sort(),
      sourceOrder: item.sourceOrder
    }))
  });
}
