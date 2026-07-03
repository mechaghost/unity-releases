import { HoverInfo } from "./HoverInfo";

export const RISK_LABELS: Record<string, string> = {
  blocker: "Blocker",
  caution: "Caution",
  review: "Review",
  info: "Info"
};

export function riskLabel(value?: string | null) {
  return RISK_LABELS[value ?? ""] ?? "Info";
}

const RISK_BLURBS: Record<string, { blurb: string; example: string }> = {
  blocker: {
    blurb:
      "Hard stop for the affected workflow — typically crash, data-loss, or platform certification risk. Read the note before upgrading.",
    example: "e.g. \"Editor crashes when opening a project with corrupted assets.\""
  },
  caution: {
    blurb:
      "Real but non-fatal: regression, performance hit, or platform-specific bug. Worth checking against your project's stack.",
    example: "e.g. \"Android: Vulkan rendering is slower than OpenGLES on Mali devices.\""
  },
  review: {
    blurb: "Worth reading but rarely a deal-breaker. Often an API-shape or behavior nuance.",
    example: "e.g. \"`Camera.targetTexture` now resets on disable.\""
  },
  info: {
    blurb: "Informational — no action needed beyond awareness.",
    example: "e.g. \"Improved tooltip rendering in the Animator window.\""
  }
};

// Risk levels we render as chips. "review" and "info" are skipped because
// they tell the reader nothing they can't infer from the impact pill - the
// noise was crowding the actionable rows.
const RENDERED_RISK_LEVELS = new Set(["blocker", "caution"]);

export function RiskBadge({ level }: { level: string | null | undefined }) {
  const safe = (level ?? "info").toLowerCase();
  if (!RENDERED_RISK_LEVELS.has(safe)) return null;
  const info = RISK_BLURBS[safe];
  // Native title carries the definition to screen readers and any
  // context where the HoverCard can't open - the popover remains the
  // rich pointer-user surface.
  const chip = (
    <span className={`chip chip--risk-${safe}`} title={info?.blurb}>
      {riskLabel(safe)}
    </span>
  );
  if (!info) return chip;
  return (
    <HoverInfo
      title={`Risk: ${riskLabel(safe)}`}
      body={
        <>
          <p>{info.blurb}</p>
          <p className="muted">{info.example}</p>
        </>
      }
    >
      {chip}
    </HoverInfo>
  );
}
