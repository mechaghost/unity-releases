import type { Metadata } from "next";

export type SearchQuery = Record<string, string | string[] | undefined>;

// Search/filter variants are useful to visitors, but not separate search results.
// Ignore unrelated tracking parameters and preserve ordinary pagination.
export function filteredPageRobots(query: SearchQuery, keys: readonly string[]): Metadata["robots"] {
  const filtered = keys.some(key => {
    const value = query[key];
    return (Array.isArray(value) ? value : [value]).some(item => Boolean(item?.trim()));
  });
  return { index: !filtered, follow: true, googleBot: { index: !filtered, follow: true } };
}
