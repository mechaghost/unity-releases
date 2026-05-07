"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  EMPTY_FILTERS,
  PIPELINE_LABELS,
  activeFilterCount,
  serializeFiltersToParams,
  type FilterState,
  type PipelineId,
  type SavedPreset
} from "@/lib/filters";
import { LANE_CATALOG, type LaneId } from "@/lib/lane-catalog";
import { FilterDrawer } from "./FilterDrawer";
import { Icon } from "./Icon";

type Props = {
  filters: FilterState;
  facets: {
    platforms: Array<{ value: string; count: number }>;
    packages: Array<{ value: string; count: number }>;
    areas: Array<{ value: string; count: number }>;
  };
  manifestPackages: readonly string[];
  savedPresets: SavedPreset[];
  preservedParams: Record<string, string>;
  basePath: string;
  view: "compare" | "release";
};

export function FilterBar({
  filters,
  facets,
  manifestPackages,
  savedPresets,
  preservedParams,
  basePath,
  view
}: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const count = activeFilterCount(filters);

  function pushState(next: FilterState) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(preservedParams)) if (v) params.set(k, v);
    serializeFiltersToParams(next, params);
    router.push(`${basePath}?${params.toString()}`);
  }

  function clearAll() {
    pushState({ ...EMPTY_FILTERS, preset: filters.preset });
  }

  return (
    <>
      <div className="filter-bar-row">
        <ChipRow filters={filters} onChange={pushState} onClearAll={clearAll} />
        <button
          type="button"
          className={`btn btn--secondary btn--small filter-trigger${count > 0 ? " filter-trigger--active" : ""}`}
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <Icon name="filter" size={14} />
          Filter
          {count > 0 ? <span className="filter-trigger__badge tabnums">{count}</span> : null}
        </button>
      </div>

      <FilterDrawer
        open={open}
        onClose={() => setOpen(false)}
        initial={filters}
        facets={facets}
        manifestPackages={manifestPackages}
        savedPresets={savedPresets}
        preservedParams={preservedParams}
        basePath={basePath}
        view={view}
      />
    </>
  );
}

// ─── chips ──────────────────────────────────────────────────────────────

function ChipRow({
  filters,
  onChange,
  onClearAll
}: {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  onClearAll: () => void;
}) {
  const chips: Array<{ key: string; label: string; remove: () => void }> = [];

  if (filters.q) {
    chips.push({
      key: "q",
      label: `Search: "${filters.q}"`,
      remove: () => onChange({ ...filters, q: "" })
    });
  }
  if (filters.issueId) {
    chips.push({
      key: "issue",
      label: `Issue: ${filters.issueId}`,
      remove: () => onChange({ ...filters, issueId: "" })
    });
  }
  for (const lane of filters.lanes) {
    chips.push({
      key: `lane:${lane}`,
      label: LANE_CATALOG[lane as LaneId]?.title ?? lane,
      remove: () => onChange({ ...filters, lanes: filters.lanes.filter((l) => l !== lane) })
    });
  }
  for (const risk of filters.risks) {
    chips.push({
      key: `risk:${risk}`,
      label: `Risk: ${capitalize(risk)}`,
      remove: () => onChange({ ...filters, risks: filters.risks.filter((r) => r !== risk) })
    });
  }
  for (const platform of filters.platforms) {
    chips.push({
      key: `platform:${platform}`,
      label: platform,
      remove: () => onChange({ ...filters, platforms: filters.platforms.filter((p) => p !== platform) })
    });
  }
  for (const pkg of filters.packages) {
    chips.push({
      key: `package:${pkg}`,
      label: pkg,
      remove: () => onChange({ ...filters, packages: filters.packages.filter((p) => p !== pkg) })
    });
  }
  for (const area of filters.areas) {
    chips.push({
      key: `area:${area}`,
      label: area,
      remove: () => onChange({ ...filters, areas: filters.areas.filter((a) => a !== area) })
    });
  }
  for (const pipeline of filters.pipelines) {
    chips.push({
      key: `pipeline:${pipeline}`,
      label: PIPELINE_LABELS[pipeline as PipelineId] ?? pipeline,
      remove: () =>
        onChange({ ...filters, pipelines: filters.pipelines.filter((p) => p !== pipeline) })
    });
  }
  if (filters.manifestOnly) {
    chips.push({
      key: "manifest",
      label: "My packages only",
      remove: () => onChange({ ...filters, manifestOnly: false })
    });
  }
  if (filters.hasTracker) {
    chips.push({
      key: "tracker",
      label: "Has tracker link",
      remove: () => onChange({ ...filters, hasTracker: false })
    });
  }
  if (filters.hideNoise) {
    chips.push({
      key: "hide_noise",
      label: "Hide noise",
      remove: () => onChange({ ...filters, hideNoise: false })
    });
  }

  if (chips.length === 0) return <span className="filter-chip-row__placeholder" />;

  return (
    <div className="filter-chip-row" aria-label="Active filters">
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          className="filter-active-chip"
          onClick={c.remove}
          aria-label={`Remove filter ${c.label}`}
        >
          {c.label}
          <Icon name="x" size={12} />
        </button>
      ))}
      <button type="button" className="filter-chip-row__clear" onClick={onClearAll}>
        Clear all
      </button>
    </div>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
