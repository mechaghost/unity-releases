export type IssueStatusMention = {
  version: string;
  section: string;
  release_date: string | null;
};

export type IssueStatus =
  | {
      kind: "resolved";
      version: string;
      releaseDate: string | null;
      additionalFixCount: number;
    }
  | {
      kind: "regressed";
      knownVersion: string;
      knownReleaseDate: string | null;
      lastFixedVersion: string;
      lastFixedReleaseDate: string | null;
    }
  | {
      kind: "open";
      version: string;
      releaseDate: string | null;
    }
  | {
      kind: "mentioned";
      version: string;
      section: string;
      releaseDate: string | null;
    }
  | { kind: "unknown" };

const FIX_SECTION = "Fixes";
const KNOWN_SECTION = "Known Issues";

export function deriveIssueStatus(mentions: IssueStatusMention[]): IssueStatus {
  if (mentions.length === 0) return { kind: "unknown" };

  const fixes = mentions.filter((m) => m.section === FIX_SECTION);
  const known = mentions.filter((m) => m.section === KNOWN_SECTION);

  const earliestFix = pickEarliest(fixes);
  const latestFix = pickLatest(fixes);
  const latestKnown = pickLatest(known);

  if (latestKnown && (!latestFix || isAfter(latestKnown, latestFix))) {
    if (latestFix) {
      return {
        kind: "regressed",
        knownVersion: latestKnown.version,
        knownReleaseDate: latestKnown.release_date,
        lastFixedVersion: latestFix.version,
        lastFixedReleaseDate: latestFix.release_date
      };
    }
    return {
      kind: "open",
      version: latestKnown.version,
      releaseDate: latestKnown.release_date
    };
  }

  if (earliestFix) {
    return {
      kind: "resolved",
      version: earliestFix.version,
      releaseDate: earliestFix.release_date,
      additionalFixCount: Math.max(0, fixes.length - 1)
    };
  }

  const newest = mentions[0];
  return {
    kind: "mentioned",
    version: newest.version,
    section: newest.section,
    releaseDate: newest.release_date
  };
}

export function issueStatusLabel(status: IssueStatus): string {
  switch (status.kind) {
    case "resolved":
      return `Fixed in ${status.version}`;
    case "regressed":
      return `Known issue in ${status.knownVersion}`;
    case "open":
      return `Known issue in ${status.version}`;
    case "mentioned":
      return `Listed in ${status.version}`;
    case "unknown":
      return "Unknown";
  }
}

/** Compact inline form for chip suffixes — no leading separator. */
export function issueStatusSuffix(status: IssueStatus): string | null {
  switch (status.kind) {
    case "resolved":
      return `fixed ${status.version}`;
    case "regressed":
      return `regressed ${status.knownVersion}`;
    case "open":
      return `open ${status.version}`;
    case "mentioned":
    case "unknown":
      return null;
  }
}

export function issueStatusTone(status: IssueStatus): "good" | "warn" | "info" {
  switch (status.kind) {
    case "resolved":
      return "good";
    case "regressed":
    case "open":
      return "warn";
    case "mentioned":
    case "unknown":
      return "info";
  }
}

function pickEarliest(rows: IssueStatusMention[]): IssueStatusMention | null {
  let best: IssueStatusMention | null = null;
  for (const row of rows) {
    if (!row.release_date) continue;
    if (!best || isBefore(row, best)) best = row;
  }
  return best ?? rows[0] ?? null;
}

function pickLatest(rows: IssueStatusMention[]): IssueStatusMention | null {
  let best: IssueStatusMention | null = null;
  for (const row of rows) {
    if (!best) {
      best = row;
      continue;
    }
    if (isAfter(row, best)) best = row;
  }
  return best;
}

function isAfter(a: IssueStatusMention, b: IssueStatusMention): boolean {
  if (a.release_date && b.release_date) return a.release_date > b.release_date;
  if (a.release_date && !b.release_date) return true;
  return false;
}

function isBefore(a: IssueStatusMention, b: IssueStatusMention): boolean {
  if (a.release_date && b.release_date) return a.release_date < b.release_date;
  if (a.release_date && !b.release_date) return true;
  return false;
}
