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

const IOS_REPOSITORY =
  "https://raw.githubusercontent.com/ironsource-mobile/levelplay-ios-adapters/master/Adapters/";
const ANDROID_REPOSITORY =
  "https://raw.githubusercontent.com/ironsource-mobile/levelplay-android-adapters/master/Adapters/";

type AdapterInventoryEntry = {
  key: string;
  name: string;
  iosPath: string;
  androidPath?: string;
};

/**
 * Explicit snapshot of the adapter changelogs linked from Unity's
 * "Mediation Networks for Unity" page on 2026-07-28.
 *
 * Runtime ingestion never discovers sources from that page. A new or renamed
 * upstream adapter must be reviewed and added here before it can be enabled.
 */
export const LEVELPLAY_MEDIATION_ADAPTER_INVENTORY: readonly AdapterInventoryEntry[] =
  [
    {
      key: "applovin",
      name: "AppLovin",
      iosPath: "AppLovin/CHANGELOG.md",
      androidPath: "Applovin/CHANGELOG.md"
    },
    {
      key: "aps",
      name: "Amazon Publisher Services",
      iosPath: "APS%20(Amazon%20Publisher%20Services)/CHANGELOG.md",
      androidPath: "APS%20(Amazon%20Publisher%20Services)/CHANGELOG.md"
    },
    {
      key: "bidmachine",
      name: "BidMachine",
      iosPath: "BidMachine/CHANGELOG.md",
      androidPath: "BidMachine/CHANGELOG.md"
    },
    {
      key: "bigo-ads",
      name: "BIGO Ads",
      iosPath: "Bigo/CHANGELOG.md",
      androidPath: "Bigo/CHANGELOG.md"
    },
    {
      key: "chartboost",
      name: "Chartboost",
      iosPath: "Chartboost/CHANGELOG.md",
      androidPath: "Chartboost/CHANGELOG.md"
    },
    {
      key: "dt-exchange",
      name: "DT Exchange",
      iosPath: "DTExchange/CHANGELOG.md",
      androidPath: "DTExchange/CHANGELOG.md"
    },
    {
      key: "google",
      name: "Google AdMob & Ad Manager",
      iosPath: "Google%20(AdMob%20and%20Ad%20Manager)/CHANGELOG.md",
      androidPath: "Google%20(AdMob%20and%20Ad%20Manager)/CHANGELOG.md"
    },
    {
      key: "hyprmx",
      name: "HyprMX",
      iosPath: "HyprMX/CHANGELOG.md",
      androidPath: "HyprMX/CHANGELOG.md"
    },
    {
      key: "inmobi",
      name: "InMobi",
      iosPath: "InMobi/CHANGELOG.md",
      androidPath: "InMobi/CHANGELOG.md"
    },
    {
      key: "liftoff-monetize",
      name: "Liftoff Monetize",
      iosPath: "Vungle/CHANGELOG.md",
      androidPath: "Vungle/CHANGELOG.md"
    },
    {
      key: "ly-ads",
      name: "LY Ads Network",
      iosPath: "Line/CHANGELOG.md",
      androidPath: "Line/CHANGELOG.md"
    },
    {
      key: "meta-audience-network",
      name: "Meta Audience Network",
      iosPath: "Facebook/CHANGELOG.md",
      androidPath: "Facebook/CHANGELOG.md"
    },
    {
      key: "mintegral",
      name: "Mintegral",
      iosPath: "Mintegral/CHANGELOG.md",
      androidPath: "Mintegral/CHANGELOG.md"
    },
    {
      key: "mobilefuse",
      name: "MobileFuse",
      iosPath: "MobileFuse/CHANGELOG.md",
      androidPath: "MobileFuse/CHANGELOG.md"
    },
    {
      key: "moloco",
      name: "Moloco",
      iosPath: "Moloco/CHANGELOG.md",
      androidPath: "Moloco/CHANGELOG.md"
    },
    {
      key: "ogury",
      name: "Ogury",
      iosPath: "Ogury/CHANGELOG.md",
      androidPath: "Ogury/CHANGELOG.md"
    },
    {
      key: "pangle",
      name: "Pangle",
      iosPath: "Pangle/CHANGELOG.md",
      androidPath: "Pangle/CHANGELOG.md"
    },
    {
      key: "pubmatic",
      name: "PubMatic",
      iosPath: "PubMatic/CHANGELOG.md",
      androidPath: "PubMatic/CHANGELOG.md"
    },
    {
      key: "smaato",
      name: "Smaato",
      iosPath: "Smaato/CHANGELOG.md",
      androidPath: "Smaato/CHANGELOG.md"
    },
    {
      key: "superawesome",
      name: "SuperAwesome",
      iosPath: "SuperAwesome/CHANGELOG.md",
      androidPath: "SuperAwesome/CHANGELOG.md"
    },
    {
      key: "tencent",
      name: "Tencent",
      iosPath: "Tencent/CHANGELOG.md"
    },
    {
      key: "unity-ads",
      name: "Unity Ads",
      iosPath: "UnityAds/CHANGELOG.md",
      androidPath: "UnityAds/CHANGELOG.md"
    },
    {
      key: "verve",
      name: "Verve",
      iosPath: "Verve/CHANGELOG.md",
      androidPath: "Verve/CHANGELOG.md"
    },
    {
      key: "vk-ad-network",
      name: "VK Ad Network",
      iosPath: "VK%20Ad%20Network/CHANGELOG.md",
      androidPath: "VK%20Ad%20Network/CHANGELOG.md"
    },
    {
      key: "yandex-ads",
      name: "Yandex Ads",
      iosPath: "Yandex/CHANGELOG.md",
      androidPath: "Yandex/CHANGELOG.md"
    },
    {
      key: "yso-network",
      name: "YSO Network",
      iosPath: "YSO/CHANGELOG.md",
      androidPath: "YSO/CHANGELOG.md"
    }
  ];

type MediationPlatform = {
  key: "ios" | "android";
  label: "iOS" | "Android";
  url: string;
};

export const levelPlayMediationAdapterSources: readonly ProductUpdateAdapter[] =
  LEVELPLAY_MEDIATION_ADAPTER_INVENTORY.flatMap((entry) => {
    const platforms: MediationPlatform[] = [
      { key: "ios", label: "iOS", url: `${IOS_REPOSITORY}${entry.iosPath}` }
    ];
    if (entry.androidPath) {
      platforms.push({
        key: "android",
        label: "Android",
        url: `${ANDROID_REPOSITORY}${entry.androidPath}`
      });
    }
    return platforms.map((platform) =>
      createMediationAdapter(entry, platform)
    );
  });

function createMediationAdapter(
  network: AdapterInventoryEntry,
  platform: MediationPlatform
): ProductUpdateAdapter {
  return {
    manifest: {
      sourceKey: `levelplay-adapter-${network.key}-${platform.key}`,
      displayName: `LevelPlay ${network.name} ${platform.label} adapter changelog`,
      family: "monetization",
      parserVersion: "levelplay-adapter-markdown-v1",
      displayPriority: 10,
      cadenceHours: 24,
      timeoutMs: 30_000,
      maxResponseBytes: 1024 * 1024,
      minimumExpectedRecords: 2,
      maximumExpectedRecords: 500,
      maximumRecordDropFraction: 0.5,
      targets: [
        {
          targetKey: `${network.key}-${platform.key}`,
          url: platform.url,
          allowedHosts: ["raw.githubusercontent.com"]
        }
      ]
    },
    parse: (snapshot) =>
      parseLevelPlayMediationAdapter(snapshot, network, platform)
  };
}

export function parseLevelPlayMediationAdapter(
  snapshot: ProductUpdateSnapshot,
  network: Pick<AdapterInventoryEntry, "key" | "name">,
  platform: Pick<MediationPlatform, "key" | "label">
): NormalizedProductUpdateObservation[] {
  if (!/^#\s+changelog\s*$/im.test(snapshot.text)) {
    throw new Error(
      `LevelPlay ${network.name} ${platform.label} adapter changelog root is missing`
    );
  }

  const releasePattern =
    /^##\s+(?:version\s+)?v?([0-9][0-9A-Za-z._+-]*)\s*$/gim;
  const headings = [...snapshot.text.matchAll(releasePattern)];
  if (headings.length === 0) {
    throw new Error(
      `LevelPlay ${network.name} ${platform.label} adapter has no version sections`
    );
  }

  const releases = new Map<string, string[]>();
  headings.forEach((heading, index) => {
    const version = heading[1];
    const start = (heading.index ?? 0) + heading[0].length;
    const end = headings[index + 1]?.index ?? snapshot.text.length;
    const section = snapshot.text.slice(start, end);
    const bodies = extractMarkdownNotes(section);
    if (bodies.length === 0) {
      throw new Error(
        `LevelPlay ${network.name} ${platform.label} adapter ${version} has empty notes`
      );
    }
    const existing = releases.get(version.toLowerCase()) ?? [];
    releases.set(
      version.toLowerCase(),
      [...existing, ...bodies].filter(
        (body, bodyIndex, allBodies) =>
          allBodies.findIndex((candidate) => candidate === body) === bodyIndex
      )
    );
  });

  return [...releases.entries()].map(([normalizedVersion, bodies]) => {
    const version = headings.find(
      (heading) => heading[1].toLowerCase() === normalizedVersion
    )?.[1];
    if (!version) {
      throw new Error(`LevelPlay adapter version ${normalizedVersion} is missing`);
    }
    const items = bodies.map((body, sourceOrder) =>
      makeAdapterItem(body, platform.label, sourceOrder)
    );
    const componentKey = `${network.key}-${platform.key}`;

    return {
      productKey: "unity-levelplay-adapters",
      productSlug: "unity-levelplay-adapters",
      productName: "LevelPlay Mediation Adapters",
      productDescription:
        "Native ad-network adapter compatibility and integration changes for Unity LevelPlay.",
      productCanonicalUrl:
        "https://docs.unity.com/en-us/grow/levelplay/sdk/unity/mediation-networks",
      componentKey,
      sourceUpdateKey: version.toLowerCase(),
      canonicalKey: `version:${version.toLowerCase()}`,
      updateSlug: `${componentKey}-${productUpdateSlug(version)}`,
      version,
      channel: "production",
      releaseDate: null,
      title: `${network.name} ${platform.label} adapter ${version}`,
      summary: bodies[0],
      sourceUrl: `${toGitHubBrowseUrl(snapshot.finalUrl)}#version-${productUpdateSlug(version)}`,
      metadata: {
        datePrecision: "unknown",
        network: network.name,
        platform: platform.label
      },
      items
    };
  });
}

function extractMarkdownNotes(section: string) {
  const bodies: string[] = [];
  let inCodeFence = false;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    const value = cleanMarkdown(paragraph.join(" "));
    paragraph = [];
    if (value) bodies.push(value);
  };

  for (const line of section.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (/^```/.test(trimmed)) {
      inCodeFence = !inCodeFence;
      continue;
    }
    if (inCodeFence || /^---+$/.test(trimmed) || /^#{1,6}\s+/.test(trimmed)) {
      flushParagraph();
      continue;
    }
    const bullet = trimmed.match(/^[-*+]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      const value = cleanMarkdown(bullet[1]);
      if (value) bodies.push(value);
      continue;
    }
    if (!trimmed) {
      flushParagraph();
      continue;
    }
    paragraph.push(trimmed);
  }
  flushParagraph();

  return bodies.filter(
    (body, index) =>
      bodies.findIndex((candidate) => candidate === body) === index
  );
}

function cleanMarkdown(value: string) {
  return normalizeProductUpdateText(
    value
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/[*_~]/g, "")
      .replace(/^>\s*/, "")
  );
}

function makeAdapterItem(
  body: string,
  platform: string,
  sourceOrder: number
): NormalizedProductUpdateItem {
  const section = `${platform} adapter`;
  const item: NormalizedProductUpdateItem = {
    itemKey: "",
    section,
    changeKind: classifyProductUpdateChange(section, body),
    body,
    platforms: [platform],
    tags: ["mediation-adapter", productUpdateSlug(platform)],
    sourceOrder
  };
  item.itemKey = stableProductUpdateItemKey(item);
  return item;
}

function toGitHubBrowseUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  if (url.hostname !== "raw.githubusercontent.com") return rawUrl;
  const [owner, repository, branch, ...path] = url.pathname
    .split("/")
    .filter(Boolean);
  if (!owner || !repository || !branch || path.length === 0) return rawUrl;
  return `https://github.com/${owner}/${repository}/blob/${branch}/${path.join("/")}`;
}
