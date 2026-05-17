import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { looksLikeBot } from "@/lib/analytics";

/**
 * Edge middleware that fire-and-forgets a tracking call to `/api/track`
 * for every human-looking page request. Lives at the Edge because
 * Next.js middleware can't run in the Node runtime, and we want the
 * tracking to happen for every request without modifying each page's
 * server component.
 *
 * Path filtering (the IGNORED_PREFIXES list in `@/lib/analytics`) is
 * also applied here via the matcher config so the tracking POST never
 * fires for static assets, OG images, or the tracking endpoint itself.
 *
 * IMPORTANT: the tracking fetch is registered with `event.waitUntil()`
 * so the Edge runtime keeps the function alive until the POST settles.
 * Without it, the runtime tears down the async context the moment
 * `NextResponse.next()` returns and the in-flight fetch never lands —
 * which is exactly what was happening in prod between 2026-05-14 and
 * 2026-05-17 (only the manual smoke-test row ever made it through).
 * The fetch is still non-blocking for the user: waitUntil extends the
 * function's lifetime, it doesn't delay the response.
 */
export const config = {
  // Skip anything that isn't a user-facing page render.
  matcher: [
    "/((?!_next/|api/|icon|apple-icon|opengraph-image|favicon|robots\\.txt|sitemap\\.xml|llms\\.txt).*)"
  ]
};

export function middleware(request: NextRequest, event: NextFetchEvent) {
  const ua = request.headers.get("user-agent");
  if (looksLikeBot(ua)) {
    return NextResponse.next();
  }

  // Origin needs to be absolute - Edge middleware can't relative-resolve.
  const origin = request.nextUrl.origin;
  const path = request.nextUrl.pathname + request.nextUrl.search;

  event.waitUntil(
    fetch(`${origin}/api/track`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "pageview", path })
    }).catch(() => {
      // Swallow - logged inside the API route if it makes it that far.
    })
  );

  return NextResponse.next();
}
