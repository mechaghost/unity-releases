import { load } from "cheerio";
import { extractFlightStream, findFlightObject, parseFlightRows } from "../ingest/rsc-flight";

export const ISSUE_REPORT_PARSER_VERSION = "issue-report-v1";
const HOSTS = new Set(["issuetracker.unity.com", "issuetracker.unity3d.com"]);
export const normalizeIssueId = (id: string) => {
  const normalized = id.trim().toUpperCase();
  if (!/^(?:[A-Z][A-Z0-9]{1,12}-\d+|\d{4,12})$/.test(normalized)) throw new Error("Invalid issue ID");
  return normalized;
};
export function validatedTrackerUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || !HOSTS.has(url.hostname) || url.username || url.password || url.port) {
    throw new Error("Unsupported Issue Tracker URL");
  }
  url.hash = "";
  return url.href;
}
export const issueIdResolver = (id: string) => `https://issuetracker.unity.com/api/v1.0/redirects/guid/${encodeURIComponent(normalizeIssueId(id))}`;

export function trackerHtmlRedirect(html: string, baseUrl: string): string | null {
  const $ = load(html);
  const content = $('meta[http-equiv="refresh"]').attr("content");
  const match = content?.match(/^\s*\d+(?:\.\d+)?\s*;\s*url\s*=\s*["']?([^"']+)["']?\s*$/i);
  return match ? validatedTrackerUrl(new URL(match[1].trim(), baseUrl).href) : null;
}

export function trackerPageUnavailable(html: string, url: string): boolean {
  const $ = load(html);
  return new URL(url).pathname.replace(/\/$/, "") === "/not-found"
    && /^page not found$/i.test($("h1").text().trim());
}

export type ParsedIssueReport = { issueId: string; title: string; description: string; descriptionTruncated: boolean };
export function parseIssueReport(html: string, expectedId: string): ParsedIssueReport {
  const id = normalizeIssueId(expectedId);
  const $ = load(html);
  const identity = findFlightObject(parseFlightRows(extractFlightStream(html)), node => typeof node.issueExternalKey === "string");
  if (identity?.issueExternalKey !== id) throw new Error(`Issue identity missing or mismatched for ${id}`);
  if ($("h1").length !== 1 || $(".issue-description").length !== 1) throw new Error("Issue page structure changed");
  const title = $("h1").text().replace(/\s+/g, " ").trim();
  if (!title || title.length > 2048) throw new Error("Invalid issue title");
  const descriptionNode = $(".issue-description").clone();
  descriptionNode.find("script, style, nav, form, iframe").remove();
  descriptionNode.find("br").replaceWith(" ");
  descriptionNode.find("p, li, div, pre, h1, h2, h3").append(" ");
  const description = descriptionNode.text().replace(/\s+/g, " ").trim();
  // Bound stored report text and indexing work. Phrase windows separately handle
  // PostgreSQL's position limits. Context discloses any truncation.
  return { issueId: id, title, description: description.slice(0, 16000), descriptionTruncated: description.length > 16000 };
}
