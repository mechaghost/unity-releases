import * as cheerio from "cheerio";
import {
  normalizeProductUpdateText,
  stableProductUpdateItemKey
} from "../normalization";
import type {
  NormalizedProductUpdateItem,
  NormalizedProductUpdateObservation,
  ProductUpdateAdapter,
  ProductUpdateSnapshot
} from "../types";
import {
  classifyProductUpdateChange,
  directItemText,
  extractStructuredListItems,
  parseUnityDate
} from "./html";

const HUB_RELEASE_NOTES_URL = "https://unity.com/unity-hub/release-notes";
const HUB_VERSION = /^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/i;

export const unityHubAdapter: ProductUpdateAdapter = {
  manifest: {
    sourceKey: "unity-hub",
    displayName: "Unity Hub release notes",
    family: "editor-tooling",
    parserVersion: "unity-hub-html-v1",
    displayPriority: 10,
    cadenceHours: 12,
    timeoutMs: 30_000,
    maxResponseBytes: 3 * 1024 * 1024,
    minimumExpectedRecords: 80,
    maximumExpectedRecords: 300,
    maximumRecordDropFraction: 0.35,
    targets: [
      {
        targetKey: "all-channels",
        url: HUB_RELEASE_NOTES_URL,
        allowedHosts: ["unity.com", "www.unity.com"]
      }
    ]
  },
  parse: parseUnityHubReleaseNotes
};

export function parseUnityHubReleaseNotes(
  snapshot: ProductUpdateSnapshot
): NormalizedProductUpdateObservation[] {
  const $ = cheerio.load(snapshot.text);
  const title = normalizeProductUpdateText($("h1").first().text());
  if (!/unity hub release notes/i.test(title)) {
    throw new Error("Unity Hub release-notes root heading is missing");
  }

  const observations: NormalizedProductUpdateObservation[] = [];
  $("h2").each((_, heading) => {
    const version = normalizeProductUpdateText($(heading).text());
    if (!HUB_VERSION.test(version)) return;

    const content = $(heading).parent().next();
    const dateText = normalizeProductUpdateText(content.children("p").first().text());
    const releaseDate = parseUnityDate(dateText);
    if (!releaseDate) {
      throw new Error(`Unity Hub ${version} has an invalid release date: ${dateText}`);
    }

    const items = extractHubItems($, content);
    const channel = version.toLowerCase().includes("beta") ? "beta" : "production";
    observations.push({
      productKey: "unity-hub",
      productSlug: "unity-hub",
      productName: "Unity Hub",
      productDescription:
        "Install and manage Unity Editor versions, modules, projects, and licenses.",
      productCanonicalUrl: "https://unity.com/unity-hub",
      componentKey: "desktop",
      sourceUpdateKey: version.toLowerCase(),
      canonicalKey: `version:${version.toLowerCase()}`,
      updateSlug: version.toLowerCase(),
      version,
      channel,
      releaseDate,
      title: `Unity Hub ${version}`,
      summary: summarizeItems(items),
      sourceUrl: `${snapshot.finalUrl}#${version}`,
      metadata: { channel },
      items
    });
  });

  if (observations.length === 0) {
    throw new Error("Unity Hub parser found no versioned release sections");
  }
  return observations;
}

function extractHubItems(
  $: cheerio.CheerioAPI,
  content: cheerio.Cheerio<import("domhandler").AnyNode>
) {
  const items: NormalizedProductUpdateItem[] = [];
  let currentSection = "Updates";
  let sourceOrder = 0;

  content.children().each((_, child) => {
    const node = $(child);
    if (child.type === "tag" && child.tagName === "p") {
      const strong = node.children("strong").first();
      const text = normalizeProductUpdateText(node.text());
      if (strong.length > 0 && text.length <= 160) {
        currentSection = text;
      } else if (parseUnityDate(text) === null && text) {
        const item: NormalizedProductUpdateItem = {
          itemKey: "",
          section: currentSection,
          changeKind: classifyProductUpdateChange(currentSection, text),
          body: directItemText($, node),
          platforms: [],
          tags: [],
          sourceOrder
        };
        item.itemKey = stableProductUpdateItemKey(item);
        items.push(item);
        sourceOrder += 1;
      }
      return;
    }
    if (child.type === "tag" && (child.tagName === "ul" || child.tagName === "ol")) {
      for (const item of extractStructuredListItems($, node, currentSection)) {
        const offsetItem = {
          ...item,
          sourceOrder: sourceOrder + item.sourceOrder
        };
        offsetItem.itemKey = stableProductUpdateItemKey(offsetItem);
        items.push(offsetItem);
      }
      sourceOrder = items.length;
    }
  });

  return items;
}

function summarizeItems(items: NormalizedProductUpdateItem[]) {
  const sections = new Set(items.map((item) => item.section));
  return `${items.length.toLocaleString()} documented ${items.length === 1 ? "change" : "changes"} across ${sections.size.toLocaleString()} ${sections.size === 1 ? "section" : "sections"}.`;
}
