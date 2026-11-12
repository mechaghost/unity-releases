import { normalizeIssueTrackerHref } from "./issue-tracker-links";

/**
 * Confirmed removed destinations from reviewed link audits. Keep the original
 * URL as evidence; do not invent a replacement or erase historical note text.
 * Blocked/rate-limited URLs are deliberately not in this list.
 */
export const REVIEWED_UNAVAILABLE_LINKS = [
  // 2026-11-04: legacy slug redirects to /not-found (HTTP 200). Unity's
  // 2022.3.13f1 release notes still cite UUM-54561; no replacement is verified.
  { url: "https://issuetracker.unity3d.com/issues/particles-calling-setdirty-from-a-thread-causes-crashes", reason: "Unity Issue Tracker reports that the original issue page was not found." },
  // 2026-11-09: both legacy slugs redirect to /not-found (HTTP 200).
  // Official 6000.0.0b12 / 2022.3.3f1 notes still cite UUM-67108 / UUM-37468.
  { url: "https://issuetracker.unity3d.com/issues/hub-crashes-if-the-user-is-marked-as-non-compliant-in-the-genesis-backend", reason: "Unity Issue Tracker reports that the original issue page was not found." },
  { url: "https://issuetracker.unity3d.com/issues/incompatible-keyword-states-error", reason: "Unity Issue Tracker reports that the original issue page was not found." },
  // 2026-11-12: UUM-33950 redirects to /not-found (HTTP 200).
  // 2021.3.28f1 / 2022.3.3f1 notes retain the original issue; no replacement is verified.
  { url: "https://issuetracker.unity3d.com/issues/anti-aliasing-around-objects-results-in-outlines-when-recording-against-a-background", reason: "Unity Issue Tracker reports that the original issue page was not found." },
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
