"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import { Icon } from "./Icon";
import { PackageVersionDialog } from "./PackageVersionDialog";

type Props = {
  packageName: string;
  displayName: string | null;
  registryUrl: string;
  /** Already-rendered cell contents from the server. We accept ReactNode
   *  so the page-side render can keep its existing JSX (chips, link cells,
   *  etc.) and we don't have to re-implement that here. */
  children: ReactNode;
};

/**
 * Wraps one package <tr> with click-to-open dialog behavior. The row
 * itself stays a plain semantic table row - no role override, since
 * `role="button"` on a <tr> makes browsers stop applying table-cell
 * layout to its children. The focusable + keyboard-activatable
 * affordance lives in a <button> inside the chevron cell; the row's
 * onClick is a mouse-only convenience that still skips clicks landing
 * inside a link or button so the Registry link works normally.
 */
export function PackageRowClient({
  packageName,
  displayName,
  registryUrl,
  children
}: Props) {
  const [open, setOpen] = useState(false);

  function maybeOpen(e: MouseEvent<HTMLTableRowElement>) {
    const target = e.target as HTMLElement;
    if (target.closest("a, button, input, select, textarea, [data-row-noop]")) {
      // Let the inner interactive element handle its own click.
      return;
    }
    setOpen(true);
  }

  const buttonLabel = `Show release notes for ${displayName ?? packageName}`;

  return (
    <>
      <tr className="packages-row" onClick={maybeOpen}>
        {children}
        <td className="packages-row__caret">
          <button
            type="button"
            className="packages-row__caret-btn"
            onClick={() => setOpen(true)}
            aria-label={buttonLabel}
            aria-haspopup="dialog"
            aria-expanded={open}
          >
            <Icon name="chevron-right" size={14} />
          </button>
        </td>
      </tr>
      <PackageVersionDialog
        open={open}
        onClose={() => setOpen(false)}
        packageName={packageName}
        displayName={displayName}
        registryUrl={registryUrl}
      />
    </>
  );
}
