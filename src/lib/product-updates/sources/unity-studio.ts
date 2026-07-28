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
import {
  classifyProductUpdateChange,
  directItemText,
  extractStructuredListItems
} from "./html";

const STUDIO_BASE_URL = "https://docs.unity.com";
const STUDIO_WHATS_NEW_URL =
  "https://docs.unity.com/en-us/unity-studio/whats-new";

/**
 * Release-detail pages visible in the Unity Studio index on 2026-07-28.
 * The index remains a target so a new release is visible immediately, while
 * detail URLs are promoted here only after their document shape is reviewed.
 */
export const UNITY_STUDIO_RELEASE_TARGETS = [
  ["1-1", "/en-us/unity-studio/whats-new/studio-1-1"],
  ["1-0", "/en-us/unity-studio/whats-new/studio-1-0"],
  ["0-49", "/en-us/unity-studio/whats-new/studio-049"],
  ["0-48", "/en-us/unity-studio/whats-new/studio-048"],
  ["0-47", "/en-us/unity-studio/whats-new/studio-047"],
  ["0-46", "/en-us/unity-studio/whats-new/studio-046"],
  ["0-45", "/en-us/unity-studio/whats-new/studio-045"],
  ["0-44", "/en-us/unity-studio/whats-new/studio-044"],
  ["0-43", "/en-us/unity-studio/whats-new/studio-043"],
  ["0-41", "/en-us/unity-studio/whats-new/studio-041"],
  ["0-40", "/en-us/unity-studio/whats-new/studio-040"],
  ["0-39", "/en-us/unity-studio/whats-new/studio-039"],
  ["0-38", "/en-us/unity-studio/whats-new/studio-038"]
] as const;

export const unityStudioAdapter: ProductUpdateAdapter = {
  manifest: {
    sourceKey: "unity-studio",
    displayName: "Unity Studio what's new",
    family: "industry-enterprise",
    parserVersion: "unity-studio-html-v1",
    displayPriority: 10,
    cadenceHours: 24,
    timeoutMs: 30_000,
    maxResponseBytes: 1024 * 1024,
    minimumExpectedRecords: 1,
    maximumExpectedRecords: 50,
    maximumRecordDropFraction: 0.75,
    targets: [
      {
        targetKey: "index",
        url: STUDIO_WHATS_NEW_URL,
        allowedHosts: ["docs.unity.com"]
      },
      ...UNITY_STUDIO_RELEASE_TARGETS.map(([targetKey, path]) => ({
        targetKey,
        url: `${STUDIO_BASE_URL}${path}`,
        allowedHosts: ["docs.unity.com"] as const
      }))
    ]
  },
  parse: parseUnityStudioUpdates
};

export function parseUnityStudioUpdates(
  snapshot: ProductUpdateSnapshot
): NormalizedProductUpdateObservation[] {
  return snapshot.targetKey === "index"
    ? parseUnityStudioIndex(snapshot)
    : parseUnityStudioRelease(snapshot);
}

function parseUnityStudioIndex(
  snapshot: ProductUpdateSnapshot
): NormalizedProductUpdateObservation[] {
  const $ = cheerio.load(snapshot.text);
  const root = findRoot($, /^what's new in unity studio$/i);
  const observations: NormalizedProductUpdateObservation[] = [];

  root.find("a[href*='/unity-studio/whats-new/studio-']").each((_, link) => {
    const text = normalizeProductUpdateText($(link).text());
    const match = text.match(/^version\s+(\d+(?:\.\d+)+)(.*)$/i);
    if (!match) return;
    const version = match[1];
    const summary =
      normalizeProductUpdateText(match[2]) ||
      `New features and bug fixes for Unity Studio ${version}.`;
    const href = $(link).attr("href");
    if (!href) throw new Error(`Unity Studio ${version} index link is missing`);
    const item = makeStudioItem("Release summary", summary, 0);
    observations.push(studioObservation(snapshot, version, summary, [item], href));
  });

  if (observations.length === 0) {
    throw new Error("Unity Studio index has no version links");
  }
  return observations;
}

function parseUnityStudioRelease(
  snapshot: ProductUpdateSnapshot
): NormalizedProductUpdateObservation[] {
  const $ = cheerio.load(snapshot.text);
  const root = findRoot(
    $,
    /^what's new in unity studio(?:\s+-\s+version)?\s+\d+(?:\.\d+)+$/i
  );
  const heading = normalizeProductUpdateText(root.children("h1").text());
  const version = heading.match(/(\d+(?:\.\d+)+)$/)?.[1];
  if (!version) throw new Error("Unity Studio release version is missing");

  const items = extractStudioItems($, root.children("h2,h3,h4,span,p,ul,ol"));
  if (items.length === 0) {
    throw new Error(`Unity Studio ${version} has no documented changes`);
  }
  const summary = `${items.length.toLocaleString()} documented ${items.length === 1 ? "change" : "changes"}.`;
  return [studioObservation(snapshot, version, summary, items, snapshot.finalUrl)];
}

function findRoot($: cheerio.CheerioAPI, headingPattern: RegExp) {
  const heading = $("h1")
    .filter((_, candidate) =>
      headingPattern.test(normalizeProductUpdateText($(candidate).text()))
    )
    .last();
  if (heading.length === 0) {
    throw new Error("Unity Studio what's-new root heading is missing");
  }
  return heading.parent();
}

function extractStudioItems(
  $: cheerio.CheerioAPI,
  nodes: cheerio.Cheerio<AnyNode>
) {
  const items: NormalizedProductUpdateItem[] = [];
  let section = "Updates";
  let detailHeading = "";

  nodes.each((_, element) => {
    if (element.type !== "tag") return;
    const node = $(element);
    if (element.tagName === "h2") {
      section = normalizeProductUpdateText(node.text()) || "Updates";
      detailHeading = "";
      return;
    }
    if (element.tagName === "h3" || element.tagName === "h4") {
      detailHeading = normalizeProductUpdateText(node.text());
      return;
    }
    if (element.tagName === "ul" || element.tagName === "ol") {
      for (const extracted of extractStructuredListItems(
        $,
        node,
        detailHeading || section
      )) {
        const item = {
          ...extracted,
          section,
          body:
            detailHeading &&
            !extracted.body.toLowerCase().startsWith(detailHeading.toLowerCase())
              ? `${detailHeading}: ${extracted.body}`
              : extracted.body,
          sourceOrder: items.length
        };
        item.itemKey = stableProductUpdateItemKey(item);
        items.push(item);
      }
      return;
    }
    if (element.tagName !== "span" && element.tagName !== "p") return;
    const body = directItemText($, node);
    if (!body || /^the following\b/i.test(body)) return;
    items.push(makeStudioItem(section, body, items.length));
  });
  return items;
}

function makeStudioItem(
  section: string,
  body: string,
  sourceOrder: number
): NormalizedProductUpdateItem {
  const item: NormalizedProductUpdateItem = {
    itemKey: "",
    section,
    changeKind: classifyProductUpdateChange(section, body),
    body,
    platforms: ["Web"],
    tags: [productUpdateSlug(section)].filter(Boolean),
    sourceOrder
  };
  item.itemKey = stableProductUpdateItemKey(item);
  return item;
}

function studioObservation(
  snapshot: ProductUpdateSnapshot,
  version: string,
  summary: string,
  items: NormalizedProductUpdateItem[],
  sourcePath: string
): NormalizedProductUpdateObservation {
  const sourceUrl = new URL(sourcePath, STUDIO_BASE_URL).toString();
  return {
    productKey: "unity-studio",
    productSlug: "unity-studio",
    productName: "Unity Studio",
    productDescription:
      "Unity's browser-based collaborative authoring environment.",
    productCanonicalUrl: "https://docs.unity.com/en-us/unity-studio",
    componentKey: "web",
    sourceUpdateKey: version.toLowerCase(),
    canonicalKey: `version:${version.toLowerCase()}`,
    updateSlug: version.toLowerCase(),
    version,
    channel: "production",
    releaseDate: null,
    title: `Unity Studio ${version}`,
    summary,
    sourceUrl,
    metadata: {
      datePrecision: "unknown",
      evidence: snapshot.targetKey === "index" ? "index" : "release-detail"
    },
    items
  };
}
