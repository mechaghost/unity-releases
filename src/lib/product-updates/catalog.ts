import {
  PRODUCT_UPDATE_FAMILIES,
  type ProductUpdateFamily
} from "./types";

export type ProductUpdateFamilyDetails = {
  key: ProductUpdateFamily;
  name: string;
  shortName: string;
  description: string;
  priority: "core-adjacent" | "secondary";
};

export const PRODUCT_UPDATE_FAMILY_DETAILS: Record<
  ProductUpdateFamily,
  ProductUpdateFamilyDetails
> = {
  "editor-tooling": {
    key: "editor-tooling",
    name: "Editor Tooling",
    shortName: "Editor tooling",
    description:
      "Unity Hub and Unity CLI releases that directly affect how Editor installations are managed.",
    priority: "core-adjacent"
  },
  "platform-services": {
    key: "platform-services",
    name: "Platform & Services",
    shortName: "Platform & services",
    description:
      "Unity Cloud, multiplayer, version control, asset management, licensing, and service SDK updates.",
    priority: "secondary"
  },
  monetization: {
    key: "monetization",
    name: "Monetization",
    shortName: "Monetization",
    description:
      "Unity Ads and LevelPlay release notes, kept separate from the Editor release-intelligence workflow.",
    priority: "secondary"
  },
  "industry-enterprise": {
    key: "industry-enterprise",
    name: "Industry & Enterprise",
    shortName: "Industry & enterprise",
    description:
      "Unity Studio, Asset Transformer, and Virtual Private Cloud product changes.",
    priority: "secondary"
  }
};

export const PRODUCT_UPDATE_FAMILY_CATALOG = PRODUCT_UPDATE_FAMILIES.map(
  (family) => PRODUCT_UPDATE_FAMILY_DETAILS[family]
);

export function getProductUpdateFamily(value: string) {
  return PRODUCT_UPDATE_FAMILY_DETAILS[value as ProductUpdateFamily] ?? null;
}
