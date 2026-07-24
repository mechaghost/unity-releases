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
 * Wraps a lane section so its body collapses without re-rendering the
 * whole page. The whole header is the toggle - click anywhere on it to
 * hide/unhide the body. Title left, count right, no extra controls.
 */
export function LaneShell({
  id,
  variant,
  title,
  count,
  countDetail,
  children
}: {
  id: string;
  variant: LaneVariant;
  title: string;
  count: number;
  /**
   * Secondary count semantics when `count` isn't a plain row count -
   * e.g. "47 mentions" when the count is deduped unique issues. Without
   * it, a header "47" over a body of "9 unique issues" reads as broken.
   */
  countDetail?: string;
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
      {/* Disclosure pattern: the heading wraps the button (a heading
          inside a button is invalid HTML - buttons only allow phrasing
          content - and flattens the outline for screen readers). */}
      <h2 className="lane__heading">
        <button
          type="button"
          className="lane__header"
          aria-controls={`lane-${id}-body`}
          aria-expanded={!isCollapsed}
          onClick={() => toggle(id)}
        >
          <span className="lane__header-title">{title}</span>
          <span className="lane__header-count tabnums">
            {count.toLocaleString()}
            {countDetail ? (
              <span className="lane__header-count-detail">{countDetail}</span>
            ) : null}
          </span>
        </button>
      </h2>
      <div className="lane__body" id={`lane-${id}-body`}>
        {children}
      </div>
    </section>
  );
}
