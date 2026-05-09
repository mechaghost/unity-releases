"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  q: string;
  scope: "all" | "manifest";
  channel: "all" | "stable" | "prerelease";
  sort: "name_asc" | "name_desc" | "updated_desc" | "updated_asc";
  manifestPackagesCount: number;
};

/**
 * Filter row for /packages, modelled after the /releases stream filter
 * (`ReleaseStreamFilter`): a single `.filter-bar` form that auto-
 * submits on change so dropdown picks feel immediate, with the search
 * box debounced 300ms so a typing burst produces one navigation. No
 * "Apply" button — the form just submits whenever state changes.
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
      <label>
        <span>Search</span>
        <input
          type="search"
          name="q"
          defaultValue={initialQ}
          placeholder="Search packages..."
          onChange={(e) => setQ(e.target.value)}
        />
      </label>
      <label>
        <span>Scope</span>
        <select name="scope" defaultValue={scope} aria-label="Package scope">
          <option value="all">All packages</option>
          <option value="manifest" disabled={manifestPackagesCount === 0}>
            My manifest packages
            {manifestPackagesCount > 0 ? ` (${manifestPackagesCount})` : ""}
          </option>
        </select>
      </label>
      <label>
        <span>Channel</span>
        <select name="channel" defaultValue={channel} aria-label="Latest version channel">
          <option value="all">Stable + prerelease</option>
          <option value="stable">Stable latest</option>
          <option value="prerelease">Prerelease latest</option>
        </select>
      </label>
      <label>
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
