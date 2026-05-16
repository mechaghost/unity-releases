"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { DOMAINS, DOMAIN_KEYWORDS, type Domain } from "@/lib/visualizer-domains";
import { HoverInfo } from "@/app/_components/HoverInfo";

/**
 * URL-state filter chips. Sticky at the top of the page; every chart
 * below reads `?domain=` from the URL via the server component.
 *
 * "All" clears the filter. Selecting a domain replaces it (single-select).
 */
export function DomainFilterChips({ activeDomain }: { activeDomain: Domain | "Other" | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setDomain(next: Domain | "Other" | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (next == null) {
      params.delete("domain");
    } else {
      params.set("domain", next);
    }
    const qs = params.toString();
    router.replace(qs ? `/visualizer?${qs}` : "/visualizer", { scroll: false });
  }

  return (
    <div className="viz-chips" role="group" aria-label="Domain filter">
      <button
        type="button"
        className={`viz-chip ${activeDomain == null ? "viz-chip--active" : ""}`}
        onClick={() => setDomain(null)}
      >
        All
      </button>
      {DOMAINS.map((d) => (
        <HoverInfo
          key={d}
          title={`Domain: ${d}`}
          body={
            <>
              <p>
                Aggregates every parsed note whose <code>area</code> classifier
                matches one of:
              </p>
              <p>
                {DOMAIN_KEYWORDS[d].map((kw, i) => (
                  <span key={kw}>
                    {i > 0 ? ", " : ""}
                    <code>{kw}</code>
                  </span>
                ))}
              </p>
              <p className="muted">
                Pinning a domain narrows every chart on this page to notes
                in this bucket, and re-scores the Top-10 facts in domain.
              </p>
            </>
          }
        >
          <button
            type="button"
            className={`viz-chip ${activeDomain === d ? "viz-chip--active" : ""}`}
            onClick={() => setDomain(d)}
          >
            {d}
          </button>
        </HoverInfo>
      ))}
      <HoverInfo
        title="Domain: Other"
        body={
          <p>
            Notes whose <code>area</code> classifier didn&apos;t match any
            of the curated domain regexes — long tail of less-common
            subsystems plus mis-classifications.
          </p>
        }
      >
        <button
          type="button"
          className={`viz-chip ${activeDomain === "Other" ? "viz-chip--active" : ""}`}
          onClick={() => setDomain("Other")}
        >
          Other
        </button>
      </HoverInfo>
    </div>
  );
}
