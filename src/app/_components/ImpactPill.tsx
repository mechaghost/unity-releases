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

export function ImpactPill({ kind }: { kind: string | null | undefined }) {
  const safe = kind ?? "unknown";
  return <span className={`chip chip--impact-${safe}`}>{impactLabel(safe)}</span>;
}
