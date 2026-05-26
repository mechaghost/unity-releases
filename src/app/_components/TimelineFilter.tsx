"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "../_components/Icon";

type FilterKey = "all" | "content" | "system" | "failures";

type Props = {
  q: string;
  filter: FilterKey;
};

const FILTER_OPTIONS: { value: FilterKey; label: string; title: string }[] = [
  { value: "all", label: "All Activity", title: "Show all content updates and scraping runs" },
  { value: "content", label: "Data Updates", title: "Show only editor, package, and blog releases" },
  { value: "system", label: "Ingestion Runs", title: "Show all scraping job logs" },
  { value: "failures", label: "System Failures", title: "Show only failed scraping attempts" }
];

export function TimelineFilter({ q: initialQ, filter }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [q, setQ] = useState(initialQ);
  const debounceRef = useRef<number | null>(null);

  // Submit debounced text input
  useEffect(() => {
    if (q === initialQ) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      formRef.current?.requestSubmit();
    }, 300);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [q, initialQ]);

  return (
    <form
      ref={formRef}
      className="filter-bar packages-filter"
      method="get"
      action="/timeline"
      aria-label="Timeline filter"
      onChange={(e) => {
        const target = e.target as HTMLElement;
        if (target instanceof HTMLInputElement && target.type === "search") return;
        formRef.current?.requestSubmit();
      }}
    >
      <label className="packages-filter__search">
        <span>Search</span>
        <input
          type="search"
          name="q"
          value={q}
          placeholder="Filter timeline..."
          onChange={(e) => setQ(e.target.value)}
        />
      </label>

      <span className="filter-bar__divider" aria-hidden="true" />

      {FILTER_OPTIONS.map((option) => {
        const checked = filter === option.value;
        return (
          <label
            key={option.value}
            className="stream-checkbox-filter__option"
            data-checked={checked ? "true" : undefined}
            title={option.title}
          >
            <input
              type="radio"
              name="filter"
              value={option.value}
              defaultChecked={checked}
            />
            {checked ? (
              <span className="stream-checkbox-filter__check" aria-hidden="true">
                <Icon name="check" size={12} />
              </span>
            ) : null}
            <span>{option.label}</span>
          </label>
        );
      })}

      <button type="submit" className="visually-hidden">
        Apply filters
      </button>
    </form>
  );
}
