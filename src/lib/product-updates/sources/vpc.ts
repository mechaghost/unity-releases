import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import {
  normalizeProductUpdateText,
  productUpdateSlug
} from "../normalization";
import type {
  NormalizedProductUpdateObservation,
  ProductUpdateAdapter,
  ProductUpdateAdapterManifest,
  ProductUpdateSnapshot
} from "../types";
import { parseUnityDate } from "./html";
import { extractUnityDocsItems } from "./unity-docs";

type SelfHostedConfig = {
  manifest: ProductUpdateAdapterManifest;
  rootHeading: RegExp;
  product: {
    componentKey: "aws" | "on-premises";
    componentName: string;
    canonicalUrl: string;
  };
};

export const vpcAwsAdapter = createSelfHostedAdapter({
  manifest: {
    sourceKey: "vpc-aws",
    displayName: "Unity Cloud Self-Hosted AWS release notes",
    family: "industry-enterprise",
    parserVersion: "vpc-aws-html-v1",
    displayPriority: 10,
    allowedEvidenceHosts: ["docs.unity.com"],
    cadenceHours: 7 * 24,
    timeoutMs: 30_000,
    maxResponseBytes: 2 * 1024 * 1024,
    minimumExpectedRecords: 10,
    maximumExpectedRecords: 100,
    maximumRecordDropFraction: 0.5,
    targets: [
      {
        targetKey: "aws",
        url: "https://docs.unity.com/en-us/cloud/virtual-private-cloud/aws/release-notes",
        allowedHosts: ["docs.unity.com"]
      }
    ]
  },
  rootHeading:
    /^release notes for self-hosted deployment in amazon web services$/i,
  product: {
    componentKey: "aws",
    componentName: "AWS",
    canonicalUrl:
      "https://docs.unity.com/en-us/cloud/virtual-private-cloud/aws"
  }
});

export const vpcOnPremisesAdapter = createSelfHostedAdapter({
  manifest: {
    sourceKey: "vpc-on-premises",
    displayName: "Unity Cloud Self-Hosted on-premises release notes",
    family: "industry-enterprise",
    parserVersion: "vpc-on-premises-html-v1",
    displayPriority: 10,
    allowedEvidenceHosts: ["docs.unity.com"],
    cadenceHours: 7 * 24,
    timeoutMs: 30_000,
    maxResponseBytes: 2 * 1024 * 1024,
    minimumExpectedRecords: 10,
    maximumExpectedRecords: 100,
    maximumRecordDropFraction: 0.5,
    targets: [
      {
        targetKey: "on-premises",
        url: "https://docs.unity.com/en-us/cloud/virtual-private-cloud/on-premises/release-notes",
        allowedHosts: ["docs.unity.com"]
      }
    ]
  },
  rootHeading: /^release notes for self-hosted deployment on-premises$/i,
  product: {
    componentKey: "on-premises",
    componentName: "On-premises",
    canonicalUrl:
      "https://docs.unity.com/en-us/cloud/virtual-private-cloud/on-premises"
  }
});

export const vpctlAdapter: ProductUpdateAdapter = {
  manifest: {
    sourceKey: "vpctl",
    displayName: "vpctl changelog",
    family: "industry-enterprise",
    parserVersion: "vpctl-html-v1",
    displayPriority: 10,
    allowedEvidenceHosts: ["docs.unity.com"],
    cadenceHours: 7 * 24,
    timeoutMs: 30_000,
    maxResponseBytes: 2 * 1024 * 1024,
    minimumExpectedRecords: 8,
    maximumExpectedRecords: 100,
    maximumRecordDropFraction: 0.5,
    targets: [
      {
        targetKey: "cli",
        url: "https://docs.unity.com/en-us/cloud/virtual-private-cloud/vpctl/changelog",
        allowedHosts: ["docs.unity.com"]
      }
    ]
  },
  parse: parseVpctlChangelog
};

function createSelfHostedAdapter(config: SelfHostedConfig): ProductUpdateAdapter {
  return {
    manifest: config.manifest,
    parse: (snapshot) => parseSelfHostedReleaseNotes(snapshot, config)
  };
}

function parseSelfHostedReleaseNotes(
  snapshot: ProductUpdateSnapshot,
  config: SelfHostedConfig
): NormalizedProductUpdateObservation[] {
  const $ = cheerio.load(snapshot.text);
  const root = findRoot($, config.rootHeading, config.manifest.displayName);
  const observations: NormalizedProductUpdateObservation[] = [];
  root.children("h2").each((_, heading) => {
    const headingText = normalizeProductUpdateText($(heading).text());
    const match = headingText.match(
      /^version\s+([0-9][0-9A-Za-z.+-]*)\s+—\s+(.+)$/i
    );
    if (!match) return;
    const [, version, dateText] = match;
    const releaseDate = parseUnityDate(dateText);
    if (!releaseDate) {
      throw new Error(`${config.manifest.displayName} ${version} has an invalid date`);
    }
    const items = extractUnityDocsItems(
      $,
      $(heading).nextUntil("h2"),
      "Updates"
    );
    if (items.length === 0) {
      throw new Error(`${config.manifest.displayName} ${version} has no changes`);
    }
    observations.push({
      productKey: "unity-cloud-self-hosted",
      productSlug: "unity-cloud-self-hosted",
      productName: "Unity Cloud Self-Hosted",
      productDescription:
        "Self-hosted Unity Cloud deployment release notes, formerly Unity Virtual Private Cloud.",
      productCanonicalUrl:
        "https://docs.unity.com/en-us/cloud/virtual-private-cloud",
      componentKey: config.product.componentKey,
      sourceUpdateKey: version.toLowerCase(),
      canonicalKey: `version:${version.toLowerCase()}`,
      updateSlug: `${config.product.componentKey}-${version.toLowerCase()}`,
      version,
      channel: "production",
      releaseDate,
      title: `Unity Cloud Self-Hosted ${config.product.componentName} ${version}`,
      summary: `${items.length.toLocaleString()} documented ${items.length === 1 ? "change" : "changes"}.`,
      sourceUrl: `${snapshot.finalUrl}#${$(heading).attr("id") || productUpdateSlug(headingText)}`,
      metadata: { formerName: "Unity Virtual Private Cloud" },
      items
    });
  });
  if (observations.length === 0) {
    throw new Error(`${config.manifest.displayName} has no version sections`);
  }
  return observations;
}

export function parseVpctlChangelog(
  snapshot: ProductUpdateSnapshot
): NormalizedProductUpdateObservation[] {
  const $ = cheerio.load(snapshot.text);
  const root = findRoot($, /^changelog$/i, "vpctl changelog");
  const headings = root
    .children("h2")
    .filter((_, heading) =>
      /^\[[0-9][0-9A-Za-z.+-]*\](?:\s+-\s+\d{4}-\d{2}-\d{2})?$/.test(
        normalizeProductUpdateText($(heading).text())
      )
    )
    .toArray();

  const observations = headings.map((heading) => {
    const headingText = normalizeProductUpdateText($(heading).text());
    const match = headingText.match(
      /^\[([0-9][0-9A-Za-z.+-]*)\](?:\s+-\s+(\d{4}-\d{2}-\d{2}))?$/
    );
    if (!match) throw new Error(`vpctl has an invalid heading: ${headingText}`);
    const [, version, dateText] = match;
    const releaseNodes = collectUntilNextVersion($, heading);
    const items = extractUnityDocsItems($, releaseNodes, "Updates");
    if (items.length === 0) {
      throw new Error(`vpctl ${version} has no changes`);
    }
    const releaseDate = dateText ? parseIsoDate(dateText) : null;
    if (dateText && !releaseDate) {
      throw new Error(`vpctl ${version} has an invalid date`);
    }
    return {
      productKey: "vpctl",
      productSlug: "vpctl",
      productName: "vpctl",
      productDescription:
        "Command-line deployment and operations tooling for Unity Cloud Self-Hosted.",
      productCanonicalUrl:
        "https://docs.unity.com/en-us/cloud/virtual-private-cloud/vpctl",
      componentKey: "cli",
      sourceUpdateKey: version.toLowerCase(),
      canonicalKey: `version:${version.toLowerCase()}`,
      updateSlug: version.toLowerCase(),
      version,
      channel: "production",
      releaseDate,
      title: `vpctl ${version}`,
      summary: `${items.length.toLocaleString()} documented ${items.length === 1 ? "change" : "changes"}.`,
      sourceUrl: `${snapshot.finalUrl}#${$(heading).attr("id") || productUpdateSlug(headingText)}`,
      metadata: { datePrecision: releaseDate ? "day" : "unknown" },
      items
    };
  });

  if (observations.length === 0) {
    throw new Error("vpctl changelog has no version sections");
  }
  return observations;
}

function findRoot(
  $: cheerio.CheerioAPI,
  headingPattern: RegExp,
  displayName: string
) {
  const heading = $("h1")
    .filter((_, candidate) =>
      headingPattern.test(normalizeProductUpdateText($(candidate).text()))
    )
    .last();
  if (heading.length === 0) {
    throw new Error(`${displayName} root heading is missing`);
  }
  return heading.parent();
}

function collectUntilNextVersion(
  $: cheerio.CheerioAPI,
  heading: AnyNode
) {
  const nodes: AnyNode[] = [];
  let sibling = heading.nextSibling;
  while (sibling) {
    if (
      sibling.type === "tag" &&
      sibling.tagName === "h2" &&
      /^\[[0-9][0-9A-Za-z.+-]*\]/.test(
        normalizeProductUpdateText($(sibling).text())
      )
    ) {
      break;
    }
    nodes.push(sibling);
    sibling = sibling.nextSibling;
  }
  return $(nodes);
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
