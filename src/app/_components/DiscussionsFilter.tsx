"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

type FacetOption = { value: string; label: string; count: number };

type Props = {
  q: string;
  categorySlug: string;
  author: string;
  sort: string;
  editedOnly: boolean;
  includeReplies: boolean;
  categories: FacetOption[];
  authors: FacetOption[];
};

const SORTS: Array<{ value: string; label: string }> = [
  { value: "recent", label: "Recently updated" },
  { value: "newest", label: "Newest posts" },
  { value: "edited", label: "Recently edited" },
  { value: "popular", label: "Most replies" }
];

/**
 * Filter row for /discussions, modelled on /resources' filter: a single
 * GET form that auto-submits on change so dropdown and checkbox flips feel
 * immediate. The search box debounces 300ms so a typing burst produces one
 * navigation rather than one per keystroke. Selecting a filter resets to
 * page 1 by virtue of the form not carrying a `page` field.
 */
export function DiscussionsFilter({
  q: initialQ,
  categorySlug,
  author,
  sort,
  editedOnly,
  includeReplies,
  categories,
  authors
}: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [q, setQ] = useState(initialQ);
  const debounceRef = useRef<number | null>(null);

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
      className="filter-bar discussions-filter"
      method="get"
      action="/discussions"
      aria-label="Discussion filter"
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
        placeholder="Search staff posts…"
        aria-label="Search staff posts"
        className="discussions-filter__search"
        onChange={(e) => setQ(e.target.value)}
      />

      <label className="discussions-filter__select">
        <span>Category</span>
        <select name="category" defaultValue={categorySlug} aria-label="Filter by category">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label} ({c.count.toLocaleString()})
            </option>
          ))}
        </select>
      </label>

      <label className="discussions-filter__select">
        <span>Author</span>
        <select name="author" defaultValue={author} aria-label="Filter by author">
          <option value="">All staff</option>
          {authors.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label} ({a.count.toLocaleString()})
            </option>
          ))}
        </select>
      </label>

      <label className="discussions-filter__select">
        <span>Sort</span>
        <select name="sort" defaultValue={sort} aria-label="Sort posts">
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>

      <label
        className="stream-checkbox-filter__option"
        data-checked={includeReplies ? "true" : undefined}
        title="Also show staff replies inside other people's threads (off = staff-started topics only: announcements, betas, releases)"
      >
        <input type="checkbox" name="replies" value="1" defaultChecked={includeReplies} />
        {includeReplies ? (
          <span className="stream-checkbox-filter__check" aria-hidden="true">
            <Icon name="check" size={12} />
          </span>
        ) : null}
        <span>Include replies</span>
      </label>

      <label
        className="stream-checkbox-filter__option"
        data-checked={editedOnly ? "true" : undefined}
        title="Only posts Unity staff later edited"
      >
        <input type="checkbox" name="edited" value="1" defaultChecked={editedOnly} />
        {editedOnly ? (
          <span className="stream-checkbox-filter__check" aria-hidden="true">
            <Icon name="check" size={12} />
          </span>
        ) : null}
        <span>Edited only</span>
      </label>

      <button type="submit" className="visually-hidden">
        Apply discussion filters
      </button>
    </form>
  );
}
