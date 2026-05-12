"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

type ScopeKey = "all" | "manifest";
type ChannelKey = "all" | "stable" | "prerelease";

type Props = {
  q: string;
  scope: ScopeKey;
  channel: ChannelKey;
  sort: "name_asc" | "name_desc" | "updated_desc" | "updated_asc";
  manifestPackagesCount: number;
};

const CHANNEL_OPTIONS: { value: ChannelKey; label: string; title: string }[] = [
  { value: "all", label: "All channels", title: "Show stable and prerelease latest versions" },
  { value: "stable", label: "Stable", title: "Only packages whose latest version is a final/stable release" },
  { value: "prerelease", label: "Prerelease", title: "Only packages whose latest version is a prerelease (preview/exp/pre)" }
];

/**
 * Filter row for /packages, modelled after the /releases stream filter
 * (`ReleaseStreamFilter`): a single `.filter-bar` form that auto-
 * submits on change so chip toggles feel immediate, with the search
 * box debounced 300ms so a typing burst produces one navigation.
 *
 * Channel and Scope are now pill-checkboxes (matching every other
 * faceted page on the site). Sort stays a `<select>` because it's an
 * ordering, not a membership filter.
 */
export function PackagesFilter({ q: initialQ, scope, channel, sort, manifestPackagesCount }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [q, setQ] = useState(initialQ);
  const debounceRef = useRef<number | null>(null);

  // Debounce text-input submits. The form's `onChange` ignores the
  // search field and lets this effect drive its submission.
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

  return (
    <form
      ref={formRef}
      className="filter-bar packages-filter"
      method="get"
      action="/packages"
      aria-label="Package filter"
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
          defaultValue={initialQ}
          placeholder="Search packages..."
          onChange={(e) => setQ(e.target.value)}
        />
      </label>

      {/* Scope is a single binary toggle. The chip is checked when
          scope=manifest, unchecked when scope=all (default). Disabled
          if the user has no manifest packages set. */}
      <label
        className="stream-checkbox-filter__option"
        data-checked={scope === "manifest" ? "true" : undefined}
        data-disabled={manifestPackagesCount === 0 ? "true" : undefined}
        title="Only packages from your manifest.json"
      >
        <input
          type="checkbox"
          name="scope"
          value="manifest"
          defaultChecked={scope === "manifest"}
          disabled={manifestPackagesCount === 0}
        />
        {scope === "manifest" ? (
          <span className="stream-checkbox-filter__check" aria-hidden="true">
            <Icon name="check" size={12} />
          </span>
        ) : null}
        <span>
          My manifest
          {manifestPackagesCount > 0 ? ` · ${manifestPackagesCount}` : ""}
        </span>
      </label>

      <span className="filter-bar__divider" aria-hidden="true" />

      {/* Channel is a 3-state mutex (radio). Native <input type="radio">
          inside pill labels gives keyboard + screen-reader semantics for
          free; we render the matching chip with `data-checked`. */}
      {CHANNEL_OPTIONS.map((option) => {
        const checked = channel === option.value;
        return (
          <label
            key={option.value}
            className="stream-checkbox-filter__option"
            data-checked={checked ? "true" : undefined}
            title={option.title}
          >
            <input
              type="radio"
              name="channel"
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

      <label className="packages-filter__sort">
        <span>Sort</span>
        <select name="sort" defaultValue={sort} aria-label="Package sort order">
          <option value="updated_desc">Updated newest</option>
          <option value="updated_asc">Updated oldest</option>
          <option value="name_asc">Package A-Z</option>
          <option value="name_desc">Package Z-A</option>
        </select>
      </label>

      <button type="submit" className="visually-hidden">
        Apply package filters
      </button>
    </form>
  );
}
