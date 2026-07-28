import * as cheerio from "cheerio";
import {
  normalizeProductUpdateText,
  productUpdateSlug,
  stableProductUpdateItemKey
} from "../normalization";
import type {
  NormalizedProductUpdateItem,
  NormalizedProductUpdateObservation,
  ProductUpdateAdapter,
  ProductUpdateSnapshot
} from "../types";
import { classifyProductUpdateChange } from "./html";

const UNITY_ADS_CHANGELOG_URL =
  "https://docs.unity.com/en-us/grow/ads/changelog";
const ADS_RELEASE_HEADING =
  /^version\s+([0-9][0-9A-Za-z.+-]*)\s+-\s+released\s+(\d{4}-\d{2}-\d{2})$/i;

type UnityAdsPlatform = {
  key: "unity" | "android" | "ios";
  label: "Unity" | "Android" | "iOS";
};

const UNITY_ADS_PLATFORMS: readonly UnityAdsPlatform[] = [
  { key: "unity", label: "Unity" },
  { key: "android", label: "Android" },
  { key: "ios", label: "iOS" }
];

export const unityAdsAdapters = UNITY_ADS_PLATFORMS.map(
  createUnityAdsAdapter
);

export const unityAdsUnityAdapter = requiredAdapter("unity");
export const unityAdsAndroidAdapter = requiredAdapter("android");
export const unityAdsIosAdapter = requiredAdapter("ios");

function requiredAdapter(platform: UnityAdsPlatform["key"]) {
  const adapter = unityAdsAdapters.find(
    (candidate) => candidate.manifest.sourceKey === `unity-ads-${platform}`
  );
  if (!adapter) throw new Error(`Unity Ads ${platform} adapter is missing`);
  return adapter;
}

function createUnityAdsAdapter(platform: UnityAdsPlatform): ProductUpdateAdapter {
  return {
    manifest: {
      sourceKey: `unity-ads-${platform.key}`,
      displayName: `Unity Ads ${platform.label} SDK changelog`,
      family: "monetization",
      parserVersion: "unity-ads-html-v1",
      displayPriority: 10,
      cadenceHours: 24,
      timeoutMs: 30_000,
      maxResponseBytes: 2 * 1024 * 1024,
      minimumExpectedRecords: 25,
      maximumExpectedRecords: 200,
      maximumRecordDropFraction: 0.4,
      targets: [
        {
          targetKey: platform.key,
          url: UNITY_ADS_CHANGELOG_URL,
          allowedHosts: ["docs.unity.com"]
        }
      ]
    },
    parse: (snapshot) => parseUnityAdsChangelog(snapshot, platform)
  };
}

export function parseUnityAdsChangelog(
  snapshot: ProductUpdateSnapshot,
  platform: UnityAdsPlatform
): NormalizedProductUpdateObservation[] {
  const $ = cheerio.load(snapshot.text);
  const root = $("h1")
    .filter(
      (_, heading) =>
        normalizeProductUpdateText($(heading).text()).toLowerCase() ===
        "unity ads sdk changelog"
    )
    .last();
  if (root.length === 0) {
    throw new Error("Unity Ads changelog root heading is missing");
  }

  const observations: NormalizedProductUpdateObservation[] = [];
  root.parent().children("h2").each((_, heading) => {
    const headingText = normalizeProductUpdateText($(heading).text());
    const match = headingText.match(ADS_RELEASE_HEADING);
    if (!match) return;
    const [, version, dateText] = match;
    const releaseDate = parseIsoDate(dateText);
    if (!releaseDate) {
      throw new Error(`Unity Ads ${version} has an invalid release date`);
    }

    const releaseNodes = $(heading).nextUntil("h2");
    const row = releaseNodes
      .find("tr")
      .filter(
        (_, candidate) =>
          normalizeProductUpdateText($(candidate).find("th,td").first().text())
            .toLowerCase() === platform.label.toLowerCase()
      )
      .first();
    // Some historical releases only changed a subset of platforms. Each
    // platform adapter emits its own real history instead of inventing a
    // "no change" record for an absent row.
    if (row.length === 0) return;
    const note = normalizeProductUpdateText(row.find("th,td").eq(1).text());
    if (!note) {
      throw new Error(
        `Unity Ads ${version} has an empty ${platform.label} platform note`
      );
    }
    const item = makeItem(note, platform.label);
    const anchor = $(heading).attr("id") || productUpdateSlug(headingText);

    observations.push({
      productKey: "unity-ads-sdk",
      productSlug: "unity-ads-sdk",
      productName: "Unity Ads SDK",
      productDescription:
        "Unity's advertising SDK release history across Unity, Android, and iOS.",
      productCanonicalUrl: UNITY_ADS_CHANGELOG_URL,
      componentKey: platform.key,
      sourceUpdateKey: version.toLowerCase(),
      canonicalKey: `version:${version.toLowerCase()}`,
      updateSlug: `${platform.key}-${version.toLowerCase()}`,
      version,
      channel: "production",
      releaseDate,
      title: `Unity Ads ${platform.label} SDK ${version}`,
      summary: note,
      sourceUrl: `${snapshot.finalUrl}#${anchor}`,
      metadata: { platform: platform.label },
      items: [item]
    });
  });

  if (observations.length === 0) {
    throw new Error("Unity Ads changelog has no versioned release sections");
  }
  return observations;
}

function makeItem(body: string, platform: string): NormalizedProductUpdateItem {
  const item: NormalizedProductUpdateItem = {
    itemKey: "",
    section: `${platform} SDK`,
    changeKind: classifyProductUpdateChange(`${platform} SDK`, body),
    body,
    platforms: [platform],
    tags: [productUpdateSlug(platform)],
    sourceOrder: 0
  };
  item.itemKey = stableProductUpdateItemKey(item);
  return item;
}

function parseIsoDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    return null;
  }
  return date.toISOString();
}
