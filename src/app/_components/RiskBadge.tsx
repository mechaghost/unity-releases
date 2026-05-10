export const RISK_LABELS: Record<string, string> = {
  blocker: "Blocker",
  caution: "Caution",
  review: "Review",
  info: "Info"
};

export function riskLabel(value?: string | null) {
  return RISK_LABELS[value ?? ""] ?? "Info";
}

// Risk levels we render as chips. "review" and "info" are skipped because
// they tell the reader nothing they can't infer from the impact pill - the
// noise was crowding the actionable rows.
const RENDERED_RISK_LEVELS = new Set(["blocker", "caution"]);

export function RiskBadge({ level }: { level: string | null | undefined }) {
  const safe = (level ?? "info").toLowerCase();
  if (!RENDERED_RISK_LEVELS.has(safe)) return null;
  return <span className={`chip chip--risk-${safe}`}>{riskLabel(safe)}</span>;
}
