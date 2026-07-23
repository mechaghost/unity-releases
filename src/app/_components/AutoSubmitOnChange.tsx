"use client";

import { useEffect, useRef } from "react";

/**
 * Submits the enclosing `<form>` whenever one of its controls changes.
 *
 * Exists so a filter form can be rendered entirely on the server while still
 * auto-applying: this component carries no props and no children, so nothing
 * about the form's contents crosses the server/client boundary.
 *
 * That matters concretely. When /releases passed its derived chip list across
 * the boundary - either as a prop or as server-rendered children - one
 * unrelated `VersionPill` elsewhere on the page silently vanished from the
 * SSR'd HTML (49 of 50 rows). The pill was present in the RSC payload but
 * missing from the rendered markup, and the position varied between dev and
 * production builds. Keeping the boundary payload empty avoids it.
 *
 * Progressive enhancement: the form keeps its real submit button, so the
 * filter still works with JavaScript disabled or before hydration.
 */
export function AutoSubmitOnChange() {
  const anchorRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const form = anchorRef.current?.closest("form");
    if (!form) return;

    const submit = () => form.requestSubmit();
    form.addEventListener("change", submit);

    // Re-sync on bfcache restore (Back/Forward). The chips are uncontrolled
    // (`defaultChecked`) and their selected *appearance* comes from static SSR
    // markup, while a click flips only the live `input.checked`. bfcache freezes
    // that drifted live state, so after Back a chip can look ON while its input
    // is OFF (or vice versa) - the next click then does the opposite of what the
    // user expects. Resetting restores every input to its `defaultChecked`,
    // which is exactly the SSR markup for the restored URL, so appearance and
    // input agree again. reset() fires no `change` event, so it won't submit.
    const resync = (event: PageTransitionEvent) => {
      if (event.persisted) form.reset();
    };
    window.addEventListener("pageshow", resync);

    return () => {
      form.removeEventListener("change", submit);
      window.removeEventListener("pageshow", resync);
    };
  }, []);

  return <span ref={anchorRef} hidden />;
}
