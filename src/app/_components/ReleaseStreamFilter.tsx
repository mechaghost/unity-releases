"use client";

import { useRef } from "react";
import { Icon } from "./Icon";

type StreamOption = {
  value: string;
  label: string;
};

const OPTIONS: StreamOption[] = [
  { value: "lts", label: "LTS" },
  { value: "update", label: "Supported" },
  { value: "beta", label: "Beta" },
  { value: "alpha", label: "Alpha" }
];

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
      {OPTIONS.map((option) => {
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
