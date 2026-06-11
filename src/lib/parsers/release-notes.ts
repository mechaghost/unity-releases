import {
  classifyImpact,
  classifyRisk,
  extractArea,
  extractPlatforms,
  riskReasons,
  stripAreaPrefix,
  type ImpactKind,
  type RiskLevel
} from "../classification";

export type IssueLink = {
  id: string;
  url: string;
};

export type ReleaseNoteItem = {
  version: string;
  section: string;
  area: string | null;
  platforms: string[];
  impactKind: ImpactKind;
  riskLevel: RiskLevel;
  riskReasons: string[];
  body: string;
  issueIds: string[];
  issueLinks: IssueLink[];
  packageNames: string[];
  sourceUrl: string;
  sourceOrder: number;
};

export type ReleaseSection = {
  section: string;
  body: string;
  parserConfidence: number;
  sourceOrder: number;
};

// A package version transition pulled from the editor notes' "Package
// changes" block (e.g. `- com.unity.render-pipelines.universal: [16.0.3]
// to [17.0.3]`). This is the Unity-6-accurate source of truth for the
// version a package ships bundled with a given Editor - the package
// registry can't tell us this once a package becomes Editor-bound.
export type PackageVersionChange = {
  packageName: string;
  fromVersion: string | null;
  toVersion: string | null;
  changeKind: "updated" | "added" | "removed";
};

export type ParsedReleaseNotes = {
  items: ReleaseNoteItem[];
  sections: ReleaseSection[];
  packageChanges: PackageVersionChange[];
};

type ParseReleaseNotesOptions = {
  version: string;
  sourceUrl: string;
};

const HEADING_RE = /^(#{3,4})\s+(.+)$/;
// Bold-only sub-headings — Unity uses these for sub-sections inside a
// "Packages updated" or "API changes" block, e.g.
//   `**Packages added**`
//   `**Packages deprecated**`
// They sit on their own line with no surrounding bullet syntax. Treat
// them as section-equivalent markers so the classifier can route the
// items beneath them (e.g. deprecated packages → breaking_change).
const BOLD_HEADING_RE = /^\s*\*\*([^*][^*\n]{0,60}?)\*\*\s*$/;
const ISSUE_LINK_RE = /\[(UUM-\d+)\]\((https?:\/\/[^)]+)\)/g;
const ISSUE_ID_RE = /\bUUM-\d+\b/g;
const PACKAGE_RE = /\bcom\.unity\.[a-z0-9.-]+\b/g;

export function parseReleaseNotes(
  markdown: string,
  options: ParseReleaseNotesOptions
): ParsedReleaseNotes {
  const blocks = splitIntoBlocks(markdown);
  const sections: ReleaseSection[] = [];
  const items: ReleaseNoteItem[] = [];
  // Keyed by `${packageName}|${changeKind}` so the duplicate "Packages
  // updated" blocks Unity sometimes emits in one notes file collapse to a
  // single change per package.
  const packageChanges = new Map<string, PackageVersionChange>();
  let currentSection: ReleaseSection | null = null;

  for (const block of blocks) {
    if (block.type === "section") {
      currentSection = {
        section: normalizeSectionName(block.title),
        body: "",
        parserConfidence: 1,
        sourceOrder: sections.length
      };
      sections.push(currentSection);
      continue;
    }

    if (!currentSection) {
      continue;
    }

    currentSection.body = [currentSection.body, block.body].filter(Boolean).join("\n\n");
    const body = block.body.trim();
    if (!body) {
      continue;
    }

    const changeKind = packageChangeKind(currentSection.section);
    if (changeKind) {
      const change = parsePackageChangeLine(body, changeKind);
      if (change) {
        packageChanges.set(`${change.packageName}|${change.changeKind}`, change);
      }
    }

    const issueLinks = extractIssueLinks(body);
    const issueIds = unique([
      ...issueLinks.map((link) => link.id),
      ...(body.match(ISSUE_ID_RE) ?? [])
    ]);
    const packageNames = unique(body.match(PACKAGE_RE) ?? []);
    const area = extractArea(body);
    const normalizedBody = stripAreaPrefix(body);
    const platforms = unique([
      ...extractPlatforms(body),
      ...(area && extractPlatforms(area).length ? [area] : [])
    ]);
    const impactKind = classifyImpact(currentSection.section, body);
    const riskLevel = classifyRisk(currentSection.section, impactKind, body);

    items.push({
      version: options.version,
      section: currentSection.section,
      area,
      platforms,
      impactKind,
      riskLevel,
      riskReasons: riskReasons(currentSection.section, impactKind, platforms),
      body: normalizedBody,
      issueIds,
      issueLinks,
      packageNames,
      sourceUrl: options.sourceUrl,
      sourceOrder: items.length
    });
  }

  return { items, sections, packageChanges: [...packageChanges.values()] };
}

// "Packages updated" / "Packages added" / "Packages deprecated" subsection
// headings under Unity's "Package changes" block. We only mine version
// pairs from these, so prose elsewhere ("Updated the Oculus XR Plugin to
// 4.1.2") can't produce false positives.
function packageChangeKind(section: string): PackageVersionChange["changeKind"] | null {
  if (/packages?\s+added/i.test(section)) return "added";
  if (/packages?\s+(removed|deprecated)/i.test(section)) return "removed";
  if (/packages?\s+updated/i.test(section)) return "updated";
  // Some notes put `- pkg: x to y` bullets directly under "Package changes
  // in <ver>" with no "Packages updated" subheading - treat those as updates.
  if (/package changes/i.test(section)) return "updated";
  return null;
}

const PACKAGE_CHANGE_ID_RE = /^(com\.unity\.[a-z0-9.-]+)\b/;

// Versions are the *link text* in `[1.2.4](https://docs...@1.2//...)` - the
// `@1.2` in the URL is truncated to major.minor, so we read the bracketed
// full version. Falls back to bare `@x.y.z` / `: x.y.z` / `to x.y.z` forms.
function packageVersionTokens(body: string): string[] {
  const linkVersions = [...body.matchAll(/\[(\d[0-9a-zA-Z.+-]*)\]\(/g)].map((m) => m[1]);
  if (linkVersions.length) return linkVersions;
  return [...body.matchAll(/(?:@|:\s*|to\s+)(\d+(?:\.\d+)+[0-9a-zA-Z.+-]*)/g)].map((m) => m[1]);
}

function parsePackageChangeLine(
  body: string,
  changeKind: PackageVersionChange["changeKind"]
): PackageVersionChange | null {
  const idMatch = body.match(PACKAGE_CHANGE_ID_RE);
  if (!idMatch) return null;
  const versions = packageVersionTokens(body);
  if (!versions.length) return null;
  const packageName = idMatch[1];

  if (changeKind === "removed") {
    return { packageName, fromVersion: versions[0], toVersion: null, changeKind };
  }
  if (changeKind === "added") {
    return { packageName, fromVersion: null, toVersion: versions[0], changeKind };
  }
  // updated: `[from] to [to]`; tolerate a single version (treat as the target).
  if (versions.length >= 2) {
    return {
      packageName,
      fromVersion: versions[0],
      toVersion: versions[versions.length - 1],
      changeKind
    };
  }
  return { packageName, fromVersion: null, toVersion: versions[0], changeKind };
}

type Block =
  | { type: "section"; title: string }
  | { type: "bullet"; body: string };

// Markdown bullets in Unity release notes use either `-` (Unity 6) or
// `*` (legacy 2019-2022 LTS). Match either so the parser yields the
// same shape regardless of major version.
const BULLET_PREFIX_RE = /^\s*[-*]\s+/;

function splitIntoBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let bullet: string[] = [];

  const flushBullet = () => {
    if (bullet.length) {
      blocks.push({ type: "bullet", body: bullet.join("\n").replace(/^\s*[-*]\s*/, "").trim() });
      bullet = [];
    }
  };

  for (const line of lines) {
    const heading = line.match(HEADING_RE);
    if (heading) {
      flushBullet();
      const normalized = normalizeHeading(heading[2]);
      if (normalized) {
        blocks.push({ type: "section", title: normalized });
      }
      continue;
    }

    // Bold-only sub-headings (`**Packages deprecated**`, etc.) emit a
    // section block too. We skip these when the bold text looks like
    // inline emphasis on a bullet — the regex requires the line to be
    // a bold token and nothing else.
    const boldHeading = line.match(BOLD_HEADING_RE);
    if (boldHeading && !BULLET_PREFIX_RE.test(line)) {
      flushBullet();
      const normalized = normalizeHeading(boldHeading[1]);
      if (normalized) {
        blocks.push({ type: "section", title: normalized });
      }
      continue;
    }

    if (BULLET_PREFIX_RE.test(line)) {
      flushBullet();
      bullet.push(line);
      continue;
    }

    if (bullet.length && (line.trim() === "" || /^\s{2,}\S/.test(line))) {
      bullet.push(line.trim());
    }
  }

  flushBullet();
  return blocks;
}

function normalizeHeading(title: string): string | null {
  const trimmed = title.trim();
  if (/^known issues/i.test(trimmed)) {
    return "Known Issues";
  }

  if (/package changes/i.test(trimmed)) {
    return "Package Changes";
  }

  if (/release notes/i.test(trimmed)) {
    return null;
  }

  return normalizeSectionName(trimmed);
}

function normalizeSectionName(title: string): string {
  if (/^api changes$/i.test(title)) {
    return "API Changes";
  }
  return title.replace(/\s+in\s+\d.+$/i, "").trim();
}

function extractIssueLinks(body: string): IssueLink[] {
  return [...body.matchAll(ISSUE_LINK_RE)].map((match) => ({
    id: match[1],
    url: match[2]
  }));
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
