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

type LevelPlayPlatform = {
  key: "unity" | "android" | "ios";
  label: "Unity" | "Android" | "iOS";
  url: string;
  versionColumn: number;
  releaseDateColumn: number;
  notesColumn: number;
};

const LEVELPLAY_PLATFORMS: readonly LevelPlayPlatform[] = [
  {
    key: "unity",
    label: "Unity",
    url: "https://docs.unity.com/en-us/grow/levelplay/sdk/unity/changelog",
    versionColumn: 0,
    releaseDateColumn: 2,
    notesColumn: 3
  },
  {
    key: "android",
    label: "Android",
    url: "https://docs.unity.com/en-us/grow/levelplay/sdk/android/changelog",
    versionColumn: 0,
    releaseDateColumn: 1,
    notesColumn: 2
  },
  {
    key: "ios",
    label: "iOS",
    url: "https://docs.unity.com/en-us/grow/levelplay/sdk/ios/changelog",
    versionColumn: 0,
    releaseDateColumn: 1,
    notesColumn: 2
  }
];

export const levelPlaySdkAdapters = LEVELPLAY_PLATFORMS.map(
  createLevelPlaySdkAdapter
);

export const levelPlayUnityAdapter = requiredAdapter("unity");
export const levelPlayAndroidAdapter = requiredAdapter("android");
export const levelPlayIosAdapter = requiredAdapter("ios");

function requiredAdapter(platform: LevelPlayPlatform["key"]) {
  const adapter = levelPlaySdkAdapters.find(
    (candidate) => candidate.manifest.sourceKey === `levelplay-${platform}`
  );
  if (!adapter) throw new Error(`LevelPlay ${platform} adapter is missing`);
  return adapter;
}

function createLevelPlaySdkAdapter(
  platform: LevelPlayPlatform
): ProductUpdateAdapter {
  return {
    manifest: {
      sourceKey: `levelplay-${platform.key}`,
      displayName: `LevelPlay ${platform.label} SDK changelog`,
      family: "monetization",
      parserVersion: "levelplay-sdk-html-v1",
      displayPriority: 10,
      cadenceHours: 24,
      timeoutMs: 30_000,
      maxResponseBytes: 2 * 1024 * 1024,
      minimumExpectedRecords: 15,
      maximumExpectedRecords: 300,
      maximumRecordDropFraction: 0.4,
      targets: [
        {
          targetKey: platform.key,
          url: platform.url,
          allowedHosts: ["docs.unity.com"]
        }
      ]
    },
    parse: (snapshot) => parseLevelPlaySdkChangelog(snapshot, platform)
  };
}

export function parseLevelPlaySdkChangelog(
  snapshot: ProductUpdateSnapshot,
  platform: LevelPlayPlatform
): NormalizedProductUpdateObservation[] {
  const $ = cheerio.load(snapshot.text);
  const root = $("h1")
    .filter(
      (_, heading) =>
        normalizeProductUpdateText($(heading).text()).toLowerCase() ===
        "levelplay sdk changelog"
    )
    .last();
  if (root.length === 0) {
    throw new Error(`LevelPlay ${platform.label} SDK root heading is missing`);
  }
  const table = root.parent().find("table").first();
  if (table.length === 0) {
    throw new Error(`LevelPlay ${platform.label} SDK changelog table is missing`);
  }

  const observations: NormalizedProductUpdateObservation[] = [];
  table.find("tr").slice(1).each((_, row) => {
    const cells = $(row).find("th,td");
    const version = normalizeProductUpdateText(
      cells.eq(platform.versionColumn).text()
    );
    const releaseDateText = normalizeProductUpdateText(
      cells.eq(platform.releaseDateColumn).text()
    );
    const note = normalizeProductUpdateText(
      cells.eq(platform.notesColumn).text()
    );
    if (!version && !releaseDateText && !note) return;
    if (!/^[0-9][0-9A-Za-z.+/-]*$/.test(version)) {
      throw new Error(
        `LevelPlay ${platform.label} SDK has an invalid version: ${version}`
      );
    }
    const releaseDate = parseSlashDate(releaseDateText);
    if (!releaseDate) {
      throw new Error(
        `LevelPlay ${platform.label} SDK ${version} has an invalid release date`
      );
    }
    if (!note) {
      throw new Error(
        `LevelPlay ${platform.label} SDK ${version} has empty notes`
      );
    }

    const item = makeItem(note, platform.label);
    observations.push({
      productKey: "unity-levelplay",
      productSlug: "unity-levelplay",
      productName: "Unity LevelPlay",
      productDescription:
        "Unity LevelPlay mediation SDK release history across supported platforms.",
      productCanonicalUrl:
        "https://docs.unity.com/en-us/grow/levelplay/sdk/unity/get-started-index",
      componentKey: platform.key,
      sourceUpdateKey: `${version.toLowerCase()}:${releaseDateText}`,
      canonicalKey: `version:${version.toLowerCase()}`,
      updateSlug: `${platform.key}-${productUpdateSlug(version)}`,
      version,
      channel: "production",
      releaseDate,
      title: `LevelPlay ${platform.label} SDK ${version}`,
      summary: note,
      sourceUrl: snapshot.finalUrl,
      metadata: { platform: platform.label },
      items: [item]
    });
  });

  if (observations.length === 0) {
    throw new Error(
      `LevelPlay ${platform.label} SDK changelog has no release rows`
    );
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

function parseSlashDate(value: string) {
  const match = value.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!match) return null;
  const iso = `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  const date = new Date(`${iso}T00:00:00.000Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== iso
  ) {
    return null;
  }
  return date.toISOString();
}
