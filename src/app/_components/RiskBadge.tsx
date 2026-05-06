export const RISK_LABELS: Record<string, string> = {
  blocker: "Blocker",
  caution: "Caution",
  review: "Review",
  info: "Info"
};

export function riskLabel(value?: string | null) {
  return RISK_LABELS[value ?? ""] ?? "Info";
}

export function RiskBadge({ level }: { level: string | null | undefined }) {
  const safe = (level ?? "info").toLowerCase();
  return <span className={`chip chip--risk-${safe}`}>{riskLabel(safe)}</span>;
}
