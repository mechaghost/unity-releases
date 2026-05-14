import { NextResponse, type NextRequest } from "next/server";
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
 */
export const config = {
  // Skip anything that isn't a user-facing page render.
  matcher: [
    "/((?!_next/|api/|icon|apple-icon|opengraph-image|favicon|robots\\.txt|sitemap\\.xml|llms\\.txt).*)"
  ]
};

export function middleware(request: NextRequest) {
  const ua = request.headers.get("user-agent");
  if (looksLikeBot(ua)) {
    return NextResponse.next();
  }

  // Origin needs to be absolute - Edge middleware can't relative-resolve.
  const origin = request.nextUrl.origin;
  const path = request.nextUrl.pathname + request.nextUrl.search;

  // Fire-and-forget: we never await this. The page response goes back
  // to the user without blocking on the analytics write, and a tracking
  // failure can't take the page down.
  fetch(`${origin}/api/track`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind: "pageview", path }),
    // Edge runtime doesn't always support keepalive, but where it does
    // it keeps the connection alive past the response.
    keepalive: true
  }).catch(() => {
    // Swallow - logged inside the API route if it makes it that far.
  });

  return NextResponse.next();
}
