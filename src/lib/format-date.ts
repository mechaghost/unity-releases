/**
 * Shared "released on" date formatter. Used by /releases, /releases/[version],
 * and /compare so a release date renders identically everywhere.
 *
 * Accepts ISO strings (most repository reads) or Date instances (some pg
 * column reads, depending on parser config).
 */
export function formatReleaseDate(value: string | Date): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

/**
 * Coarse "X days/months/years ago" relative formatter. Used in the
 * Editor Releases list's Age column.
 */
export function formatRelativeDate(value: string | Date): string {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  if (months === 1) return "1 mo ago";
  if (months < 12) return `${months} mo ago`;
  const years = Math.round(days / 365);
  return years === 1 ? "1 yr ago" : `${years} yrs ago`;
}
