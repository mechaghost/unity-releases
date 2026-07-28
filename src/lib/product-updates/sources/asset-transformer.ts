import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
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
import { extractUnityDocsItems } from "./unity-docs";

const ASSET_TRANSFORMER_CHANGELOG =
  "https://docs.unity.com/en-us/asset-transformer-sdk/2026.4/manual/changelog";
const CHANGELOG_HEADING =
  /^\[([0-9][0-9A-Za-z.+-]*)\](?:\s+-\s+(.+))?$/;

export const assetTransformerAdapter: ProductUpdateAdapter = {
  manifest: {
    sourceKey: "asset-transformer",
    displayName: "Asset Transformer SDK changelog",
    family: "industry-enterprise",
    parserVersion: "asset-transformer-html-v1",
    displayPriority: 10,
    cadenceHours: 7 * 24,
    timeoutMs: 30_000,
    maxResponseBytes: 2 * 1024 * 1024,
    minimumExpectedRecords: 20,
    maximumExpectedRecords: 100,
    maximumRecordDropFraction: 0.4,
    targets: [
      {
        targetKey: "sdk",
        url: ASSET_TRANSFORMER_CHANGELOG,
        allowedHosts: ["docs.unity.com"]
      }
    ]
  },
  parse: parseAssetTransformerChangelog
};

export function parseAssetTransformerChangelog(
  snapshot: ProductUpdateSnapshot
): NormalizedProductUpdateObservation[] {
  const $ = cheerio.load(snapshot.text);
  const rootHeading = $("h1")
    .filter(
      (_, heading) =>
        normalizeProductUpdateText($(heading).text()).toLowerCase() ===
        "changelog"
    )
    .last();
  if (rootHeading.length === 0) {
    throw new Error("Asset Transformer changelog root heading is missing");
  }

  const releases = new Map<
    string,
    {
      version: string;
      dates: Array<{ iso: string; precision: "day" | "month" }>;
      items: NormalizedProductUpdateItem[];
      anchor: string;
    }
  >();
  rootHeading.parent().children("h2").each((_, heading) => {
    const headingText = normalizeProductUpdateText($(heading).text());
    const match = headingText.match(CHANGELOG_HEADING);
    if (!match) return;
    const [, version, dateText] = match;
    const normalizedVersion = version.toLowerCase();
    const release =
      releases.get(normalizedVersion) ?? {
        version,
        dates: [],
        items: [],
        anchor: $(heading).attr("id") || productUpdateSlug(headingText)
      };
    const date = dateText ? parseAssetTransformerDate(dateText) : null;
    if (date) release.dates.push(date);
    const releaseNodes = $(heading).nextUntil("h2");
    const items = [
      ...extractUnityDocsItems($, releaseNodes, "Updates"),
      ...extractTableItems($, releaseNodes)
    ];
    for (const item of items) {
      const normalizedItem = { ...item, sourceOrder: release.items.length };
      normalizedItem.itemKey = stableProductUpdateItemKey(normalizedItem);
      release.items.push(normalizedItem);
    }
    releases.set(normalizedVersion, release);
  });

  const observations = [...releases.values()].map((release) => {
    const latestDate = release.dates.sort((left, right) =>
      right.iso.localeCompare(left.iso)
    )[0];
    const uniqueItems = release.items.filter(
      (item, index, allItems) =>
        allItems.findIndex(
          (candidate) =>
            candidate.section === item.section && candidate.body === item.body
        ) === index
    );
    uniqueItems.forEach((item, index) => {
      item.sourceOrder = index;
      item.itemKey = stableProductUpdateItemKey(item);
    });

    return {
      productKey: "asset-transformer-sdk",
      productSlug: "asset-transformer-sdk",
      productName: "Asset Transformer SDK",
      productDescription:
        "The industrial 3D data preparation SDK formerly known as Pixyz.",
      productCanonicalUrl:
        "https://docs.unity.com/en-us/asset-transformer-sdk/2026.4/manual",
      componentKey: "sdk",
      sourceUpdateKey: release.version.toLowerCase(),
      canonicalKey: `version:${release.version.toLowerCase()}`,
      updateSlug: release.version.toLowerCase(),
      version: release.version,
      channel: "production",
      releaseDate: latestDate?.iso ?? null,
      title: `Asset Transformer SDK ${release.version}`,
      summary: `${uniqueItems.length.toLocaleString()} documented ${uniqueItems.length === 1 ? "change" : "changes"}.`,
      sourceUrl: `${snapshot.finalUrl}#${release.anchor}`,
      metadata: {
        datePrecision: latestDate?.precision ?? "unknown",
        legacyName: "Pixyz"
      },
      items: uniqueItems
    };
  });

  if (observations.length === 0) {
    throw new Error("Asset Transformer changelog has no version sections");
  }
  return observations;
}

function extractTableItems(
  $: cheerio.CheerioAPI,
  nodes: cheerio.Cheerio<AnyNode>
) {
  const items: NormalizedProductUpdateItem[] = [];
  const tables = nodes.filter("table").add(nodes.find("table"));
  tables.each((_, table) => {
    const headers = $(table)
      .find("tr")
      .first()
      .find("th,td")
      .map((__, cell) => normalizeProductUpdateText($(cell).text()))
      .get();
    $(table)
      .find("tr")
      .slice(1)
      .each((__, row) => {
        const cells = $(row)
          .find("th,td")
          .map((___, cell) => normalizeProductUpdateText($(cell).text()))
          .get();
        const body = cells
          .map((cell, index) => `${headers[index] || `Column ${index + 1}`}: ${cell}`)
          .join("; ");
        if (!body) return;
        const item: NormalizedProductUpdateItem = {
          itemKey: "",
          section: "Reference changes",
          changeKind: classifyProductUpdateChange("Reference changes", body),
          body,
          platforms: [],
          tags: ["reference-changes"],
          sourceOrder: items.length
        };
        item.itemKey = stableProductUpdateItemKey(item);
        items.push(item);
      });
  });
  return items;
}

function parseAssetTransformerDate(value: string) {
  let iso: string;
  let precision: "day" | "month";
  if (/^\d{4}-\d{2}$/.test(value)) {
    iso = `${value}-01`;
    precision = "month";
  } else {
    const match = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (!match) return null;
    iso = `${match[3]}-${match[1]}-${match[2]}`;
    precision = "day";
  }
  const date = new Date(`${iso}T00:00:00.000Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== iso
  ) {
    return null;
  }
  return { iso: date.toISOString(), precision };
}
