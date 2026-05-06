import { cookies } from "next/headers";

export const USER_PACKAGES_COOKIE = "unity-alerts-packages";

/**
 * Parse the user's manifest input into a list of canonical Unity package
 * names (`com.unity.*`-style). Accepts:
 *
 *   - The full `Packages/manifest.json` JSON (as a string)
 *   - A bare `{ "dependencies": { ... } }` JSON fragment
 *   - A whitespace/comma-separated list of names ("com.unity.inputsystem,
 *     com.unity.cinemachine")
 *
 * Returns deduplicated, sorted names. Names that don't look like Unity
 * package ids (they must contain at least one dot) are dropped.
 */
export function parseManifestInput(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const out = new Set<string>();

  // Try JSON first.
  try {
    const parsed = JSON.parse(trimmed);
    const deps =
      parsed && typeof parsed === "object" && parsed && "dependencies" in parsed
        ? (parsed as { dependencies?: unknown }).dependencies
        : parsed;
    if (deps && typeof deps === "object") {
      for (const key of Object.keys(deps as Record<string, unknown>)) {
        if (looksLikePackageName(key)) out.add(key.trim());
      }
      return [...out].sort();
    }
  } catch {
    /* not JSON — fall through */
  }

  // Fall back to a delimiter-separated list.
  for (const candidate of trimmed.split(/[\s,;]+/)) {
    const s = candidate.trim();
    if (looksLikePackageName(s)) out.add(s);
  }
  return [...out].sort();
}

function looksLikePackageName(value: string): boolean {
  return value.length > 2 && value.includes(".");
}

/** Read the user's package allow-list from the cookie. Empty list = "all". */
export async function getUserPackages(): Promise<string[]> {
  const jar = await cookies();
  const value = jar.get(USER_PACKAGES_COOKIE)?.value?.trim();
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
