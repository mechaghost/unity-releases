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

export function extractArea(body: string): string | null {
  const match = body.match(/^([^:\n]{1,48}):\s+/);
  return match?.[1].trim() || null;
}

export function stripAreaPrefix(body: string): string {
  return body.replace(/^([^:\n]{1,48}):\s+/, "").trim();
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
  if (section === "Known Issues") {
    return "known_issue";
  }

  if (section === "Package Changes") {
    return "package_change";
  }

  if (section === "API Changes") {
    return BREAKING_RE.test(body) ? "breaking_change" : "api_change";
  }

  if (SECURITY_RE.test(body)) {
    return "security_related_fix";
  }

  if (INSTALL_RE.test(body)) {
    return "install_risk";
  }

  if (section === "Fixes") {
    return "fix";
  }

  if (section === "Documentation") {
    return "documentation";
  }

  return "unknown";
}

export function classifyRisk(section: string, impactKind: ImpactKind, body: string): RiskLevel {
  if (impactKind === "upgrade_blocker" || /\b(crash|data loss|corrupt|cannot open)\b/i.test(body)) {
    return "blocker";
  }

  if (section === "Known Issues" || impactKind === "platform_risk") {
    return "caution";
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
