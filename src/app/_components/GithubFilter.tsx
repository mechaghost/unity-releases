"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

type FacetOption = { value: string; label: string; count: number };

type Props = {
  q: string;
  language: string;
  sort: string;
  notableOnly: boolean;
  includeArchived: boolean;
  includeForks: boolean;
  languages: FacetOption[];
};

const SORTS: Array<{ value: string; label: string }> = [
  { value: "stars", label: "Most stars" },
  { value: "newest", label: "Newest" },
  { value: "updated", label: "Recently pushed" }
];

/**
 * Filter row for /github, mirroring the resources/discussions pattern: a
 * GET form that auto-submits on change, with the search box debounced so a
 * typing burst is one navigation. Archived repos and forks are hidden by
 * default; the toggles opt them back in.
 */
export function GithubFilter({
  q: initialQ,
  language,
  sort,
  notableOnly,
  includeArchived,
  includeForks,
  languages
}: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [q, setQ] = useState(initialQ);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (q === initialQ) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => formRef.current?.requestSubmit(), 300);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <form
      ref={formRef}
      className="filter-bar github-filter"
      method="get"
      action="/github"
      aria-label="Repository filter"
      onChange={(e) => {
        const target = e.target as HTMLElement;
        if (target instanceof HTMLInputElement && target.type === "search") return;
        formRef.current?.requestSubmit();
      }}
    >
      <input
        type="search"
        name="q"
        defaultValue={initialQ}
        placeholder="Search repos…"
        aria-label="Search repositories"
        className="github-filter__search"
        onChange={(e) => setQ(e.target.value)}
      />

      <label className="github-filter__select">
        <span>Language</span>
        <select name="lang" defaultValue={language} aria-label="Filter by language">
          <option value="">All languages</option>
          {languages.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label} ({l.count.toLocaleString()})
            </option>
          ))}
        </select>
      </label>

      <label className="github-filter__select">
        <span>Sort</span>
        <select name="sort" defaultValue={sort} aria-label="Sort repositories">
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>

      <Toggle name="notable" checked={notableOnly} label="Notable only" title="Hand-curated highlight repos" />
      <Toggle name="archived" checked={includeArchived} label="Archived" title="Include archived repos" />
      <Toggle name="forks" checked={includeForks} label="Forks" title="Include forked repos" />

      <button type="submit" className="visually-hidden">
        Apply repository filters
      </button>
    </form>
  );
}

function Toggle({ name, checked, label, title }: { name: string; checked: boolean; label: string; title: string }) {
  return (
    <label className="stream-checkbox-filter__option" data-checked={checked ? "true" : undefined} title={title}>
      <input type="checkbox" name={name} value="1" defaultChecked={checked} />
      {checked ? (
        <span className="stream-checkbox-filter__check" aria-hidden="true">
          <Icon name="check" size={12} />
        </span>
      ) : null}
      <span>{label}</span>
    </label>
  );
}
