"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Client-side pageview beacon. Fires `navigator.sendBeacon()` to
 * /api/track on every pathname change (incl. initial mount). This is
 * the actual analytics source-of-truth — the Edge-middleware fetch
 * approach couldn't reach the Node-runtime route through Railway's
 * Edge → service boundary (logged as `mw_track_fetch_failed` for the
 * three days between 2026-05-14 and 2026-05-17).
 *
 * Trade-offs:
 *  - Counts only users with JS enabled. Bots overwhelmingly don't run
 *    JS, so this is actually a feature for bot filtering.
 *  - Fires after hydration, so a few hundred ms later than middleware
 *    would have. Fine for daily/weekly stats.
 *
 * sendBeacon was designed exactly for fire-and-forget analytics: the
 * browser keeps the request alive past page unload and never blocks
 * navigation on it.
 */
export function PageviewBeacon() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") {
      return;
    }
    const qs = searchParams?.toString();
    const path = qs && qs.length > 0 ? `${pathname}?${qs}` : pathname;
    const body = JSON.stringify({ kind: "pageview", path });
    try {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/track", blob);
    } catch {
      // sendBeacon throws on quota errors. Swallow — pageview is best-effort.
    }
  }, [pathname, searchParams]);

  return null;
}
