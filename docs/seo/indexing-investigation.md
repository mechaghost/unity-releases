# Search Console indexing investigation

Reviewed October 25, 2026, against the report last updated October 15.

## Evidence

- Exported all 153 soft-404 examples: every URL is a `/packages` query variant.
- Exported 1,000 of the 1,441 crawled-but-not-indexed examples (Search Console's example limit): 608 issue URLs, 359 release URLs, 26 package searches, and 7 other URLs. 383 examples have query parameters.
- Fetched 15 soft-404 examples and the first 20 crawled-but-not-indexed examples, plus the package index and a fabricated issue URL.
- All 15 package examples rendered empty search results with `index, follow`. The package index had 197 packages. Missing module/internal package searches do not establish missing registry ingestion; this is a curated index.
- Sampled real issue/release pages had server-rendered content and canonical URLs. Some issue histories repeat upstream notes across releases. No rendering failure was found in those samples; indexing remains Google's decision.
- A fabricated issue URL returned HTTP 200 with an empty-history message.

## Changes

- Filtered package, issue-list, issue-detail and release-detail views explicitly use `noindex, follow` for both general robots and Googlebot. Base content pages, ordinary pagination, and tracking-only parameters remain indexable.
- Filter URLs remain crawlable so Google can see the directive. They remain usable for visitors. This deliberately excludes search variants instead of trying to get empty search results indexed.
- Unknown or malformed issue URLs use Next's not-found handling. Metadata and page rendering share a request-cached lookup; database failures remain distinct from missing issues.
- No blanket noindex on valid issue/release histories; no fabricated descriptions or content padding to chase indexing counts.

## Verification boundary

Focused metadata, not-found and filter regression tests, full suite, typecheck, production build, and live HTTP checks. Search Console counts will change only after Google recrawls; the exported examples are not the entire historical URL set.

The package audit completed with six untracked names (including internal/module packages). No registry ingestion or version mapping was changed in this SEO fix.
