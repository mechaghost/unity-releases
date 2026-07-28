import type { ProductUpdateAdapter } from "../types";
import { assetManagerAdapter } from "./asset-manager";
import { levelPlaySdkAdapters } from "./levelplay";
import { levelPlayMediationAdapterSources } from "./levelplay-mediation-adapters";
import { licensingServerAdapter } from "./licensing-server";
import { ugsAdapter } from "./ugs";
import { unityAdsAdapters } from "./unity-ads";
import { unityCliAdapter } from "./unity-cli";
import { unityHubAdapter } from "./unity-hub";
import { unityVersionControlAdapter } from "./unity-version-control";
import {
  vivoxCoreAdapter,
  vivoxUnityAdapter,
  vivoxUnrealAdapter
} from "./vivox";

export const PRODUCT_UPDATE_ADAPTERS: readonly ProductUpdateAdapter[] = [
  unityHubAdapter,
  unityCliAdapter,
  licensingServerAdapter,
  unityVersionControlAdapter,
  assetManagerAdapter,
  ugsAdapter,
  vivoxUnityAdapter,
  vivoxCoreAdapter,
  vivoxUnrealAdapter,
  ...unityAdsAdapters,
  ...levelPlaySdkAdapters,
  ...levelPlayMediationAdapterSources
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
