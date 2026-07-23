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
    return () => form.removeEventListener("change", submit);
  }, []);

  return <span ref={anchorRef} hidden />;
}
