"use client";

import { useRef } from "react";
import { RELEASE_FILTERS } from "@/lib/release-page-filter";
import { Icon } from "./Icon";

export function ReleaseStreamFilter({ selected }: { selected: string[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const selectedSet = new Set(selected);

  return (
    <form
      ref={formRef}
      className="filter-bar stream-checkbox-filter"
      method="get"
      action="/releases"
      aria-label="Stream filter"
      onChange={() => formRef.current?.requestSubmit()}
    >
      {RELEASE_FILTERS.map((option) => {
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
      <button type="submit" className="visually-hidden">
        Apply stream filters
      </button>
    </form>
  );
}
