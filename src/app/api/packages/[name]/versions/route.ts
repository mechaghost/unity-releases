import { NextResponse } from "next/server";
import { getPackage } from "@/lib/db/repositories";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const VERSION_CAP = 50;

/**
 * GET /api/packages/<name>/versions
 *
 * Returns the most recent versions of a single Unity package along with
 * their changelogs. Used by the on-screen Package row dialog to lazy-
 * load notes only when the user clicks a row — eager-loading every
 * package's full version history would balloon the /packages payload.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ name: string }> }
) {
  const { name } = await context.params;
  if (!name) {
    return NextResponse.json({ error: "missing-name" }, { status: 400 });
  }

  let result: Awaited<ReturnType<typeof getPackage>>;
  try {
    result = await getPackage(name);
  } catch {
    return NextResponse.json({ error: "lookup-failed" }, { status: 500 });
  }
  if (!result) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  const versions = (result.versions as PackageVersionRow[])
    .slice(0, VERSION_CAP)
    .map((v) => ({
      version: v.version,
      publishedAt: v.published_at ? new Date(v.published_at).toISOString() : null,
      isPrerelease: Boolean(v.is_prerelease),
      unityCompatibility: v.unity_compatibility ?? null,
      changelog: typeof v.changelog === "string" ? v.changelog.trim() || null : null
    }));

  return NextResponse.json(
    {
      name: result.package.name,
      displayName: result.package.display_name ?? null,
      description: result.package.description ?? null,
      sourceUrl: result.package.source_url ?? null,
      totalVersions: result.versions.length,
      versions
    },
    {
      headers: {
        // 5-minute private cache; the package poller runs every 12 hours
        // so a slightly stale snapshot is fine and saves repeated DB hits.
        "cache-control": "private, max-age=300"
      }
    }
  );
}

type PackageVersionRow = {
  version: string;
  published_at: string | Date | null;
  is_prerelease: boolean | null;
  unity_compatibility: string | null;
  changelog: string | null;
};
