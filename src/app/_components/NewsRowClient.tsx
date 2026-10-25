"use client";

import { type MouseEvent, type ReactNode } from "react";
import { resolveExternalLink } from "@/lib/external-links";

type Props = {
  href: string;
  children: ReactNode;
};

/**
 * Wraps one news <tr> so clicking anywhere on the row opens the
 * external article in a new tab. Cmd/Ctrl-click respects the
 * "open in background tab" intent. We still keep the inner <a>
 * so keyboard navigation, screen readers, and middle-click work
 * naturally — this only adds the convenience target for mouse
 * users who instinctively aim at the row.
 */
export function NewsRowClient({ href, children }: Props) {
  const resolved = resolveExternalLink(href);
  function onClick(e: MouseEvent<HTMLTableRowElement>) {
    if (!resolved.href) return;
    const target = e.target as HTMLElement;
    // Let the inner link handle its own click — don't double-open.
    if (target.closest("a, button")) return;
    if (e.metaKey || e.ctrlKey || e.button === 1) {
      window.open(resolved.href, "_blank", "noopener,noreferrer");
    } else {
      window.open(resolved.href, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <tr className="news-row" onClick={resolved.href ? onClick : undefined}>
      {children}
    </tr>
  );
}
