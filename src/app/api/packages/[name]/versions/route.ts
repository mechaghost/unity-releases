import { NextResponse } from "next/server";
import { getPackage } from "@/lib/db/repositories";
import { isNewerVersion } from "@/lib/version-compare";
import { pageBounds } from "@/lib/pagination";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const VERSION_CAP = 50;
const PACKAGE_NAME_RE = /^com\.unity\.[a-z0-9][a-z0-9._-]{0,120}$/;

/**
 * GET /api/packages/<name>/versions
 *
 * Returns a page of versions of a single Unity package along with
 * their changelogs (`?page=1`, 50 per page). Used by the Package row dialog to lazy-
 * load notes only when the user clicks a row - eager-loading every
 * package's full version history would balloon the /packages payload.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ name: string }> }
) {
  const pageValue = new URL(request.url).searchParams.get("page") ?? "1";
  if (!/^[1-9]\d{0,5}$/.test(pageValue)) {
    return NextResponse.json({ error: "invalid-page" }, { status: 400 });
  }
  const requestedPage = Number(pageValue);
  const { name } = await context.params;
  let packageName: string;
  try {
    packageName = decodeURIComponent(name ?? "").trim();
  } catch {
    return NextResponse.json({ error: "invalid-name" }, { status: 400 });
  }
  if (!packageName) {
    return NextResponse.json({ error: "missing-name" }, { status: 400 });
  }
  if (!PACKAGE_NAME_RE.test(packageName)) {
    return NextResponse.json({ error: "invalid-name" }, { status: 400 });
  }

  let result: Awaited<ReturnType<typeof getPackage>>;
  try {
    result = await getPackage(packageName);
  } catch {
    return NextResponse.json({ error: "lookup-failed" }, { status: 500 });
  }
  if (!result) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  const pagination = pageBounds(result.versions.length, requestedPage, VERSION_CAP);
  const versions = (result.versions as PackageVersionRow[])
    .slice(pagination.offset, pagination.offset + VERSION_CAP)
    .map((v) => ({
      version: v.version,
      publishedAt: v.published_at ? new Date(v.published_at).toISOString() : null,
      isPrerelease: Boolean(v.is_prerelease),
      unityCompatibility: v.unity_compatibility ?? null,
      bundledInEditor: v.bundled_in_editor ?? null,
      changelog: typeof v.changelog === "string" ? v.changelog.trim() || null : null
    }));

  // Surface the Unity-6.4+ aligned version only when it's genuinely newer than
  // the registry latest (the dialog frames the two schemes). Same gate as
  // /packages, so the two views agree.
  const registryLatest = (result.versions[0] as PackageVersionRow | undefined)?.version ?? null;
  const unified =
    result.unified && isNewerVersion(result.unified.aligned_version, registryLatest)
      ? { unityMinor: result.unified.unity_minor, version: result.unified.aligned_version }
      : null;

  return NextResponse.json(
    {
      name: result.package.name,
      displayName: result.package.display_name ?? null,
      description: result.package.description ?? null,
      sourceUrl: result.package.source_url ?? null,
      totalVersions: result.versions.length,
      page: pagination.page,
      pages: pagination.pages,
      pageSize: VERSION_CAP,
      unified,
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
  bundled_in_editor: string | null;
  changelog: string | null;
};
