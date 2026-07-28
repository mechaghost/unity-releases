import * as cheerio from "cheerio";
import {
  normalizeProductUpdateText,
  productUpdateSlug
} from "../normalization";
import type {
  NormalizedProductUpdateObservation,
  ProductUpdateAdapter,
  ProductUpdateSnapshot
} from "../types";
import { extractUnityDocsItems } from "./unity-docs";

const URL = "https://docs.unity.com/en-us/services/release-notes";

type UgsProduct = {
  key: string;
  slug: string;
  name: string;
  componentKey: string;
  description: string;
};

const PRODUCT_RULES: Array<[RegExp, Omit<UgsProduct, "componentKey">]> = [
  [/vivox/i, product("vivox-unity", "Vivox Unity SDK", "Voice and text chat for Unity projects.")],
  [/in-app purchasing/i, product("unity-iap", "Unity In-App Purchasing", "Cross-platform in-app purchasing services and SDK.")],
  [/authentication|player accounts/i, product("unity-authentication", "Unity Authentication", "Player authentication and account services.")],
  [/cloud code/i, product("unity-cloud-code", "Unity Cloud Code", "Serverless modules and scripts for game logic.")],
  [/cloud save/i, product("unity-cloud-save", "Unity Cloud Save", "Cloud-hosted player and game data.")],
  [/cloud content delivery|ccd/i, product("unity-cloud-content-delivery", "Unity Cloud Content Delivery", "Content delivery and release management.")],
  [/cloud build/i, product("unity-cloud-build", "Unity Build Automation", "Cloud build automation for Unity projects.")],
  [/economy/i, product("unity-economy", "Unity Economy", "Currencies, inventories, purchases, and virtual economies.")],
  [/friends/i, product("unity-friends", "Unity Friends", "Player relationship and friends services.")],
  [/leaderboards/i, product("unity-leaderboards", "Unity Leaderboards", "Cross-platform player leaderboards.")],
  [/\blobby\b/i, product("unity-lobby", "Unity Lobby", "Player grouping and lobby discovery.")],
  [/matchmaker/i, product("unity-matchmaker", "Unity Matchmaker", "Rule-based multiplayer matchmaking.")],
  [/multiplay|game server hosting/i, product("unity-multiplay", "Unity Multiplay", "Managed game server hosting.")],
  [/multiplayer/i, product("unity-multiplayer", "Unity Multiplayer", "Multiplayer services and development SDKs.")],
  [/moderation|safe voice|safe text/i, product("unity-moderation", "Unity Moderation", "Player safety, voice, and text moderation.")],
  [/push notifications/i, product("unity-push-notifications", "Unity Push Notifications", "Player push-notification delivery.")],
  [/\bqos\b/i, product("unity-qos", "Unity QoS", "Network quality-of-service measurement.")],
  [/\brelay\b/i, product("unity-relay", "Unity Relay", "Secure peer connectivity without dedicated servers.")],
  [/remote config|game overrides/i, product("unity-remote-config", "Unity Remote Config", "Runtime configuration and game overrides.")],
  [/analytics/i, product("unity-analytics", "Unity Analytics", "Game analytics data and dashboards.")],
  [/deployment|unity devops/i, product("unity-devops", "Unity DevOps", "Deployment and development operations tooling.")],
  [/user generated content|\bugc\b/i, product("unity-ugc", "Unity User Generated Content", "Player-created content services.")],
  [/services core|core sdk|service apis/i, product("unity-services-core", "Unity Services Core", "Shared SDK foundations for Unity Gaming Services.")],
  [/use cases samples/i, product("unity-ugs-samples", "Unity Gaming Services Samples", "Reference integrations for Unity Gaming Services.")]
];

export const ugsAdapter: ProductUpdateAdapter = {
  manifest: {
    sourceKey: "ugs",
    displayName: "Unity Gaming Services release notes",
    family: "platform-services",
    parserVersion: "ugs-html-v1",
    displayPriority: 50,
    cadenceHours: 24,
    timeoutMs: 45_000,
    maxResponseBytes: 6 * 1024 * 1024,
    minimumExpectedRecords: 150,
    maximumExpectedRecords: 1_000,
    maximumRecordDropFraction: 0.3,
    targets: [
      {
        targetKey: "aggregate",
        url: URL,
        allowedHosts: ["docs.unity.com"]
      }
    ]
  },
  parse: parseUgsReleaseNotes
};

export function parseUgsReleaseNotes(
  snapshot: ProductUpdateSnapshot
): NormalizedProductUpdateObservation[] {
  const $ = cheerio.load(snapshot.text);
  const rootHeading = $("h1")
    .filter((_, heading) => /^ugs release notes$/i.test(normalizeProductUpdateText($(heading).text())))
    .last();
  if (rootHeading.length === 0) {
    throw new Error("UGS release-notes root heading is missing");
  }
  const root = rootHeading.parent();
  const observations: NormalizedProductUpdateObservation[] = [];

  root.children("h3").each((_, heading) => {
    const title = normalizeProductUpdateText($(heading).text());
    const monthHeading = $(heading).prevAll("h2").first();
    const month = parseUnityMonth(normalizeProductUpdateText(monthHeading.text()));
    if (!month) {
      throw new Error(`UGS update has no valid month: ${title}`);
    }
    const parsed = parseUgsHeading(title);
    const mapped = mapUgsProduct(parsed.productName);
    const items = extractUnityDocsItems($, $(heading).nextUntil("h2,h3"), "Updates");
    const canonicalKey = parsed.version
      ? `version:${parsed.version.toLowerCase()}`
      : `month:${month.key}:${productUpdateSlug(title)}`;
    const updateSlug = parsed.version
      ? parsed.version.toLowerCase()
      : `${month.key}-${productUpdateSlug(title)}`.slice(0, 160);
    const sourceKey = parsed.version
      ? `${month.key}:${mapped.key}:${mapped.componentKey}:${parsed.version.toLowerCase()}:${productUpdateSlug(parsed.productName)}`
      : `${month.key}:${productUpdateSlug(title)}`;
    const anchor = $(heading).attr("id") || productUpdateSlug(title);

    observations.push({
      productKey: mapped.key,
      productSlug: mapped.slug,
      productName: mapped.name,
      productDescription: mapped.description,
      productCanonicalUrl: URL,
      componentKey: mapped.componentKey,
      sourceUpdateKey: sourceKey,
      canonicalKey,
      updateSlug,
      version: parsed.version,
      channel: parsed.version?.toLowerCase().includes("exp") ? "experimental" : null,
      releaseDate: month.iso,
      title,
      summary: `${items.length.toLocaleString()} documented ${items.length === 1 ? "change" : "changes"}.`,
      sourceUrl: `${snapshot.finalUrl}#${anchor}`,
      metadata: { datePrecision: "month", sourceMonth: month.key },
      items
    });
  });

  if (observations.length === 0) {
    throw new Error("UGS parser found no product update sections");
  }
  return observations;
}

function parseUgsHeading(title: string) {
  const match = title.match(
    /^(.*?)(?:\s+v?)((?:\d+\.)+\d+(?:[-.][a-z0-9]+)*)$/i
  );
  return {
    productName: normalizeProductUpdateText(match?.[1] ?? title),
    version: match?.[2] ?? null
  };
}

function mapUgsProduct(value: string): UgsProduct {
  const normalized = value.replace(/\s*BETA\s*$/i, "").trim();
  for (const [pattern, mapped] of PRODUCT_RULES) {
    if (pattern.test(normalized)) {
      return {
        ...mapped,
        componentKey: mapped.key === "vivox-unity" ? "unity" : "main"
      };
    }
  }
  return {
    key: "unity-gaming-services",
    slug: "unity-gaming-services",
    name: "Unity Gaming Services",
    componentKey: productUpdateSlug(normalized) || "aggregate",
    description: "Shared online services and SDK updates for connected games."
  };
}

function parseUnityMonth(value: string) {
  const match = value.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (!match) return null;
  const monthIndex = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december"
  ].indexOf(match[1].toLowerCase());
  if (monthIndex < 0) return null;
  const year = Number(match[2]);
  const monthNumber = String(monthIndex + 1).padStart(2, "0");
  return {
    key: `${year}-${monthNumber}`,
    iso: new Date(Date.UTC(year, monthIndex, 1)).toISOString()
  };
}

function product(key: string, name: string, description: string) {
  return { key, slug: key, name, description };
}
