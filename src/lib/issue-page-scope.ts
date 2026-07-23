/**
 * Pure helpers behind the scope-by-major chip row on `/issues/[issueId]`.
 *
 * Lives in `src/lib/` (rather than co-located in the page file) so the
 * scope-filter rule has its own unit-test home — the bug pattern these
 * helpers prevent is the same one that bit `/compare` and `/explorer`:
 * an issue with mentions in 2019/2020/2022 + a fix in 6000.3 must NOT
 * render as "fixed in 6000.3.x" when the user has scoped to a legacy
 * LTS line they can't reach the fix from.
 */

import { unityMajorLabel } from "./unity-generation";

/** Parse the leading numeric major from an editor version string. */
export function majorOf(version: string): number | null {
  const dot = version.indexOf(".");
  if (dot < 0) return null;
  const n = Number(version.slice(0, dot));
  return Number.isFinite(n) ? n : null;
}

/**
 * De-dupe + sort majors DESC. The chip row reads Unity 6 first, then
 * 2022 / 2021 / 2020 / 2019 — same order the picker and /releases use.
 */
export function uniqueMajorsDesc(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => b - a);
}

/**
 * Display label for a major (`6000` → `Unity 6`, `7000` → `Unity 7`, else
 * `Unity 20XX LTS`). Delegates so the compare picker's group labels and
 * these chips can't drift apart.
 */
export function majorLabel(major: number): string {
  return unityMajorLabel(major);
}

/**
 * Coerce a `?major=…` query param to a numeric major or null. Accepts
 * `string | string[] | undefined` because Next.js search params can
 * deliver any of the three.
 */
export function parseMajorParam(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Resolve the active chip given the user's requested major and the set
 * of majors the issue actually has mentions in. Returns null (meaning
 * "All") when the requested major isn't a chip we'd render — keeps the
 * URL self-correcting if a user types `?major=9999` by hand.
 */
export function resolveActiveMajor(
  requested: number | null,
  available: readonly number[]
): number | null {
  if (requested === null) return null;
  return available.includes(requested) ? requested : null;
}
