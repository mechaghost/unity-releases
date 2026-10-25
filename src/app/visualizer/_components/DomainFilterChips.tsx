"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { DOMAINS, DOMAIN_KEYWORDS, type Domain } from "@/lib/visualizer-domains";
import { HoverInfo } from "@/app/_components/HoverInfo";

/**
 * URL-state filter chips for stability, known-issue trends, lifespans,
 * and facts. The other charts keep their all-domain scope.
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
        aria-pressed={activeDomain == null}
        onClick={() => setDomain(null)}
      >
        All
      </button>
      {DOMAINS.map((d) => (
        <HoverInfo
          asChild
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
                Filters stability, the known-issue trend, issue lifespans, and
                Top-10 facts. Build scores, the area heatmap, packages, and
                patch cadence keep their full scope.
              </p>
            </>
          }
        >
          <button
            type="button"
            className={`viz-chip ${activeDomain === d ? "viz-chip--active" : ""}`}
            aria-pressed={activeDomain === d}
            onClick={() => setDomain(d)}
          >
            {d}
          </button>
        </HoverInfo>
      ))}
      <HoverInfo
        asChild
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
          aria-pressed={activeDomain === "Other"}
          onClick={() => setDomain("Other")}
        >
          Other
        </button>
      </HoverInfo>
    </div>
  );
}
