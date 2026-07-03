import { HoverInfo } from "./HoverInfo";

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

const IMPACT_BLURBS: Record<string, string> = {
  fix: "Resolved bug or regression. Counted toward Fix density in the build score.",
  improvement: "Better behavior or performance for an existing feature — no API contract change.",
  feature: "Net-new capability. Not counted in the build score (feature volume ≠ stability).",
  change: "Behavior change that isn't strictly breaking — read if it touches your domain.",
  api_change: "Public API surface moved: renamed, signature changed, marked obsolete. Counts toward Breaking surface.",
  breaking_change: "Removed or incompatible API / behavior. Will require code changes on upgrade. Largest weight in Upgrade Risk.",
  package_change: "Bundled package version bumped — read its own changelog for downstream impact.",
  known_issue: "Outstanding bug Unity itself has flagged. Counts toward Live debt; sometimes Mobile risk too.",
  platform_risk: "Platform-specific regression (typically Android / iOS / consoles). Worth checking against your target list.",
  install_risk: "Affects Hub install / activation flow rather than runtime.",
  security_related_fix: "Security or vulnerability patch. Small positive weight in the build score.",
  upgrade_blocker: "Hard stop for the upgrade until resolved.",
  documentation: "Docs-only change. No code impact.",
  unknown: "Couldn't classify automatically — read the note text."
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
  const blurb = IMPACT_BLURBS[safe];
  // Native title = screen-reader / no-popover fallback for the definition.
  const chip = (
    <span className={`chip chip--impact-${safe}`} title={blurb}>
      {impactLabel(safe)}
    </span>
  );
  if (!blurb) return chip;
  return (
    <HoverInfo title={impactLabel(safe)} body={<p>{blurb}</p>}>
      {chip}
    </HoverInfo>
  );
}
