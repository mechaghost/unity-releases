import type { Cheerio, CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";
import {
  normalizeProductUpdateText,
  productUpdateSlug,
  stableProductUpdateItemKey
} from "../normalization";
import type { NormalizedProductUpdateItem } from "../types";

const MONTHS: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11
};

export function parseUnityDate(value: string) {
  const normalized = normalizeProductUpdateText(value);
  const match = normalized.match(
    /^([A-Za-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,\s+(\d{4})$/i
  );
  if (!match) return null;
  const month = MONTHS[match[1].toLowerCase()];
  if (month === undefined) return null;
  const day = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date.toISOString();
}

export function extractStructuredListItems(
  $: CheerioAPI,
  lists: Cheerio<AnyNode>,
  defaultSection: string
) {
  const items: NormalizedProductUpdateItem[] = [];
  let sourceOrder = 0;

  const visit = (list: Cheerio<AnyNode>, inheritedSection: string) => {
    list.children("li").each((_, element) => {
      const li = $(element);
      const nestedLists = li.children("ul,ol");
      const sectionLabel = directSectionLabel($, li);
      if (nestedLists.length > 0 && sectionLabel) {
        nestedLists.each((__, nested) => visit($(nested), sectionLabel));
        return;
      }

      const body = directItemText($, li);
      if (body) {
        const section = inheritedSection || defaultSection;
        const item: NormalizedProductUpdateItem = {
          itemKey: "",
          section,
          changeKind: classifyProductUpdateChange(section, body),
          body,
          platforms: detectPlatforms(body),
          tags: section
            ? [productUpdateSlug(section).slice(0, 80)].filter(Boolean)
            : [],
          sourceOrder
        };
        item.itemKey = stableProductUpdateItemKey(item);
        items.push(item);
        sourceOrder += 1;
      }
      nestedLists.each((__, nested) => visit($(nested), inheritedSection));
    });
  };

  lists.each((_, list) => visit($(list), defaultSection));
  return items;
}

export function directItemText($: CheerioAPI, element: Cheerio<AnyNode>) {
  const clone = element.clone();
  clone.children("ul,ol").remove();
  clone.find("br").replaceWith(" ");
  clone.find("code").each((_, code) => {
    const value = normalizeProductUpdateText($(code).text());
    $(code).replaceWith(` \`${value}\` `);
  });
  return normalizeProductUpdateText(clone.text());
}

function directSectionLabel($: CheerioAPI, element: Cheerio<AnyNode>) {
  const directStrong = element.children("strong").first();
  if (directStrong.length > 0) {
    return normalizeProductUpdateText(directStrong.text());
  }
  const wrappedStrong = element
    .children("span,p,div")
    .filter((_, child) => $(child).children("strong").length > 0)
    .first()
    .children("strong")
    .first();
  return wrappedStrong.length > 0
    ? normalizeProductUpdateText(wrappedStrong.text())
    : "";
}

export function classifyProductUpdateChange(section: string, body: string) {
  const value = `${section} ${body}`.toLowerCase();
  if (/\b(known issue|limitation)\b/.test(value)) return "known-issue";
  if (/\b(security|vulnerabilit)/.test(value)) return "security";
  if (/\b(deprecat)/.test(value)) return "deprecation";
  if (/\b(removed|removal)\b/.test(value)) return "removal";
  if (/\b(fixed|fixes|resolved|corrected)\b/.test(value)) return "fix";
  if (/\b(added|introduc|new feature|what'?s new)\b/.test(value)) return "feature";
  if (/\b(improved|updated|enhanced|performance)\b/.test(value)) {
    return "improvement";
  }
  return "change";
}

function detectPlatforms(body: string) {
  const platforms: string[] = [];
  if (/\bwindows\b/i.test(body)) platforms.push("Windows");
  if (/\b(mac|macos|os x)\b/i.test(body)) platforms.push("macOS");
  if (/\blinux\b/i.test(body)) platforms.push("Linux");
  if (/\bandroid\b/i.test(body)) platforms.push("Android");
  if (/\bios\b/i.test(body)) platforms.push("iOS");
  return platforms;
}
