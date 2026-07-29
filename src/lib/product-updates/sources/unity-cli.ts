import * as cheerio from "cheerio";
import {
  normalizeProductUpdateText,
  stableProductUpdateItemKey
} from "../normalization";
import type {
  NormalizedProductUpdateObservation,
  ProductUpdateAdapter,
  ProductUpdateSnapshot
} from "../types";
import { extractStructuredListItems, parseUnityDate } from "./html";

const CLI_RELEASE_NOTES_URL =
  "https://docs.unity.com/en-us/unity-cli/release-notes";
const CLI_VERSION = /^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/i;

export const unityCliAdapter: ProductUpdateAdapter = {
  manifest: {
    sourceKey: "unity-cli",
    displayName: "Unity CLI release notes",
    family: "editor-tooling",
    parserVersion: "unity-cli-html-v1",
    displayPriority: 10,
    allowedEvidenceHosts: ["docs.unity.com"],
    cadenceHours: 12,
    timeoutMs: 30_000,
    maxResponseBytes: 2 * 1024 * 1024,
    minimumExpectedRecords: 1,
    maximumExpectedRecords: 100,
    maximumRecordDropFraction: 0.5,
    targets: [
      {
        targetKey: "standalone",
        url: CLI_RELEASE_NOTES_URL,
        allowedHosts: ["docs.unity.com"]
      }
    ]
  },
  parse: parseUnityCliReleaseNotes
};

export function parseUnityCliReleaseNotes(
  snapshot: ProductUpdateSnapshot
): NormalizedProductUpdateObservation[] {
  const $ = cheerio.load(snapshot.text);
  const rootHeading = $("h1")
    .filter((_, heading) =>
      /unity command-line interface.*release notes/i.test($(heading).text())
    )
    .first();
  if (rootHeading.length === 0) {
    throw new Error("Unity CLI release-notes root heading is missing");
  }
  const root = rootHeading.parent();
  const observations: NormalizedProductUpdateObservation[] = [];

  root.children("h3").each((_, heading) => {
    const version = normalizeProductUpdateText($(heading).text());
    if (!CLI_VERSION.test(version)) return;
    const dateHeading = $(heading).prevAll("h2").first();
    const dateText = normalizeProductUpdateText(dateHeading.text());
    const releaseDate = parseUnityDate(dateText);
    if (!releaseDate) {
      throw new Error(`Unity CLI ${version} has an invalid release date: ${dateText}`);
    }

    const releaseNodes = $(heading).nextUntil("h2,h3");
    const summaryNode = releaseNodes
      .filter("p,span")
      .filter((__, node) => normalizeProductUpdateText($(node).text()).length > 0)
      .first();
    const sourceSummary = normalizeProductUpdateText(summaryNode.text());
    const items = extractStructuredListItems(
      $,
      releaseNodes.filter("ul,ol"),
      "Updates"
    ).map((item) => ({
      ...item,
      itemKey: stableProductUpdateItemKey(item)
    }));
    const channel = version.toLowerCase().includes("beta") ? "beta" : "stable";

    observations.push({
      productKey: "unity-cli",
      productSlug: "unity-cli",
      productName: "Unity CLI",
      productDescription:
        "Standalone command-line workflows for Unity Editor, projects, builds, tests, licensing, and Unity Cloud.",
      productCanonicalUrl: "https://docs.unity.com/en-us/unity-cli",
      componentKey: "standalone",
      sourceUpdateKey: version.toLowerCase(),
      canonicalKey: `version:${version.toLowerCase()}`,
      updateSlug: version.toLowerCase(),
      version,
      channel,
      releaseDate,
      title: `Unity CLI ${version}`,
      summary:
        sourceSummary ||
        `${items.length.toLocaleString()} documented ${items.length === 1 ? "change" : "changes"}.`,
      sourceUrl: `${snapshot.finalUrl}#${version}`,
      metadata: { channel },
      items
    });
  });

  if (observations.length === 0) {
    throw new Error("Unity CLI parser found no versioned release sections");
  }
  return observations;
}
