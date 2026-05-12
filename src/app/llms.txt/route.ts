import { NextResponse } from "next/server";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-static";

/**
 * GET /llms.txt
 *
 * Markdown manifest aimed at large language models that have been
 * pointed at this site. Follows the emerging llmstxt.org convention:
 * a short, link-rich description of what the site is and where the
 * LLM-readable resources live.
 *
 * Most importantly, it documents the `/compare.md` endpoint that
 * returns a structured upgrade diff in markdown - the single most
 * useful thing an LLM can fetch from this site.
 */
export async function GET() {
  const origin = siteUrl();
  const body = `# Unity Releases

> Independent release-first intelligence hub for Unity editor releases.
> Diff any two Unity editor versions, see every blocker, breaking
> change, API change, package bump, and known issue between them,
> bucketed by impact. Not affiliated with Unity Technologies - data is
> ingested from Unity's public editor release pages, package registry,
> and blog.

## What this site is for

A Unity developer (or an LLM helping one) deciding whether and when to
upgrade. Unity 6 (\`6000.x\`) is the primary focus; the legacy LTS
lines \`2022.3\`, \`2021.3\`, \`2020.3\`, and \`2019.4\` are also indexed
for upgrade planning, including the cross-major jump from any of those
to Unity 6. The primary surface is a lane-bucketed diff between two
versions; secondary surfaces list the underlying releases, packages,
and Unity blog posts.

Cross-major diffs (e.g. \`2022.3.50f1\` → \`6000.0.74f1\`) are allowed
because that's the upgrade decision most legacy-LTS users care about,
but the lane contents will mix release notes from two independent
product lines, so the output is noisier than a within-major diff.

## Markdown endpoint for LLMs

The most useful resource on this site for an LLM is a structured
markdown diff between two Unity editor versions:

\`GET ${origin}/compare.md?from=<from-version>&to=<to-version>\`

Example:

\`\`\`
${origin}/compare.md?from=6000.0.50f1&to=6000.0.74f1
\`\`\`

Required query parameters:
- \`from\` - the source Unity editor version (e.g. \`6000.0.50f1\` or
  \`2022.3.40f1\`). Must be an indexed version on Unity 6 or one of the
  legacy LTS lines (2019.4, 2020.3, 2021.3, 2022.3).
- \`to\` - the target Unity editor version. Same constraints as \`from\`;
  same-major or cross-major diffs are both supported.

Optional query parameters:
- \`stream\` - restrict in-between releases to a stream. Repeatable.
  Values: \`LTS\`, \`Update/Supported\`, \`beta\`, \`alpha\`. Defaults to
  \`LTS\` if omitted.

Response: \`text/markdown; charset=utf-8\`. The body is bucketed into
lanes (Active known blockers, Breaking changes, Other known issues,
Security & install impact, Package updates, API changes, Fixes,
Improvements, Features, Other changes), with issue-tracker links and
status suffixes (\`open\`, \`fixed in 6000.x.y\`) on every issue ID.

If you only need an upgrade summary, this endpoint is the right
starting point. If you need version metadata or a per-release view,
hit the HTML pages below - they render the same data with more
filtering UI.

## Pages (HTML)

- [Upgrade Intelligence](${origin}/) - the home page. Pick two versions
  to diff. Same data as \`/compare.md\` rendered with filtering UI.
- [Editor Releases](${origin}/releases) - every indexed Unity editor
  release. Unity 6 LTS is shown by default; the chip row reveals
  Supported / Beta / Alpha plus the 2022, 2021, 2020, and 2019 LTS
  lines.
- [Per-release notes](${origin}/releases/6000.0.74f1) - replace the
  version segment with any indexed release; the body shows lane-bucketed
  release notes for that single release.
- [Packages](${origin}/packages) - latest versions of tracked official
  Unity packages (Input System, Addressables, URP, HDRP, Cinemachine,
  Burst, etc.) with release histories.
- [News](${origin}/news) - mirror of the official Unity blog. Secondary
  to release intelligence; included for completeness.
- [FAQ](${origin}/faq) - explanations of the impact lanes, risk levels,
  data sources, refresh cadence, and filter semantics.

## Operational

- [Sitemap](${origin}/sitemap.xml)
- [Robots](${origin}/robots.txt)
- [Health](${origin}/api/health) - JSON: data freshness per source

## Conventions

- Issue IDs follow Unity's tracker format (e.g. \`UUM-12345\`) and link
  out to \`https://issuetracker.unity3d.com/issues/<id>\`.
- Versions follow Unity's editor scheme: \`6000.<minor>.<patch><tag>\`
  where \`<tag>\` is \`f<n>\` (final/LTS), \`b<n>\` (beta), or \`a<n>\` (alpha).
- "Lane" = the impact bucket a release-note row falls into (one of the
  ten lanes listed above). "Risk" = independent severity axis (blocker,
  caution, review, info).

## Disclaimer

This site is not affiliated with, endorsed by, or sponsored by Unity
Technologies. "Unity" and the Unity logo are trademarks of Unity
Technologies. For anything authoritative - licensing, support, official
roadmaps - see [unity.com](https://unity.com).
`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=3600"
    }
  });
}
