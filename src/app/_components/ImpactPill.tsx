export const IMPACT_LABELS: Record<string, string> = {
  fix: "Fix",
  improvement: "Improvement",
  feature: "Feature",
  change: "Change",
  api_change: "API change",
  breaking_change: "Breaking",
  package_change: "Package",
  known_issue: "Known issue",
  install_risk: "Install risk",
  platform_risk: "Platform risk",
  security_related_fix: "Security",
  upgrade_blocker: "Blocker",
  documentation: "Docs",
  unknown: "Unclassified"
};

export function impactLabel(value?: string | null) {
  return IMPACT_LABELS[value ?? ""] ?? titleize(value ?? "info");
}

function titleize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

// Impact kinds we hide from row chips - they're either too vague to act on
// or duplicate other signals on the row (the lane header already tells you
// it's an install risk in the install-risk lane, etc.).
const HIDDEN_IMPACT_KINDS = new Set(["install_risk"]);

export function ImpactPill({ kind }: { kind: string | null | undefined }) {
  const safe = kind ?? "unknown";
  if (HIDDEN_IMPACT_KINDS.has(safe)) return null;
  return <span className={`chip chip--impact-${safe}`}>{impactLabel(safe)}</span>;
}
