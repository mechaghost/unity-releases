"use client";

import { useState } from "react";
import { Icon } from "./Icon";

type Props = {
  /** Absolute URL to the markdown export, e.g.
   *  `https://unityreleases.com/compare.md?from=A&to=B`. Pre-built on
   *  the server so this client component is a single-purpose copy widget. */
  url: string;
};

/**
 * Copies the canonical `/compare.md` URL to the clipboard so the reader
 * can paste it into a Claude / ChatGPT / Gemini conversation. The LLM
 * fetches the markdown directly - no manual download + paste step.
 */
export function CopyLlmUrlButton({ url }: Props) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
      // Fire-and-forget analytics — same pipeline the pageview beacon
      // uses. Only on success: we don't want the failed-permission case
      // to count as a positive interaction.
      trackCopyClick(url);
      window.setTimeout(() => setState("idle"), 1800);
    } catch {
      setState("error");
      window.setTimeout(() => setState("idle"), 2400);
    }
  }

  const text =
    state === "copied"
      ? "Copied!"
      : state === "error"
      ? "Copy failed"
      : "Copy LLM-ready URL";
  const icon = state === "copied" ? "check" : state === "error" ? "x" : "link";

  return (
    <button
      type="button"
      className="upgrade-cta__llm-link"
      data-state={state}
      onClick={copy}
      aria-live="polite"
      title={url}
    >
      <Icon name={icon} size={12} />
      {text}
    </button>
  );
}

/** Send a `copy_llm_url` event to /api/track via sendBeacon. The path
 *  metadata field carries the page the user copied from (not the
 *  copied URL itself — we don't need the full export URL in analytics
 *  to know which surface drove the click). */
function trackCopyClick(copiedUrl: string) {
  if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") {
    return;
  }
  const path =
    typeof window !== "undefined"
      ? window.location.pathname + window.location.search
      : undefined;
  // Parse a few low-cardinality fields out of the export URL so /stats
  // can answer "what compare ranges do people copy?" without storing
  // the full URL.
  const meta: Record<string, unknown> = {};
  try {
    const parsed = new URL(copiedUrl);
    meta.exportPath = parsed.pathname;
    const from = parsed.searchParams.get("from");
    const to = parsed.searchParams.get("to");
    if (from) meta.from = from;
    if (to) meta.to = to;
  } catch {
    // bad URL — fine, omit metadata
  }
  try {
    const body = JSON.stringify({
      kind: "event",
      eventType: "copy_llm_url",
      path,
      metadata: meta
    });
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon("/api/track", blob);
  } catch {
    // Best-effort: a tracking failure must never block the UI.
  }
}
