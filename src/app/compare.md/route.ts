import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { buildCompareMarkdownExport } from "@/lib/compare-export";

export const revalidate = 300;

/**
 * GET /compare.md?from=<version>&to=<version>[&stream=<stream>]
 *
 * Returns the same markdown the on-screen "Markdown export for LLMs"
 * button would download, served as `text/markdown` so an LLM (or
 * `curl`, or a `WebFetch` tool) can ingest it directly without a
 * browser. The endpoint is documented in /llms.txt and /faq.
 *
 * Status codes:
 * - 200 - markdown body
 * - 400 - required params missing, invalid version shape, or range too wide
 * - 404 - version unknown OR no releases between the two versions
 *         in the requested stream scope
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cacheKey = normalizedCacheKey(searchParams);
  const result = await cachedCompareMarkdownExport(cacheKey);

  if (!result.ok) {
    const status = isBadRequestError(result.error) ? 400 : 404;
    return new NextResponse(`# Error\n\n${result.message}\n`, {
      status,
      headers: textHeaders()
    });
  }

  const arrow = result.reversed ? "downgrade" : "upgrade";
  const filename = `unity-${result.fromVersion}-to-${result.toVersion}-${arrow}.md`;
  return new NextResponse(result.markdown, {
    status: 200,
    headers: {
      ...textHeaders(),
      // `inline` so an LLM-tool fetch reads the body; the filename
      // hints to a browser save-as dialog if a human hits the URL
      // directly. No `attachment` - we want this previewable.
      "content-disposition": `inline; filename="${filename}"`
    }
  });
}

function textHeaders(): Record<string, string> {
  return {
    "content-type": "text/markdown; charset=utf-8",
    // 5 minutes at the CDN, longer at private caches - release data
    // updates at most every 12 hours via the editor poller, so a
    // stale cache window is fine.
    "cache-control": "public, max-age=300, s-maxage=300, stale-while-revalidate=86400"
  };
}

function isBadRequestError(error: string): boolean {
  return (
    error === "missing-versions" ||
    error === "invalid-versions" ||
    error === "cross-major" ||
    error === "range-too-wide"
  );
}

function cachedCompareMarkdownExport(cacheKey: string) {
  return unstable_cache(
    () => buildCompareMarkdownExport(new URLSearchParams(cacheKey)),
    ["compare-markdown-export", cacheKey],
    { revalidate: 300 }
  )();
}

function normalizedCacheKey(searchParams: URLSearchParams): string {
  return new URLSearchParams(
    [...searchParams.entries()].sort(([ak, av], [bk, bv]) =>
      ak === bk ? av.localeCompare(bv) : ak.localeCompare(bk)
    )
  ).toString();
}
