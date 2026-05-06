export type ImpactKind =
  | "fix"
  | "improvement"
  | "feature"
  | "change"
  | "known_issue"
  | "api_change"
  | "breaking_change"
  | "package_change"
  | "platform_risk"
  | "install_risk"
  | "security_related_fix"
  | "upgrade_blocker"
  | "documentation"
  | "unknown";

export type RiskLevel = "info" | "review" | "caution" | "blocker";

const PLATFORM_TAGS = [
  "Android",
  "iOS",
  "WebGL",
  "Windows",
  "macOS",
  "Linux",
  "XR",
  "VisionOS",
  "tvOS",
  "Server"
];

const SECURITY_RE = /\b(vulnerability|security|cve|exploit|preventive)\b/i;

/**
 * Tight breaking-change detector. The previous regex
 *   /\b(breaking|removed|obsolete|deprecated|incompatible)\b/i
 * fired on any "removed an erroneous warning" / "obsolete marker dropped"
 * cosmetics, producing thousands of false positives that wrecked the
 * value of the breaking-change lane.
 *
 * The new rules require structural signals (literal "Breaking change(s)"
 * markers, leading "Removed:" / "Deprecated:" labels, or explicit
 * removal/incompatibility phrasing applied to APIs / types / classes /
 * methods / properties / packages / platforms) and exclude cosmetics
 * with a denylist.
 */
const BREAKING_INCLUDE_RE =
  /\bbreaking\s+change(?:s)?\b|\bno\s+longer\s+(?:supported|available|valid)\b|\b(?:incompatible|backwards?\s*[-\s]?incompatible|backward[-\s]?compat\w*\s+broken)\b|^\s*(?:removed|deprecated|obsoleted)\s*:|^\s*\*\*?(?:removed|deprecated|obsoleted|breaking)\b|\b(?:removed|deprecated|obsoleted|made\s+obsolete)\b/i;

const BREAKING_DENY_RE =
  /\b(?:removed?\s+(?:an?\s+|the\s+|some\s+|incorrect\s+|spurious\s+|bogus\s+|extra\s+|unnecessary\s+|misleading\s+|outdated\s+|obsolete\s+|erroneous\s+|stale\s+|stray\s+|leftover\s+|unused\s+|dead\s+|duplicate\s+|trailing\s+|leading\s+|verbose\s+|noisy\s+|broken\s+|debug\s+)+(?:warning|warnings|message|messages|log|logs|notice|notices|comment|comments|whitespace|space|spaces|line|lines|reference|references|test|tests|todo|todos|exception|exceptions|placeholder|placeholders|debug|deprecation|info|hint|tip)\b)|\b(?:cleanup|cleaning\s+up|removed\s+unused|removed\s+legacy\s+(?:debug|trace))\b/i;

const INSTALL_RE = /\b(installer|hub|module|build support|download|license|activation)\b/i;
const UNITY_VERSION_PREFIX_RE = /^\d{4}\.\d+\.\d+[abf]\d+$/i;
const BLOCKER_RE = /\b(crash|data loss|corrupt|cannot open)\b/i;

export function isBreakingChange(body: string): boolean {
  if (BREAKING_DENY_RE.test(body)) return false;
  return BREAKING_INCLUDE_RE.test(body);
}

export function extractArea(body: string): string | null {
  const match = body.match(/^([^:\n]{1,48}):\s+/);
  const area = match?.[1].trim();
  if (!area || UNITY_VERSION_PREFIX_RE.test(area) || !/[a-z]/i.test(area)) {
    return null;
  }
  return area;
}

export function stripAreaPrefix(body: string): string {
  return extractArea(body) ? body.replace(/^([^:\n]{1,48}):\s+/, "").trim() : body.trim();
}

export function extractPlatforms(body: string): string[] {
  const found = new Set<string>();
  for (const platform of PLATFORM_TAGS) {
    const escaped = platform.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escaped}\\b`, "i").test(body)) {
      found.add(platform);
    }
  }
  return [...found];
}

export function classifyImpact(section: string, body: string): ImpactKind {
  const normalizedSection = section.toLowerCase();

  if (normalizedSection === "known issues") {
    return "known_issue";
  }

  if (normalizedSection === "package changes" || normalizedSection === "packages updated") {
    return "package_change";
  }

  if (normalizedSection === "api changes") {
    return isBreakingChange(body) ? "breaking_change" : "api_change";
  }

  if (SECURITY_RE.test(body)) {
    return "security_related_fix";
  }

  if (INSTALL_RE.test(body)) {
    return "install_risk";
  }

  if (normalizedSection === "fixes") {
    return "fix";
  }

  if (normalizedSection === "documentation") {
    return "documentation";
  }

  if (normalizedSection === "improvements") {
    return "improvement";
  }

  if (normalizedSection === "features") {
    return "feature";
  }

  if (normalizedSection === "changes") {
    return isBreakingChange(body) ? "breaking_change" : "change";
  }

  return "unknown";
}

export function classifyRisk(section: string, impactKind: ImpactKind, body: string): RiskLevel {
  if (impactKind === "upgrade_blocker") {
    return "blocker";
  }

  if (impactKind === "known_issue") {
    return BLOCKER_RE.test(body) ? "blocker" : "caution";
  }

  if (impactKind === "platform_risk") {
    return BLOCKER_RE.test(body) ? "blocker" : "caution";
  }

  if (
    impactKind === "api_change" ||
    impactKind === "breaking_change" ||
    impactKind === "package_change" ||
    impactKind === "security_related_fix" ||
    impactKind === "install_risk"
  ) {
    return "review";
  }

  return "info";
}

export function riskReasons(section: string, impactKind: ImpactKind, platforms: string[]): string[] {
  const reasons = [`section:${section}`, `impact:${impactKind}`];
  for (const platform of platforms) {
    reasons.push(`platform:${platform}`);
  }
  return reasons;
}
