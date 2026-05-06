"use client";

import { useState } from "react";
import { Icon } from "./Icon";

type Props = {
  text: string;
  /** Visible label when idle. */
  label?: string;
};

/**
 * Single-shot "copy this markdown to my clipboard" button. Used to
 * paste a compare brief into Slack, Notion, a PR description, etc.
 */
export function CopyMarkdownButton({ text, label = "Copy as Markdown" }: Props) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
      setTimeout(() => setState("idle"), 1800);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 2200);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={`btn btn--secondary btn--small copy-md-button copy-md-button--${state}`}
      aria-label={label}
    >
      <Icon name={state === "copied" ? "check" : "file-text"} size={14} />
      {state === "copied" ? "Copied" : state === "error" ? "Copy failed" : label}
    </button>
  );
}
