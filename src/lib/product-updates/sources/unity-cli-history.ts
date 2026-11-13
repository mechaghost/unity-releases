import * as cheerio from "cheerio";
import { z } from "zod";
import { sha256 } from "../../ingest/hash";
import { fetchProductUpdateTarget } from "../fetcher";
import { markdownToHtml } from "../markdown";
import type { ProductUpdateAdapter, ProductUpdateSnapshot } from "../types";
import { parseUnityCliReleaseNotes } from "./unity-cli";
import { parseUnityDate } from "./html";

const BASE = "https://docs.unity.com/en-us/unity-cli/release-notes";
const MONTHS = "january february march april may june july august september october november december".split(" ");
const document = z.object({ url: z.string().url(), text: z.string() });
const schema = z.object({ format: z.literal("unity-cli-months-v1"), index: document, years: z.array(document).min(1).max(32), months: z.array(document).min(1).max(384) });

function links(text: string, url: string, year?: string): string[] {
  const $ = cheerio.load(markdownToHtml(text));
  const title = $("h1").last().text().trim();
  if (!year && /^Unity command-line interface.*release notes$/i.test(title)) return [];
  const expected = year ? `Unity CLI release notes for ${year}` : "Unity CLI release notes";
  if (title !== expected) throw new Error("Unity CLI index root heading is missing");
  const result: string[] = [];
  $("h1").last().nextAll(year ? "h2" : undefined).find("a[href]").each((_, a) => {
    const href = $(a).attr("href")!;
    // Unity exports locale-less absolute paths for its localized documentation.
    const localized = href.startsWith("/unity-cli/") ? `/en-us${href}` : href;
    const destination = new URL(localized, url);
    if (!destination.pathname.includes("/release-notes/")) return;
    const human = destination.href.replace(/\.md$/, "");
    const suffix = human.slice(`${BASE}/`.length);
    const valid = year ? suffix.startsWith(`${year}/`) && MONTHS.includes(suffix.slice(5)) : /^20\d{2}$/.test(suffix);
    if (!human.startsWith(`${BASE}/`) || !valid) throw new Error("Unity CLI index has an invalid history link");
    if (!result.includes(human)) result.push(human);
  });
  if (!result.length || result.length > (year ? 12 : 32)) throw new Error("Unity CLI index has no valid history pages");
  return result;
}

export const fetchCliHistory: NonNullable<ProductUpdateAdapter["fetch"]> = async (target, state, options) => {
  const fresh = { ...state, validatedEtag: null, validatedLastModified: null };
  let bytes = 0;
  const deadline = Date.now() + options.timeoutMs;
  async function read(url: string) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("Unity CLI history exceeds time budget");
    const page = await fetchProductUpdateTarget({ ...target, url }, fresh, { ...options, retries: 0, timeoutMs: remaining });
    if (page.kind !== "content" || page.finalUrl !== url) throw new Error("Unity CLI history returned unexpected content");
    bytes += Buffer.byteLength(page.text);
    if (bytes > options.maxResponseBytes) throw new Error("Unity CLI history exceeds response budget");
    return page;
  }
  const index = await read(target.url);
  const yearUrls = links(index.text, index.finalUrl);
  if (!yearUrls.length) return index;
  const years: Array<{ url: string; text: string }> = [], months: typeof years = [];
  for (const url of yearUrls) {
    const year = await read(url);
    years.push({ url, text: year.text });
    for (const monthUrl of links(year.text, url, url.split("/").at(-1))) {
      const month = await read(monthUrl);
      months.push({ url: monthUrl, text: month.text });
    }
  }
  const text = JSON.stringify({ format: "unity-cli-months-v1", index: { url: index.finalUrl, text: index.text }, years, months });
  return { ...index, text, sha256: sha256(text), etag: null, lastModified: null };
};

export function parseCliHistory(snapshot: ProductUpdateSnapshot) {
  if (!snapshot.text.trimStart().startsWith("{")) return parseUnityCliReleaseNotes({ ...snapshot, text: markdownToHtml(snapshot.text) });
  const bundle = schema.parse(JSON.parse(snapshot.text));
  if (bundle.index.url !== BASE) throw new Error("Unity CLI snapshot has an unexpected index URL");
  const yearUrls = links(bundle.index.text, BASE);
  if (yearUrls.length !== bundle.years.length) throw new Error("Unity CLI snapshot is missing year pages");
  const monthUrls = yearUrls.flatMap((url, i) => {
    if (bundle.years[i].url !== url) throw new Error("Unity CLI snapshot has an unexpected year URL");
    return links(bundle.years[i].text, url, url.split("/").at(-1));
  });
  if (monthUrls.length !== bundle.months.length) throw new Error("Unity CLI snapshot is missing month pages");
  const expectedReleases = bundle.years.flatMap(page => {
    const $ = cheerio.load(markdownToHtml(page.text));
    return $("li").toArray().map(li => {
      const match = /^Version:\s*(\S+),\s*Release date:\s*(.+)$/.exec($(li).text().trim());
      const date = match && parseUnityDate(match[2]);
      if (!match || !date) throw new Error("Unity CLI year has an invalid release index entry");
      return `${match[1].toLowerCase()}:${date}`;
    });
  });
  if (!expectedReleases.length || new Set(expectedReleases).size !== expectedReleases.length) throw new Error("Unity CLI year has no unique releases");
  const rows = monthUrls.flatMap((url, i) => {
    const page = bundle.months[i];
    if (page.url !== url) throw new Error("Unity CLI snapshot has an unexpected month URL");
    const [year, month] = url.slice(`${BASE}/`.length).split("/");
    const $ = cheerio.load(markdownToHtml(page.text));
    const root = $("h1").last();
    if (root.text().trim().toLowerCase() !== `unity cli release notes for ${month} ${year}`) throw new Error("Unity CLI month root heading is missing");
    root.text("Unity command-line interface (CLI) release notes");
    root.nextAll("h2").each((_, h) => {
      const version = $(h).text().trim();
      if (!/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/i.test(version)) throw new Error("Unity CLI month has an invalid version heading");
      const dateNode = $(h).next();
      const match = /^Release date:\s*(.+)$/.exec(dateNode.text().trim());
      const date = match && parseUnityDate(match[1]);
      if (!date || date.slice(0, 4) !== year || Number(date.slice(5, 7)) !== MONTHS.indexOf(month) + 1) throw new Error("Unity CLI month has an invalid release date");
      $(h).before($("<h2>").text(match![1]));
      $(h).replaceWith($("<h3>").text(version));
      dateNode.remove();
    });
    const parsed = parseUnityCliReleaseNotes({ ...snapshot, finalUrl: url, text: $.html() });
    if (parsed.some(row => !row.items.length)) throw new Error("Unity CLI month has empty release notes");
    return parsed;
  });
  if (new Set(rows.map(row => row.sourceUpdateKey)).size !== rows.length) throw new Error("Unity CLI history has duplicate releases");
  const actual = rows.map(row => `${row.sourceUpdateKey}:${row.releaseDate}`).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expectedReleases.sort())) throw new Error("Unity CLI month releases do not match the year index");
  return rows;
}
