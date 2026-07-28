import type { ProductUpdateAdapter } from "./types";
import { validateAdapterManifest } from "./validation";

const adapters = new Map<string, ProductUpdateAdapter>();

export function registerProductUpdateAdapter(adapter: ProductUpdateAdapter) {
  validateAdapterManifest(adapter.manifest);
  if (adapters.has(adapter.manifest.sourceKey)) {
    throw new Error(`Duplicate Product Updates adapter: ${adapter.manifest.sourceKey}`);
  }
  adapters.set(adapter.manifest.sourceKey, adapter);
  return adapter;
}

export function getProductUpdateAdapter(sourceKey: string) {
  return adapters.get(sourceKey) ?? null;
}

export function listProductUpdateAdapters() {
  return [...adapters.values()].sort((a, b) =>
    a.manifest.sourceKey.localeCompare(b.manifest.sourceKey)
  );
}

export function clearProductUpdateAdaptersForTest() {
  adapters.clear();
}
