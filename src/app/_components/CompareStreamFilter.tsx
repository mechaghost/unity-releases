"use client";

import { useRef } from "react";
import { useSearchParams } from "next/navigation";
import { ALL_STREAMS, type StreamName } from "@/lib/stream-filter";
import { Icon } from "./Icon";

const COMPARE_STREAM_OPTIONS: Array<{ value: StreamName; label: string }> = [
  { value: "LTS", label: "LTS" },
  { value: "Update/Supported", label: "Supported" },
  { value: "beta", label: "Beta" },
  { value: "alpha", label: "Alpha" }
];

type Props = {
  /** Currently selected streams, parsed from the URL. */
  selected: StreamName[];
};

/**
 * Checkbox row above the From/To picker on /compare. Mirrors the
 * /releases stream filter visually but renders a fixed four-bucket
 * taxonomy (LTS / Supported / Beta / Alpha) and submits via GET so the
 * URL stays the sole source of truth — bookmarks and shared links
 * always render the same scope.
 *
 * Hidden inputs preserve every other URL param except `stream`, so a
 * checkbox change keeps `from`, `to`, `platform`, lane pagination, and
 * any FilterBar params intact.
 */
export function CompareStreamFilter({ selected }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const search = useSearchParams();
  const selectedSet = new Set(selected as string[]);

  const preserved: Array<[string, string]> = [];
  if (search) {
    for (const [key, value] of search.entries()) {
      if (key === "stream") continue;
      preserved.push([key, value]);
    }
  }

  return (
    <form
      ref={formRef}
      className="filter-bar stream-checkbox-filter compare-stream-filter"
      method="get"
      action="/compare"
      aria-label="Stream scope"
      onChange={() => formRef.current?.requestSubmit()}
    >
      <span className="compare-stream-filter__label">Streams</span>
      {COMPARE_STREAM_OPTIONS.map((option) => {
        const checked = selectedSet.has(option.value);
        return (
          <label
            key={option.value}
            className="stream-checkbox-filter__option"
            data-checked={checked ? "true" : undefined}
          >
            <input
              type="checkbox"
              name="stream"
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
      {preserved.map(([key, value], i) => (
        <input key={`${key}-${i}`} type="hidden" name={key} value={value} />
      ))}
      <button type="submit" className="visually-hidden">
        Apply stream scope
      </button>
    </form>
  );
}

// Re-export so callers don't have to dual-import alongside the option list.
export { ALL_STREAMS };
