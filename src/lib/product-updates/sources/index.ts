import type { ProductUpdateAdapter } from "../types";
import { unityCliAdapter } from "./unity-cli";
import { unityHubAdapter } from "./unity-hub";

export const PRODUCT_UPDATE_ADAPTERS: readonly ProductUpdateAdapter[] = [
  unityHubAdapter,
  unityCliAdapter
];

export function findProductUpdateAdapter(sourceKey: string) {
  return (
    PRODUCT_UPDATE_ADAPTERS.find(
      (adapter) => adapter.manifest.sourceKey === sourceKey
    ) ?? null
  );
}

export function productUpdateAdaptersForFamily(family: string) {
  return PRODUCT_UPDATE_ADAPTERS.filter(
    (adapter) => adapter.manifest.family === family
  );
}
