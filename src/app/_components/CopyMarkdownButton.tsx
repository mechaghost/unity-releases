"use client";

import { useState } from "react";
import { Icon } from "./Icon";

type Props = {
  /** Absolute or relative URL to fetch the markdown from. We use this
   *  instead of a pre-rendered string so the on-screen /compare page
   *  doesn't have to re-run the 10-lane fan-out (at EXPORT_ROW_LIMIT
   *  rows each) on every page load just to feed this button. The URL
   *  hits /compare.md which is route-cached at the CDN. */
  url: string;
  /** Filename (without extension) for the downloaded file. */
  filename: string;
  /** Optional label override. */
  label?: string;
};

/**
 * Downloads the markdown export by fetching /compare.md on click. The
 * markdown is built server-side once per (from,to,stream) tuple and
 * cached at the route layer, so repeat clicks are free. Bytes only
 * cross the wire when the user actually wants the file — pre-rendering
 * it for everyone burned ~10 SQL queries per page load.
 */
export function CopyMarkdownButton({
  url,
  filename,
  label = "Download markdown"
}: Props) {
  const [state, setState] = useState<"idle" | "loading" | "downloaded" | "error">("idle");

  async function download() {
    setState("loading");
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const safeName = sanitizeFilename(filename) || "compare";
      const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${safeName}.md`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
      setState("downloaded");
      window.setTimeout(() => setState("idle"), 1800);
    } catch {
      setState("error");
      window.setTimeout(() => setState("idle"), 2400);
    }
  }

  const text =
    state === "loading"
      ? "Building…"
      : state === "downloaded"
      ? "Downloaded!"
      : state === "error"
      ? "Download failed"
      : label;
  const icon =
    state === "loading"
      ? "file-text"
      : state === "downloaded"
      ? "check"
      : state === "error"
      ? "x"
      : "file-text";

  return (
    <button
      type="button"
      className="btn btn--small"
      data-state={state}
      onClick={download}
      disabled={state === "loading"}
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
