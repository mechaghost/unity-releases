import { Icon } from "@/app/_components/Icon";

/**
 * Simple server-side search input for /issues. Just an HTML form
 * submitting to `/issues?q=...` — no client JS, no live filtering.
 * Empty submission clears the search by routing back to /issues with
 * no q param.
 *
 * Default value is rendered server-side from the URL query so the
 * input shows the active query after a search.
 */
export function IssueSearchBox({ defaultQuery }: { defaultQuery: string }) {
  return (
    <form
      action="/issues"
      method="get"
      role="search"
      className="issue-search"
    >
      <label className="issue-search__label">
        <Icon
          name="search"
          size={16}
          className="issue-search__icon"
          aria-hidden
        />
        <input
          type="search"
          name="q"
          defaultValue={defaultQuery}
          placeholder="Search by UUM-id or description text…"
          aria-label="Search Unity issues"
          autoComplete="off"
          className="issue-search__input"
        />
      </label>
      <button type="submit" className="btn btn--small btn--primary">
        Search
      </button>
      {defaultQuery ? (
        <a href="/issues" className="issue-search__clear">
          Clear
        </a>
      ) : null}
    </form>
  );
}
