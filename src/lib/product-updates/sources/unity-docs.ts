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
  ProductUpdateAdapterManifest,
  ProductUpdateSnapshot
} from "../types";
import {
  classifyProductUpdateChange,
  directItemText,
  extractStructuredListItems
} from "./html";

export type VersionedUnityDocsConfig = {
  manifest: ProductUpdateAdapterManifest;
  rootHeading: RegExp;
  releaseHeading: RegExp;
  extractVersion(heading: string): string | null;
  extractReleaseDate?: (
    $: cheerio.CheerioAPI,
    releaseNodes: cheerio.Cheerio<AnyNode>
  ) => string | null;
  product: {
    key: string;
    slug: string;
    name: string;
    description: string;
    canonicalUrl: string;
    componentKey: string;
  };
  title(version: string): string;
  channel?: (version: string) => string | null;
};

export function createVersionedUnityDocsAdapter(
  config: VersionedUnityDocsConfig
): ProductUpdateAdapter {
  return {
    manifest: config.manifest,
    parse: (snapshot) => parseVersionedUnityDocs(snapshot, config)
  };
}

export function parseVersionedUnityDocs(
  snapshot: ProductUpdateSnapshot,
  config: VersionedUnityDocsConfig
): NormalizedProductUpdateObservation[] {
  const $ = cheerio.load(snapshot.text);
  const rootHeading = $("h1")
    .filter((_, heading) =>
      config.rootHeading.test(normalizeProductUpdateText($(heading).text()))
    )
    .last();
  if (rootHeading.length === 0) {
    throw new Error(`${config.manifest.displayName} root heading is missing`);
  }
  const root = rootHeading.parent();
  const observations: NormalizedProductUpdateObservation[] = [];

  root.children("h2").each((_, heading) => {
    const headingText = normalizeProductUpdateText($(heading).text());
    if (!config.releaseHeading.test(headingText)) return;
    const version = config.extractVersion(headingText);
    if (!version) {
      throw new Error(`${config.manifest.displayName} has an invalid version: ${headingText}`);
    }
    const releaseNodes = $(heading).nextUntil("h2");
    const items = extractUnityDocsItems($, releaseNodes, "Updates");
    const releaseDate = config.extractReleaseDate?.($, releaseNodes) ?? null;
    const channel = config.channel?.(version) ?? null;
    const anchor = $(heading).attr("id") || version;
    const overview = items.find((item) => /overview/i.test(item.section));

    observations.push({
      productKey: config.product.key,
      productSlug: config.product.slug,
      productName: config.product.name,
      productDescription: config.product.description,
      productCanonicalUrl: config.product.canonicalUrl,
      componentKey: config.product.componentKey,
      sourceUpdateKey: version.toLowerCase(),
      canonicalKey: `version:${version.toLowerCase()}`,
      updateSlug: version.toLowerCase(),
      version,
      channel,
      releaseDate,
      title: config.title(version),
      summary:
        overview?.body ??
        `${items.length.toLocaleString()} documented ${items.length === 1 ? "change" : "changes"}.`,
      sourceUrl: `${snapshot.finalUrl}#${anchor}`,
      metadata: releaseDate ? {} : { datePrecision: "unknown" },
      items
    });
  });

  if (observations.length === 0) {
    throw new Error(`${config.manifest.displayName} has no versioned release sections`);
  }
  return observations;
}

/**
 * Layout wrappers Unity's docs put between a version heading and its prose.
 * The site renders paragraphs as nested `<div class="MuiBox-root">` rather
 * than `<p>`, so walking direct siblings alone sees headings and nothing
 * else - which silently dropped most items on a page and made a release
 * whose notes are entirely prose look empty (see the no-changes handling in
 * the VPC adapter).
 */
const WRAPPER_TAGS = new Set(["div", "section", "article", "main"]);

/**
 * Children that mean a wrapper is a container of separate items rather than
 * one paragraph. Inline markup (span, code, a, strong) is deliberately absent:
 * descending into those splits a sentence into fragments, which is how a
 * paragraph reading "The upc-onboarding job now runs on AWS…" first came out
 * as the single token "`upc-onboarding`".
 */
const BLOCK_CHILD_SELECTOR = "h3,h4,h5,h6,ul,ol,p,div,section,article,main";

/** Guards against pathological nesting; real docs are a few levels deep. */
const MAX_WRAPPER_DEPTH = 8;

/** True when the element has non-whitespace text of its own (not a descendant's). */
function hasDirectText($: cheerio.CheerioAPI, node: cheerio.Cheerio<AnyNode>) {
  return node
    .contents()
    .toArray()
    .some((child) => child.type === "text" && $(child).text().trim().length > 0);
}

export function extractUnityDocsItems(
  $: cheerio.CheerioAPI,
  nodes: cheerio.Cheerio<AnyNode>,
  defaultSection: string
) {
  const items: NormalizedProductUpdateItem[] = [];
  let section = defaultSection;
  let detailHeading = "";

  const pushParagraph = (node: cheerio.Cheerio<AnyNode>) => {
    const text = directItemText($, node);
    if (!text || /^(none|screenshot)$/i.test(text)) return;
    const body =
      detailHeading && !text.toLowerCase().startsWith(detailHeading.toLowerCase())
        ? `${detailHeading}: ${text}`
        : text;
    const item: NormalizedProductUpdateItem = {
      itemKey: "",
      section,
      changeKind: classifyProductUpdateChange(`${section} ${detailHeading}`, body),
      body,
      platforms: detectUnityPlatforms(body),
      tags: [productUpdateSlug(section).slice(0, 80)].filter(Boolean),
      sourceOrder: items.length
    };
    item.itemKey = stableProductUpdateItemKey(item);
    items.push(item);
  };

  const visit = (candidates: cheerio.Cheerio<AnyNode>, depth: number) => {
    candidates.each((_, element) => {
      if (element.type !== "tag") return;
      const node = $(element);
      if (/^h[3-6]$/.test(element.tagName)) {
        const heading = normalizeProductUpdateText(node.text());
        if (element.tagName === "h3") {
          section = heading || defaultSection;
          detailHeading = "";
        } else {
          detailHeading = heading;
        }
        return;
      }
      if (element.tagName === "ul" || element.tagName === "ol") {
        const listSection = detailHeading || section;
        const extracted = extractStructuredListItems($, node, listSection);
        for (const extractedItem of extracted) {
          const item = {
            ...extractedItem,
            sourceOrder: items.length
          };
          item.itemKey = stableProductUpdateItemKey(item);
          items.push(item);
        }
        return;
      }
      if (element.tagName === "p" || element.tagName === "span") {
        pushParagraph(node);
        return;
      }
      if (WRAPPER_TAGS.has(element.tagName) && depth < MAX_WRAPPER_DEPTH) {
        // `role="note"` callouts carry publication metadata ("Note Public |
        // 2026-07-24") that `parsePublicIsoDate` reads for the release date.
        // Wrappers were skipped wholesale before, so leaving these out keeps
        // them out of the change list rather than adding a bogus first item.
        if (node.attr("role") === "note") return;
        // A wrapper carrying its own text IS the paragraph - recursing would
        // return only the nested fragment. Unity inlines code as a nested
        // <div><pre><code>, so "The upc-onboarding job now runs on AWS…"
        // is text nodes either side of a block child; descending yielded the
        // bare token "`upc-onboarding`" and dropped the sentence.
        if (!hasDirectText($, node) && node.children(BLOCK_CHILD_SELECTOR).length > 0) {
          const before = items.length;
          visit(node.children(), depth + 1);
          if (items.length > before) return;
        }
        pushParagraph(node);
      }
    });
  };

  visit(nodes, 0);

  return items;
}

export function parsePublicIsoDate(
  $: cheerio.CheerioAPI,
  releaseNodes: cheerio.Cheerio<AnyNode>
) {
  const value = normalizeProductUpdateText(
    releaseNodes.filter("div[role='note'],p,span").first().text()
  );
  const match = value.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (!match) return null;
  const date = new Date(`${match[1]}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function detectUnityPlatforms(body: string) {
  const platforms: string[] = [];
  if (/\bwindows\b/i.test(body)) platforms.push("Windows");
  if (/\b(mac|macos|os x)\b/i.test(body)) platforms.push("macOS");
  if (/\blinux\b/i.test(body)) platforms.push("Linux");
  if (/\bandroid\b/i.test(body)) platforms.push("Android");
  if (/\bios\b/i.test(body)) platforms.push("iOS");
  if (/\bwebgl\b/i.test(body)) platforms.push("WebGL");
  if (/\bplaystation\b/i.test(body)) platforms.push("PlayStation");
  if (/\bxbox\b/i.test(body)) platforms.push("Xbox");
  return platforms;
}
