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
import { parseUnityDate } from "./html";
import { extractUnityDocsItems } from "./unity-docs";

const URL = "https://docs.unity.com/en-us/cloud/asset-manager/whats-new";

export const assetManagerAdapter: ProductUpdateAdapter = {
  manifest: {
    sourceKey: "asset-manager",
    displayName: "Unity Asset Manager what's new",
    family: "platform-services",
    parserVersion: "asset-manager-html-v1",
    displayPriority: 10,
    allowedEvidenceHosts: ["docs.unity.com"],
    cadenceHours: 24,
    timeoutMs: 30_000,
    maxResponseBytes: 3 * 1024 * 1024,
    minimumExpectedRecords: 10,
    maximumExpectedRecords: 200,
    maximumRecordDropFraction: 0.4,
    targets: [
      {
        targetKey: "all-components",
        url: URL,
        allowedHosts: ["docs.unity.com"]
      }
    ]
  },
  parse: parseAssetManagerUpdates
};

export function parseAssetManagerUpdates(
  snapshot: ProductUpdateSnapshot
): NormalizedProductUpdateObservation[] {
  const $ = cheerio.load(snapshot.text);
  const rootHeading = $("h1")
    .filter((_, heading) => /^what's new$/i.test(normalizeProductUpdateText($(heading).text())))
    .last();
  if (rootHeading.length === 0) {
    throw new Error("Unity Asset Manager what's-new root heading is missing");
  }
  const observations: NormalizedProductUpdateObservation[] = [];
  rootHeading.parent().children("h2").each((_, heading) => {
    const dateText = normalizeProductUpdateText($(heading).text());
    const releaseDate = parseUnityDate(dateText);
    if (!releaseDate) return;
    const items = extractUnityDocsItems($, $(heading).nextUntil("h2"), "Updates");
    const dateKey = releaseDate.slice(0, 10);
    const anchor = $(heading).attr("id") || productUpdateSlug(dateText);
    observations.push({
      productKey: "unity-asset-manager",
      productSlug: "unity-asset-manager",
      productName: "Unity Asset Manager",
      productDescription:
        "Cloud asset organization, collaboration, transformation, web, API, and Editor workflows.",
      productCanonicalUrl: URL,
      componentKey: "all-components",
      sourceUpdateKey: dateKey,
      canonicalKey: `date:${dateKey}`,
      updateSlug: dateKey,
      version: null,
      channel: null,
      releaseDate,
      title: `Unity Asset Manager — ${dateText}`,
      summary: `${items.length.toLocaleString()} documented ${items.length === 1 ? "change" : "changes"}.`,
      sourceUrl: `${snapshot.finalUrl}#${anchor}`,
      metadata: { datePrecision: "day" },
      items
    });
  });
  if (observations.length === 0) {
    throw new Error("Unity Asset Manager parser found no dated update sections");
  }
  return observations;
}
