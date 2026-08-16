/**
 * URL builders for `/compare`.
 *
 * Every link the compare page renders has to carry the params that define
 * *which releases are in the diff*. `from`/`to` are obvious; `stream` is
 * the easy one to forget, because it has a non-empty default: a URL with
 * no `?stream=` resolves to LTS-only (see `parseCompareStreamSelection`).
 * So dropping it doesn't fall back to "no filter" — it silently rescopes
 * the comparison, which is how a lane's "Next" button could land on
 * "No releases in range" for an LTS → beta diff.
 *
 * Both builders funnel through {@link applyCompareScope} so the scope is
 * declared in exactly one place.
 */

/** The params that decide which releases the diff covers. */
export type CompareScope = {
  fromVersion: string;
  toVersion: string;
  /** Legacy `?platform=` narrowing; omitted when empty. */
  platform?: string | null;
  /** Resolved stream selection — written out explicitly even when it
   *  matches the default, so the produced URL pins its own scope. */
  streams: readonly string[];
};

/** Overwrite the scope params on `params`, leaving everything else alone. */
function applyCompareScope(params: URLSearchParams, scope: CompareScope): void {
  params.set("from", scope.fromVersion);
  params.set("to", scope.toVersion);
  if (scope.platform) params.set("platform", scope.platform);
  else params.delete("platform");
  // `stream` repeats, so rewrite rather than set: a stale value left over
  // from `current` would widen the scope on every click.
  params.delete("stream");
  for (const stream of scope.streams) params.append("stream", stream);
}

/**
 * Build the href for a lane's Prev/Next control.
 *
 * Starts from the *current* URL so user filters (`q`, `lanes`, `risks`,
 * `sub_from`/`sub_to`, …) and the other lanes' page numbers ride along
 * untouched; only this lane's `p_<laneId>` is rewritten.
 */
export function buildLanePageUrl(
  current: URLSearchParams,
  scope: CompareScope,
  laneId: string,
  nextPage: number
): string {
  const params = new URLSearchParams(current);
  applyCompareScope(params, scope);
  const key = `p_${laneId}`;
  params.delete(key);
  if (nextPage > 1) params.set(key, String(nextPage));
  return `/compare?${params.toString()}#lane-${laneId}`;
}

/**
 * Scope params the filter drawer and chip row must re-emit when they
 * apply a change. They rebuild the filter half of the query from their
 * own state, so only the scope needs preserving.
 *
 * Lane pages are deliberately not preserved: a filter change resizes
 * every lane's result set, so page 3 of the old set is meaningless.
 */
export function comparePreservedParams(
  scope: CompareScope
): Array<[string, string]> {
  const params = new URLSearchParams();
  applyCompareScope(params, scope);
  return [...params.entries()];
}
