"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode
} from "react";

export type LaneVariant = "blocker" | "caution" | "review" | "info" | "success";

export type LaneSummary = {
  id: string;
  title: string;
  count: number;
  variant: LaneVariant;
};

type LaneCollapseValue = {
  collapsed: ReadonlySet<string>;
  toggle: (id: string) => void;
  setCollapsed: (id: string, collapsed: boolean) => void;
};

const LaneCollapseContext = createContext<LaneCollapseValue | null>(null);

export function LaneCollapseProvider({
  initialCollapsed,
  children
}: {
  /** Lane ids that should start collapsed. Everything else is expanded. */
  initialCollapsed?: readonly string[];
  children: ReactNode;
}) {
  const [collapsed, setCollapsedState] = useState<Set<string>>(
    () => new Set(initialCollapsed ?? [])
  );

  const toggle = useCallback((id: string) => {
    setCollapsedState((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const setCollapsed = useCallback((id: string, value: boolean) => {
    setCollapsedState((prev) => {
      const next = new Set(prev);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ collapsed, toggle, setCollapsed }),
    [collapsed, toggle, setCollapsed]
  );

  return <LaneCollapseContext.Provider value={value}>{children}</LaneCollapseContext.Provider>;
}

function useLaneCollapse() {
  const ctx = useContext(LaneCollapseContext);
  if (!ctx) {
    throw new Error("useLaneCollapse must be used inside <LaneCollapseProvider>");
  }
  return ctx;
}

/**
 * The "neat boxes" panel. Each box is the title + count (anchor to the
 * lane section) plus a Hide/Show toggle that flips collapse state for
 * that lane only — no page reload.
 */
export function LaneSummaryPanel({
  lanes,
  label = "Review lanes"
}: {
  lanes: LaneSummary[];
  label?: string;
}) {
  const { collapsed, toggle, setCollapsed } = useLaneCollapse();
  if (lanes.length === 0) return null;

  const allCollapsed = lanes.every((l) => collapsed.has(l.id));
  const handleToggleAll = () => {
    for (const lane of lanes) {
      setCollapsed(lane.id, !allCollapsed);
    }
  };

  return (
    <section className="review-lanes">
      <header className="review-lanes__head">
        <span className="review-lanes__label">{label}</span>
        <button type="button" className="review-lanes__bulk" onClick={handleToggleAll}>
          {allCollapsed ? "Show all" : "Hide all"}
        </button>
      </header>
      <div className="review-lanes__grid">
        {lanes.map((lane) => {
          const isCollapsed = collapsed.has(lane.id);
          return (
            <div
              key={lane.id}
              className={`review-lane-card review-lane-card--${lane.variant}`}
              data-collapsed={isCollapsed ? "true" : undefined}
            >
              <a
                href={`#lane-${lane.id}`}
                className="review-lane-card__link"
                onClick={() => {
                  // Auto-expand on jump so the user actually sees content.
                  if (isCollapsed) setCollapsed(lane.id, false);
                }}
              >
                <span className="review-lane-card__title">{lane.title}</span>
                <strong className="review-lane-card__count tabnums">
                  {lane.count.toLocaleString()}
                </strong>
              </a>
              <button
                type="button"
                className="review-lane-card__toggle"
                aria-controls={`lane-${lane.id}`}
                aria-expanded={!isCollapsed}
                onClick={() => toggle(lane.id)}
              >
                {isCollapsed ? "Show" : "Hide"}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Wraps a lane section so its body collapses without re-rendering the
 * whole page. The whole header is the toggle — click anywhere on it to
 * hide/unhide the body. Title left, count right, no extra controls.
 */
export function LaneShell({
  id,
  variant,
  title,
  count,
  children
}: {
  id: string;
  variant: LaneVariant;
  title: string;
  count: number;
  children: ReactNode;
}) {
  const { collapsed, toggle } = useLaneCollapse();
  const isCollapsed = collapsed.has(id);
  return (
    <section
      className={`lane lane--${variant}`}
      id={`lane-${id}`}
      data-collapsed={isCollapsed ? "true" : undefined}
    >
      <button
        type="button"
        className="lane__header"
        aria-controls={`lane-${id}-body`}
        aria-expanded={!isCollapsed}
        onClick={() => toggle(id)}
      >
        <h3 className="lane__header-title">{title}</h3>
        <span className="lane__header-count tabnums">{count.toLocaleString()}</span>
      </button>
      <div className="lane__body" id={`lane-${id}-body`}>
        {children}
      </div>
    </section>
  );
}
