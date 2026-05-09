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
 * fetches the markdown directly — no manual download + paste step.
 */
export function CopyLlmUrlButton({ url }: Props) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
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
