"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";

/**
 * Mobile-only hamburger that toggles the slide-in nav drawer.
 * Updates `data-nav-open` on `.app-shell` so CSS can run the slide
 * transition; closes on Escape and on backdrop click.
 */
export function MobileNavToggle() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const shell = document.querySelector(".app-shell") as HTMLElement | null;
    if (!shell) return;
    if (open) {
      shell.setAttribute("data-nav-open", "true");
    } else {
      shell.removeAttribute("data-nav-open");
    }
  }, [open]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        className="mobile-nav-toggle"
        aria-label={open ? "Close navigation" : "Open navigation"}
        aria-expanded={open}
        aria-controls="primary-nav"
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name={open ? "x" : "menu"} size={20} />
      </button>
      <button
        type="button"
        className="mobile-nav-backdrop"
        aria-hidden={!open}
        tabIndex={-1}
        onClick={() => setOpen(false)}
      >
        <span className="visually-hidden">Close navigation</span>
      </button>
    </>
  );
}
