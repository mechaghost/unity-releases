import * as cheerio from "cheerio";
import { z } from "zod";
import { fetchProductUpdateTarget } from "../fetcher";
import { markdownToHtml } from "../markdown";
import { sha256 } from "../../ingest/hash";
import type { ProductUpdateAdapter, ProductUpdateSnapshot } from "../types";
import {
  createVersionedUnityDocsAdapter,
  parsePublicIsoDate
} from "./unity-docs";

const URL =
  "https://docs.unity.com/en-us/unity-version-control/release-notes/11";

const legacyAdapter = createVersionedUnityDocsAdapter({
  manifest: {
    sourceKey: "unity-version-control",
    displayName: "Unity Version Control 11.x release notes",
    family: "platform-services",
    parserVersion: "unity-version-control-years-v2",
    displayPriority: 10,
    allowedEvidenceHosts: ["docs.unity.com"],
    cadenceHours: 24,
    timeoutMs: 45_000,
    maxResponseBytes: 12 * 1024 * 1024,
    minimumExpectedRecords: 100,
    maximumExpectedRecords: 300,
    maximumRecordDropFraction: 0,
    targets: [
      {
        targetKey: "major-11",
        url: URL,
        allowedHosts: ["docs.unity.com"],
        documentFormat: "markdown"
      }
    ]
  },
  rootHeading: /^11\.x release notes$/i,
  releaseHeading: /^11\.\d+\.\d+\.\d+$/,
  extractVersion: (heading) => heading,
  extractReleaseDate: parsePublicIsoDate,
  product: {
    key: "unity-version-control",
    slug: "unity-version-control",
    name: "Unity Version Control",
    description:
      "Unity's version control system, desktop clients, Gluon, command-line tools, and cloud repositories.",
    canonicalUrl:
      "https://docs.unity.com/en-us/unity-version-control/release-notes/overview",
    componentKey: "major-11"
  },
  title: (version) => `Unity Version Control ${version}`
});

const documentSchema = z.object({ url: z.string().url(), text: z.string() });
const bundleSchema = z.object({
  format: z.literal("unity-version-control-years-v1"),
  index: documentSchema,
  years: z.array(documentSchema).min(1).max(32)
});

type Year = { year: string; url: string; count: number };

/** Only follow the year links in this source's verified index, never arbitrary links. */
function indexYears(text: string): Year[] {
  const $ = cheerio.load(markdownToHtml(text));
  const root = $("h1").filter((_, h) => $(h).text().trim() === "11.x release notes").last();
  if (!root.length) throw new Error("Unity Version Control index root heading is missing");
  const headings = root.nextAll("h2");
  if (headings.toArray().some(h => /^11\.\d+\.\d+\.\d+$/.test($(h).text().trim()))) {
    return []; // Prior single-page history; the existing parser still validates it.
  }
  const years: Year[] = [];
  headings.each((_, heading) => {
    const year = $(heading).text().trim();
    const links = $(heading).find("a");
    const url = new globalThis.URL(links.attr("href") ?? "", URL);
    const expected = `${URL}/${year}.md`;
    const countText = $(heading).nextUntil("h2").find("strong")
      .filter((_, strong) => $(strong).text().trim() === "Releases:")
      .parent().text().trim();
    const countMatch = /(?:^|\n)Releases:\s*(\d+)(?:\n|$)/.exec(countText);
    if (!/^20\d{2}$/.test(year) || links.length !== 1 || url.href !== expected || !countMatch) {
      throw new Error("Unity Version Control index has an invalid year link or release count");
    }
    years.push({ year, url: url.href.slice(0, -3), count: Number(countMatch[1]) });
  });
  if (!years.length || years.length > 32 || new Set(years.map(y => y.year)).size !== years.length) {
    throw new Error("Unity Version Control index has no valid unique year pages");
  }
  return years;
}

const fetchHistory: NonNullable<ProductUpdateAdapter["fetch"]> = async (target, state, options) => {
  // An unchanged index does not imply unchanged child pages. Fetch every document
  // without conditional validators, and publish only after the complete set parses.
  const fresh = { ...state, validatedEtag: null, validatedLastModified: null };
  const index = await fetchProductUpdateTarget(target, fresh, options);
  if (index.kind !== "content") throw new Error("Unity Version Control index returned no content");
  const years = indexYears(index.text);
  if (!years.length) return index;
  const documents: Array<{ url: string; text: string }> = [];
  let bytes = Buffer.byteLength(index.text);
  for (const year of years) {
    const page = await fetchProductUpdateTarget({ ...target, url: year.url }, fresh, options);
    if (page.kind !== "content" || page.finalUrl !== year.url) {
      throw new Error(`Unity Version Control year ${year.year} returned unexpected content`);
    }
    bytes += Buffer.byteLength(page.text);
    if (bytes > options.maxResponseBytes) throw new Error("Unity Version Control history exceeds response budget");
    documents.push({ url: page.finalUrl, text: page.text });
  }
  // Keep original Markdown for every page so a replay needs no network access.
  const text = JSON.stringify({ format: "unity-version-control-years-v1", index: { url: index.finalUrl, text: index.text }, years: documents });
  return { ...index, etag: null, lastModified: null, text, sha256: sha256(text) };
};

function parseRawSnapshot(snapshot: ProductUpdateSnapshot) {
  if (!snapshot.text.trimStart().startsWith("{")) {
    return legacyAdapter.parse({ ...snapshot, text: markdownToHtml(snapshot.text) });
  }
  const bundle = bundleSchema.parse(JSON.parse(snapshot.text));
  if (bundle.index.url !== URL) throw new Error("Unity Version Control snapshot has an unexpected index URL");
  const years = indexYears(bundle.index.text);
  if (years.length !== bundle.years.length) throw new Error("Unity Version Control snapshot is missing year pages");
  const observations = years.flatMap((year, i) => {
    const document = bundle.years[i];
    if (document.url !== year.url) throw new Error("Unity Version Control snapshot has an unexpected year URL");
    const $ = cheerio.load(markdownToHtml(document.text));
    const heading = $("h1").last();
    if (heading.text().trim() !== `11.x release notes for ${year.year}`) {
      throw new Error(`Unity Version Control year ${year.year} root heading is missing`);
    }
    heading.text("11.x release notes");
    const parsed = legacyAdapter.parse({ ...snapshot, finalUrl: document.url, text: $.html() });
    if (parsed.length !== year.count) throw new Error(`Unity Version Control year ${year.year} release count mismatch`);
    return parsed;
  });
  if (new Set(observations.map(o => o.sourceUpdateKey)).size !== observations.length) {
    throw new Error("Unity Version Control year pages contain duplicate releases");
  }
  return observations;
}

export const unityVersionControlAdapter: ProductUpdateAdapter = {
  ...legacyAdapter,
  fetch: fetchHistory,
  parseRawSnapshot
};
