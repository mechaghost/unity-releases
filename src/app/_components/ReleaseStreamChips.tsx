import type { ReleaseFilterOption, ReleaseSortKey } from "@/lib/release-page-filter";
import { AutoSubmitOnChange } from "./AutoSubmitOnChange";
import { Icon } from "./Icon";

/**
 * The /releases stream chip row.
 *
 * Fully server-rendered. `options` is derived per-request from the indexed
 * lines (see `buildReleaseFilters`), so a new LTS line gets a chip with no
 * code change - which is the whole point, but also why none of this data may
 * cross into a client component: see {@link AutoSubmitOnChange} for the
 * dropped-`VersionPill` bug that caused. Only the auto-submit behaviour is
 * client-side, and it carries no payload.
 */
export function ReleaseStreamChips({
  selected,
  options,
  sortKey = null
}: {
  selected: string[];
  options: ReleaseFilterOption[];
  /**
   * Round-tripped through a hidden field. Submitting this form rebuilds the
   * whole query string, so without it, toggling a chip silently discards an
   * active ?sort= and drops the user back to date order.
   */
  sortKey?: ReleaseSortKey | null;
}) {
  const selectedSet = new Set(selected);

  return (
    <form
      className="filter-bar stream-checkbox-filter"
      method="get"
      action="/releases"
      aria-label="Stream filter"
    >
      {sortKey ? <input type="hidden" name="sort" value={sortKey} /> : null}
      {options.map((option) => {
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
      <AutoSubmitOnChange />
      <button type="submit" className="visually-hidden">
        Apply stream filters
      </button>
    </form>
  );
}
