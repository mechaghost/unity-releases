import { normalizeIssueTrackerHref } from "./issue-tracker-links";

/**
 * Confirmed removed destinations from the 2026-10-24 audit. Keep the original
 * URL as evidence; do not invent a replacement or erase historical note text.
 * Blocked/rate-limited URLs are deliberately not in this list.
 */
export const REVIEWED_UNAVAILABLE_LINKS = [
  { url: "https://unity.com/blog/unity-plugin-for-codex", reason: "The original article returns 404." },
  { url: "https://docs.unity.com/en-us/asset-transformer-sdk/2026.4/manual", reason: "The original documentation page returns 404." },
  { url: "https://github.com/LukeUnityDev", reason: "The original GitHub profile returns 404." },
  { url: "https://github.com/Unity-Technologies/ktx-plugin/releases/tag/release-github%2F1.5.1", reason: "The original release page returns 404." },
  { url: "https://github.com/Unity-Technologies/ktx-plugin/releases/tag/release-github%2F1.5.0", reason: "The original release page returns 404." },
  { url: "https://github.com/Unity-Technologies/ktx-plugin/releases/tag/release-github%2F1.3.0", reason: "The original release page returns 404." },
  { url: "https://github.com/Unity-Technologies/draco/releases/tag/unity%2F3.1.0", reason: "The original release page returns 404." },
  { url: "https://developer.android.com/develop/xr/openxr/extensions/XR_ANDROID_mouse_interaction", reason: "The original Android extension page returns 404." }
] as const;

function comparisonKey(href: string): string {
  try {
    const url = new URL(href);
    url.hash = "";
    url.pathname = url.pathname.replace(/\/+$/, "");
    return url.href;
  } catch {
    return href;
  }
}

const unavailable = new Map(REVIEWED_UNAVAILABLE_LINKS.map(entry => [comparisonKey(entry.url), entry]));

export function resolveExternalLink(href: string): { href: string | null; reason?: string } {
  const entry = unavailable.get(comparisonKey(href));
  if (entry) return { href: null, reason: entry.reason };
  return { href: normalizeIssueTrackerHref(href) };
}
