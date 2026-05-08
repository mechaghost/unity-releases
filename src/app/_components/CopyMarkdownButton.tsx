"use client";

import { useState } from "react";
import { Icon } from "./Icon";

type Props = {
  /** Pre-rendered markdown the button hands the user as a .md download. */
  markdown: string;
  /** Filename (without extension) for the downloaded file. */
  filename: string;
  /** Optional label override. */
  label?: string;
};

/**
 * Downloads a server-built markdown snapshot as a .md file. Used on the
 * compare page so a reader can save the diff for upgrade notes, attach
 * it to a PR, or paste it into Slack without retyping.
 */
export function CopyMarkdownButton({
  markdown,
  filename,
  label = "Download markdown"
}: Props) {
  const [state, setState] = useState<"idle" | "downloaded" | "error">("idle");

  function download() {
    try {
      const safeName = sanitizeFilename(filename) || "compare";
      const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeName}.md`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setState("downloaded");
      window.setTimeout(() => setState("idle"), 1800);
    } catch {
      setState("error");
      window.setTimeout(() => setState("idle"), 2400);
    }
  }

  const text =
    state === "downloaded"
      ? "Downloaded!"
      : state === "error"
      ? "Download failed"
      : label;
  const icon = state === "downloaded" ? "check" : state === "error" ? "x" : "file-text";

  return (
    <button
      type="button"
      className="btn btn--small"
      data-state={state}
      onClick={download}
      aria-live="polite"
    >
      <Icon name={icon} size={14} />
      {text}
    </button>
  );
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}
