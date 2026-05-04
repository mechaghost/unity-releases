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

export type ParsedReleaseNotes = {
  items: ReleaseNoteItem[];
  sections: ReleaseSection[];
};

type ParseReleaseNotesOptions = {
  version: string;
  sourceUrl: string;
};

const HEADING_RE = /^(#{3,4})\s+(.+)$/;
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

  return { items, sections };
}

type Block =
  | { type: "section"; title: string }
  | { type: "bullet"; body: string };

function splitIntoBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let bullet: string[] = [];

  const flushBullet = () => {
    if (bullet.length) {
      blocks.push({ type: "bullet", body: bullet.join("\n").replace(/^\s*-\s*/, "").trim() });
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

    if (/^\s*-\s+/.test(line)) {
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
