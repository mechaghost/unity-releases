import { PRODUCT_UPDATE_ADAPTERS } from "../lib/product-updates/sources";

const family = process.argv.slice(2).find((value) => !value.startsWith("--"));
const adapters = family
  ? PRODUCT_UPDATE_ADAPTERS.filter(
      (adapter) => adapter.manifest.family === family
    )
  : PRODUCT_UPDATE_ADAPTERS;

console.log(
  JSON.stringify(
    adapters.map((adapter) => ({
      sourceKey: adapter.manifest.sourceKey,
      family: adapter.manifest.family,
      displayName: adapter.manifest.displayName,
      cadenceHours: adapter.manifest.cadenceHours,
      targetCount: adapter.manifest.targets.length,
      targets: adapter.manifest.targets.map((target) => ({
        targetKey: target.targetKey,
        url: target.url
      }))
    })),
    null,
    2
  )
);
