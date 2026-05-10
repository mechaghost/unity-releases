"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

type Props = {
  q: string;
  selectedTypes: string[];
  knownTypes: readonly string[];
  includeMarketing: boolean;
  includeEnterprise: boolean;
};

/**
 * Filter row for /resources, modelled after the /releases stream
 * filter (`ReleaseStreamFilter`): a single `.filter-bar` form that
 * auto-submits on change so checkbox toggles feel immediate. The
 * search box debounces 300ms so a typing burst produces one
 * navigation, not one per keystroke. No "Apply" button - the form
 * just submits whenever state changes.
 */
export function ResourcesFilter({
  q: initialQ,
  selectedTypes,
  knownTypes,
  includeMarketing,
  includeEnterprise
}: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [q, setQ] = useState(initialQ);
  const debounceRef = useRef<number | null>(null);

  // Debounced submit on text input. Triggered explicitly via setQ; the
  // form's `onChange` handler already covers checkbox flips immediately.
  useEffect(() => {
    if (q === initialQ) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      formRef.current?.requestSubmit();
    }, 300);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const selectedSet = new Set(selectedTypes);

  return (
    <form
      ref={formRef}
      className="filter-bar resources-filter"
      method="get"
      action="/resources"
      aria-label="Resource filter"
      onChange={(e) => {
        // Skip auto-submit for the text input - the debounced effect
        // above handles it; firing on every keystroke would thrash the
        // router.
        const target = e.target as HTMLElement;
        if (target instanceof HTMLInputElement && target.type === "search") return;
        formRef.current?.requestSubmit();
      }}
    >
      <input
        type="search"
        name="q"
        defaultValue={initialQ}
        placeholder="Search titles and summaries…"
        aria-label="Search resources"
        className="resources-filter__search"
        onChange={(e) => setQ(e.target.value)}
      />

      {knownTypes.map((name) => {
        const checked = selectedSet.has(name);
        return (
          <label
            key={name}
            className="stream-checkbox-filter__option"
            data-checked={checked ? "true" : undefined}
          >
            <input
              type="checkbox"
              name="type"
              value={name}
              defaultChecked={checked}
            />
            {checked ? (
              <span className="stream-checkbox-filter__check" aria-hidden="true">
                <Icon name="check" size={12} />
              </span>
            ) : null}
            <span>{name}</span>
          </label>
        );
      })}

      <span className="filter-bar__divider" aria-hidden="true" />

      <label
        className="stream-checkbox-filter__option"
        data-checked={includeMarketing ? "true" : undefined}
        title="Case studies, reports, whitepapers"
      >
        <input
          type="checkbox"
          name="marketing"
          value="1"
          defaultChecked={includeMarketing}
        />
        {includeMarketing ? (
          <span className="stream-checkbox-filter__check" aria-hidden="true">
            <Icon name="check" size={12} />
          </span>
        ) : null}
        <span>Marketing</span>
      </label>
      <label
        className="stream-checkbox-filter__option"
        data-checked={includeEnterprise ? "true" : undefined}
        title="Non-games industries - Automotive, Manufacturing, Retail, Multi"
      >
        <input
          type="checkbox"
          name="enterprise"
          value="1"
          defaultChecked={includeEnterprise}
        />
        {includeEnterprise ? (
          <span className="stream-checkbox-filter__check" aria-hidden="true">
            <Icon name="check" size={12} />
          </span>
        ) : null}
        <span>Enterprise</span>
      </label>

      <button type="submit" className="visually-hidden">
        Apply resource filters
      </button>
    </form>
  );
}
