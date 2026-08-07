import { parseUnityVersion, type UnityStream } from "./version";
import {
  extractFlightStream,
  findFlightObject,
  parseFlightRows
} from "../ingest/rsc-flight";

export type ReleaseArtifact = {
  platform: string;
  architecture: string;
  category: string;
  name: string;
  url: string;
};

export type ReleaseModule = {
  platform: string;
  architecture: string;
  moduleName: string;
  moduleCategory: string;
  url: string;
};

export type ReleasePageMetadata = {
  version: string;
  releaseDate: string | null;
  stream: UnityStream;
  shortRevision: string | null;
  changeset: string | null;
  releasePageUrl: string;
  releaseNotesUrl: string | null;
  unityHubDeepLink: string | null;
  artifacts: ReleaseArtifact[];
  modules: ReleaseModule[];
};

/**
 * Preferred path: read the release document straight out of the parsed
 * Flight payload, the same way resources are read.
 *
 * The legacy path below regex-decodes the payload and then walks it with
 * a hand-rolled bracket matcher. That combination silently loses EVERY
 * artifact and module for a release if any value inside the downloads
 * array contains a double quote: `decodeEscapedPayload` rewrites the
 * value's `\\\"` into `\"`, `findMatchingBracket` then treats the
 * closing quote as escaped, never finds the array's end, and
 * `extractDownloads` swallows the failure and returns []. Demonstrated
 * by injecting a quote into a module name: 93 modules -> 0, no error.
 *
 * No current Unity module name or URL contains a quote, so the legacy
 * path happens to work today - but that is a property of Unity's naming
 * choices, not of the code. Parsing the payload removes the dependency.
 */
function extractViaFlight(html: string, releasePageUrl: string): ReleasePageMetadata | null {
  const rows = parseFlightRows(extractFlightStream(html));
  if (rows.size === 0) return null;
  const doc = findFlightObject(rows, (node) => Array.isArray(node.downloads));
  if (!doc) return null;

  const downloads = asArray(doc.downloads).map(asRecord);
  const rawVersion = typeof doc.version === "string" ? doc.version : null;
  const version = rawVersion ?? inferVersionFromUrl(releasePageUrl);
  let parsedVersion;
  try {
    parsedVersion = parseUnityVersion(version);
  } catch {
    return null; // not a release page we understand; let the caller fall back
  }

  const shortRevision = stringOrNull(doc.shortRevision);
  return {
    version,
    releaseDate: stringOrNull(doc.releaseDate),
    stream: parsedVersion.stream,
    shortRevision,
    changeset: shortRevision ?? extractString(html, /unityhub:\/\/[^/]+\/([a-f0-9]+)/),
    releasePageUrl,
    releaseNotesUrl: stringOrNull(asRecord(doc.releaseNotes).url),
    unityHubDeepLink: stringOrNull(doc.unityHubDeepLink),
    artifacts: downloads.map((download) => ({
      platform: stringField(download, "platform"),
      architecture: stringField(download, "architecture"),
      category: "EDITOR",
      name: "Unity Editor",
      url: stringField(download, "url")
    })),
    modules: downloads.flatMap((download) =>
      asArray(download.modules).map((module) => {
        const moduleRecord = asRecord(module);
        return {
          platform: stringField(download, "platform"),
          architecture: stringField(download, "architecture"),
          moduleName: stringField(moduleRecord, "name"),
          moduleCategory: stringField(moduleRecord, "category"),
          url: stringField(moduleRecord, "url")
        };
      })
    )
  };
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function extractReleasePageMetadata(html: string, releasePageUrl: string): ReleasePageMetadata {
  const viaFlight = extractViaFlight(html, releasePageUrl);
  if (viaFlight) return viaFlight;

  const decoded = decodeEscapedPayload(html);
  const version = extractString(decoded, /"version"\s*:\s*"([^"]+)"/) ?? inferVersionFromUrl(releasePageUrl);
  const parsedVersion = parseUnityVersion(version);
  const downloads = extractDownloads(decoded);

  return {
    version,
    releaseDate: extractString(decoded, /"releaseDate"\s*:\s*"([^"]+)"/),
    stream: parsedVersion.stream,
    shortRevision: extractString(decoded, /"shortRevision"\s*:\s*"([^"]+)"/),
    changeset:
      extractString(decoded, /"shortRevision"\s*:\s*"([^"]+)"/) ??
      extractString(decoded, /unityhub:\/\/[^/]+\/([a-f0-9]+)/),
    releasePageUrl,
    releaseNotesUrl: extractString(decoded, /"releaseNotes"\s*:\s*\{\s*"url"\s*:\s*"([^"]+)"/),
    unityHubDeepLink: extractString(decoded, /"unityHubDeepLink"\s*:\s*"([^"]+)"/),
    artifacts: downloads.map((download) => ({
      platform: stringField(download, "platform"),
      architecture: stringField(download, "architecture"),
      category: "EDITOR",
      name: "Unity Editor",
      url: stringField(download, "url")
    })),
    modules: downloads.flatMap((download) =>
      asArray(download.modules).map((module) => {
        const moduleRecord = asRecord(module);
        return {
          platform: stringField(download, "platform"),
          architecture: stringField(download, "architecture"),
          moduleName: stringField(moduleRecord, "name"),
          moduleCategory: stringField(moduleRecord, "category"),
          url: stringField(moduleRecord, "url")
        };
      })
    )
  };
}

function decodeEscapedPayload(html: string): string {
  return html.replace(/\\"/g, '"').replace(/\\\//g, "/");
}

function extractString(text: string, pattern: RegExp): string | null {
  return text.match(pattern)?.[1] ?? null;
}

function inferVersionFromUrl(url: string): string {
  const version = url.match(/(\d+\.\d+\.\d+[abfp]\d+)/)?.[1];
  if (!version) {
    throw new Error(`Unable to infer Unity version from ${url}`);
  }
  return version;
}

function extractDownloads(text: string): Array<Record<string, unknown>> {
  const index = text.indexOf('"downloads":[');
  if (index === -1) {
    return [];
  }

  const start = text.indexOf("[", index);
  const end = findMatchingBracket(text, start);
  if (start === -1 || end === -1) {
    return [];
  }

  try {
    return JSON.parse(text.slice(start, end + 1)) as Array<Record<string, unknown>>;
  } catch {
    return [];
  }
}

function findMatchingBracket(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (char === "[") {
      depth += 1;
    }
    if (char === "]") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  if (value == null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function stringField(record: Record<string, unknown>, field: string): string {
  const value = record[field];
  return typeof value === "string" ? value : "";
}
