export type ImpactKind =
  | "fix"
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
const BREAKING_RE = /\b(breaking|removed|obsolete|deprecated|incompatible)\b/i;
const INSTALL_RE = /\b(installer|hub|module|build support|download|license|activation)\b/i;
const UNITY_VERSION_PREFIX_RE = /^\d{4}\.\d+\.\d+[abf]\d+$/i;
const BLOCKER_RE = /\b(crash|data loss|corrupt|cannot open)\b/i;

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
    return BREAKING_RE.test(body) ? "breaking_change" : "api_change";
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
