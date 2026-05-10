import type { LaneVariant } from "@/app/_components/ReviewLanes";

/**
 * Canonical metadata for the impact lanes used by both the diff view
 * (`/compare`) and the per-release view (`/releases/[version]`).
 *
 * Each page still owns its own data-fetch shape - compare drives SQL
 * filters and pagination, release-detail filters already-fetched rows
 * client-side - but the lane *identity* (title, color, default state,
 * which impact pill to show in the header) lives here so the two pages
 * can never drift apart.
 */

export const LANE_IDS = [
  "blockers",
  "breaking",
  "api",
  "known",
  "security",
  "package",
  "feature",
  "improvement",
  "fix",
  "change",
  "docs"
] as const;

export type LaneId = (typeof LANE_IDS)[number];

export type LaneCatalogEntry = {
  id: LaneId;
  title: string;
  variant: LaneVariant;
  impactPill: string;
  /** True if the lane should be expanded by default. */
  defaultOpen: boolean;
};

export const LANE_CATALOG: Record<LaneId, LaneCatalogEntry> = {
  blockers: {
    id: "blockers",
    title: "Active known blockers",
    variant: "blocker",
    impactPill: "known_issue",
    defaultOpen: true
  },
  breaking: {
    id: "breaking",
    title: "Breaking changes",
    variant: "blocker",
    impactPill: "breaking_change",
    defaultOpen: true
  },
  api: {
    id: "api",
    title: "API changes",
    variant: "review",
    impactPill: "api_change",
    defaultOpen: true
  },
  known: {
    id: "known",
    title: "Other known issues",
    variant: "caution",
    impactPill: "known_issue",
    defaultOpen: true
  },
  security: {
    id: "security",
    title: "Security & install impact",
    variant: "caution",
    impactPill: "security_related_fix",
    defaultOpen: true
  },
  package: {
    id: "package",
    title: "Package updates",
    variant: "review",
    impactPill: "package_change",
    defaultOpen: true
  },
  feature: {
    id: "feature",
    title: "New features",
    variant: "info",
    impactPill: "feature",
    defaultOpen: true
  },
  improvement: {
    id: "improvement",
    title: "Improvements",
    variant: "info",
    impactPill: "improvement",
    defaultOpen: true
  },
  fix: {
    id: "fix",
    title: "Fixes",
    variant: "success",
    impactPill: "fix",
    defaultOpen: true
  },
  change: {
    id: "change",
    title: "Other changes",
    variant: "info",
    impactPill: "change",
    defaultOpen: true
  },
  docs: {
    id: "docs",
    title: "Documentation",
    variant: "info",
    impactPill: "documentation",
    defaultOpen: false
  }
};

export function isLaneId(value: string): value is LaneId {
  return (LANE_IDS as readonly string[]).includes(value);
}
