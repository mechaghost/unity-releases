"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ALL_LANE_IDS,
  EMPTY_FILTERS,
  PERSONA_PRESETS,
  PIPELINES,
  PIPELINE_LABELS,
  RISK_LEVELS,
  presetState,
  serializeFiltersToParams,
  type FilterState,
  type PersonaPreset,
  type PipelineId,
  type RiskLevel
} from "@/lib/filters";
import { LANE_CATALOG, type LaneId } from "@/lib/lane-catalog";
import { setPersonaPresetAction } from "../_actions/filter-prefs";
import { Icon } from "./Icon";

type FacetOption = { value: string; count: number };

type Props = {
  open: boolean;
  onClose: () => void;
  /** Read-only initial state, taken from the URL on the server. */
  initial: FilterState;
  /** Available facet values within the current view scope. */
  facets: { platforms: FacetOption[]; packages: FacetOption[]; areas: FacetOption[] };
  /** The user's saved manifest packages (for the "Affects my team" toggle). */
  manifestPackages: readonly string[];
  /** Static URL params that must be preserved on apply (from, to, p_<lane> …). */
  preservedParams: Record<string, string>;
  /** Page path the form should submit to. */
  basePath: string;
  /** Which view this drawer is on; used to scope the persona-preset cookie. */
  view: "compare" | "release";
};

export function FilterDrawer({
  open,
  onClose,
  initial,
  facets,
  manifestPackages,
  preservedParams,
  basePath,
  view
}: Props) {
  const [state, setState] = useState<FilterState>(initial);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const initialSerialized = useRef<string>(JSON.stringify(initial));

  // Reset internal state to whatever the server reported whenever the drawer
  // opens — guarantees the form mirrors the active URL state, not a stale
  // edit from a previous open.
  useEffect(() => {
    if (open) {
      setState(initial);
      initialSerialized.current = JSON.stringify(initial);
    }
  }, [open, initial]);

  // Body scroll lock while the surface is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Esc to close.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Auto-apply: any state change that diverges from the last-applied state
  // pushes a new URL after a 300ms debounce. The debounce keeps a typing
  // burst (search box, issue ID) from firing one navigation per keystroke
  // while still feeling immediate for checkboxes and chips.
  useEffect(() => {
    if (!open) return;
    const next = JSON.stringify(state);
    if (next === initialSerialized.current) return;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(preservedParams)) {
        if (v) params.set(k, v);
      }
      serializeFiltersToParams(state, params);
      initialSerialized.current = next;
      startTransition(() => {
        void setPersonaPresetAction(view, state.preset);
      });
      router.push(`${basePath}?${params.toString()}`);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [open, state, preservedParams, basePath, view, router, startTransition]);

  function applyPreset(preset: PersonaPreset) {
    setState(presetState(preset));
  }

  function reset() {
    setState({ ...EMPTY_FILTERS, preset: state.preset });
  }

  return (
    <div
      className="filter-surface"
      data-open={open ? "true" : undefined}
      aria-hidden={!open}
    >
      <button
        type="button"
        className="filter-surface__backdrop"
        aria-label="Close filters"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
      />
      <aside
        ref={dialogRef}
        className="filter-surface__panel"
        role="dialog"
        aria-modal="true"
        aria-label="Filter results"
      >
        <header className="filter-surface__head">
          <h2>Filter</h2>
          <button
            type="button"
            className="filter-surface__close"
            onClick={onClose}
            aria-label="Close"
          >
            <Icon name="x" size={18} />
          </button>
        </header>

        <div className="filter-surface__body">
          <PresetSection state={state} onPick={applyPreset} />

          <Section title="Search">
            <input
              type="search"
              className="filter-input"
              placeholder="memory leak, GC.Alloc, compute shader…"
              value={state.q}
              onChange={(e) => setState({ ...state, q: e.target.value })}
            />
          </Section>

          <Section title="Issue ID">
            <input
              type="text"
              className="filter-input"
              placeholder="UUM-12345"
              value={state.issueId}
              onChange={(e) =>
                setState({ ...state, issueId: e.target.value.toUpperCase() })
              }
              spellCheck={false}
              autoComplete="off"
            />
          </Section>

          <Section title="Lane">
            <CheckboxGrid
              options={ALL_LANE_IDS.map((id) => ({
                value: id,
                label: LANE_CATALOG[id].title
              }))}
              selected={state.lanes}
              onToggle={(value) =>
                setState({
                  ...state,
                  lanes: toggleListItem(state.lanes, value as LaneId)
                })
              }
            />
          </Section>

          <Section title="Risk">
            <CheckboxGrid
              options={RISK_LEVELS.map((r) => ({ value: r, label: capitalize(r) }))}
              selected={state.risks}
              onToggle={(value) =>
                setState({
                  ...state,
                  risks: toggleListItem(state.risks, value as RiskLevel)
                })
              }
            />
          </Section>

          <Section title="Render pipeline">
            <FacetChips
              options={PIPELINES.map((id) => ({
                value: id,
                count: 0,
                label: PIPELINE_LABELS[id]
              }))}
              selected={state.pipelines}
              onToggle={(value) =>
                setState({
                  ...state,
                  pipelines: toggleListItem(state.pipelines, value as PipelineId)
                })
              }
              hideZeroCount
            />
          </Section>

          {facets.areas.length > 0 ? (
            <Section title="Feature areas" hint={`${facets.areas.length} in scope`}>
              <FacetChips
                options={facets.areas.slice(0, 60)}
                selected={state.areas}
                onToggle={(value) =>
                  setState({ ...state, areas: toggleListItem(state.areas, value) })
                }
              />
              {facets.areas.length > 60 ? (
                <p className="filter-section__hint">
                  Showing top 60 of {facets.areas.length} areas — use Search above
                  to narrow.
                </p>
              ) : null}
            </Section>
          ) : null}

          {facets.platforms.length > 0 ? (
            <Section title="Platforms" hint={`${facets.platforms.length} in scope`}>
              <FacetChips
                options={facets.platforms}
                selected={state.platforms}
                onToggle={(value) =>
                  setState({
                    ...state,
                    platforms: toggleListItem(state.platforms, value)
                  })
                }
              />
            </Section>
          ) : null}

          <Section title="Packages" hint={`${facets.packages.length} in scope`}>
            <Toggle
              checked={state.manifestOnly}
              onChange={(checked) =>
                setState({ ...state, manifestOnly: checked })
              }
              label={`Affects my team (${manifestPackages.length} in manifest)`}
              disabled={manifestPackages.length === 0}
              disabledHint="Set your manifest from the sidebar to enable this."
            />
            <FacetChips
              options={facets.packages.slice(0, 50)}
              selected={state.packages}
              onToggle={(value) =>
                setState({
                  ...state,
                  packages: toggleListItem(state.packages, value)
                })
              }
            />
            {facets.packages.length > 50 ? (
              <p className="filter-section__hint">
                Showing top 50 of {facets.packages.length} packages — use Search above
                to narrow.
              </p>
            ) : null}
          </Section>

          <Section title="Other">
            <Toggle
              checked={state.hideNoise}
              onChange={(checked) => setState({ ...state, hideNoise: checked })}
              label="Hide noise (docs, untagged, other changes)"
            />
            <Toggle
              checked={state.hasTracker}
              onChange={(checked) => setState({ ...state, hasTracker: checked })}
              label="Has Issue Tracker link"
            />
          </Section>
        </div>

        <footer className="filter-surface__foot">
          <span className="filter-surface__foot-hint">Filters apply automatically.</span>
          <span className="filter-surface__foot-spacer" />
          <button type="button" className="btn btn--tertiary btn--small" onClick={reset}>
            Reset
          </button>
          <button type="button" className="btn btn--primary btn--small" onClick={onClose}>
            Done
          </button>
        </footer>
      </aside>
    </div>
  );
}

// ─── sub-components ──────────────────────────────────────────────────────

function PresetSection({
  state,
  onPick
}: {
  state: FilterState;
  onPick: (preset: PersonaPreset) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="filter-section filter-preset"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary>
        <span className="filter-section__title">Persona preset</span>
        <span className="filter-preset__active">{capitalize(state.preset)}</span>
      </summary>
      <div className="filter-preset__options">
        {PERSONA_PRESETS.map((p) => (
          <label key={p} className="filter-preset__option">
            <input
              type="radio"
              name="filter-preset"
              checked={state.preset === p}
              onChange={() => onPick(p)}
            />
            {capitalize(p)}
          </label>
        ))}
      </div>
      <p className="filter-section__hint">
        Picking a preset replaces every filter below with that preset's defaults.
      </p>
    </details>
  );
}

function Section({
  title,
  hint,
  children
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="filter-section">
      <header className="filter-section__head">
        <span className="filter-section__title">{title}</span>
        {hint ? <span className="filter-section__hint">{hint}</span> : null}
      </header>
      <div className="filter-section__body">{children}</div>
    </section>
  );
}

function CheckboxGrid({
  options,
  selected,
  onToggle
}: {
  options: Array<{ value: string; label: string }>;
  selected: readonly string[];
  onToggle: (value: string) => void;
}) {
  const sel = new Set(selected);
  return (
    <div className="filter-checkboxes">
      {options.map((opt) => (
        <label key={opt.value} className="filter-checkbox">
          <input
            type="checkbox"
            checked={sel.has(opt.value)}
            onChange={() => onToggle(opt.value)}
          />
          <span>{opt.label}</span>
        </label>
      ))}
    </div>
  );
}

function FacetChips({
  options,
  selected,
  onToggle,
  hideZeroCount
}: {
  options: Array<FacetOption & { label?: string }>;
  selected: readonly string[];
  onToggle: (value: string) => void;
  /** When true, omit the count badge on each chip (useful for derived
   *  facets like render-pipeline scope where the count isn't precomputed). */
  hideZeroCount?: boolean;
}) {
  const sel = new Set(selected);
  if (options.length === 0) {
    return <p className="filter-section__hint">No values in scope.</p>;
  }
  return (
    <div className="filter-facet-chips">
      {options.map((opt) => {
        const active = sel.has(opt.value);
        return (
          <button
            type="button"
            key={opt.value}
            className={`filter-facet-chip${active ? " filter-facet-chip--active" : ""}`}
            onClick={() => onToggle(opt.value)}
            aria-pressed={active}
          >
            {opt.label ?? opt.value}
            {!hideZeroCount ? (
              <span className="filter-facet-chip__count tabnums">
                {opt.count.toLocaleString()}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  disabled,
  disabledHint
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  disabledHint?: string;
}) {
  return (
    <label
      className={`filter-toggle${disabled ? " filter-toggle--disabled" : ""}`}
      title={disabled ? disabledHint : undefined}
    >
      <input
        type="checkbox"
        checked={checked && !disabled}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

function toggleListItem<T extends string>(list: readonly T[], value: T): T[] {
  const set = new Set(list);
  if (set.has(value)) set.delete(value);
  else set.add(value);
  return Array.from(set);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
