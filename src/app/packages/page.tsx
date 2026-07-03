import type { ReactNode } from "react";
import { listPackages, getEditorBundledVersions, type EditorBundledVersion } from "@/lib/db/repositories";
import { isRegistryFrozen } from "@/lib/ingest/unity-packages";
import { isNewerVersion, earlierUnityRange } from "@/lib/version-compare";
import { getUserPackages } from "@/lib/user-packages";
import { ExternalLink } from "../_components/ExternalLink";
import { SidebarUserPackages } from "../_components/SidebarUserPackages";
import { PackageRowClient } from "../_components/PackageRowClient";
import { PackagesFilter } from "../_components/PackagesFilter";
import { pageSocialMetadata } from "@/lib/site";

export const dynamic = "force-dynamic";

const PACKAGES_DESCRIPTION =
  "Latest versions and release histories for tracked official Unity packages - Input System, Addressables, URP, HDRP, Cinemachine, Burst, and more - sourced from the Unity package registry.";

export const metadata = {
  title: "Packages",
  description: PACKAGES_DESCRIPTION,
  alternates: { canonical: "/packages" },
  ...pageSocialMetadata({
    title: "Packages",
    description: PACKAGES_DESCRIPTION,
    path: "/packages"
  })
};

type PackageRow = {
  name: string;
  display_name: string | null;
  description: string | null;
  source_url: string;
  latest_version: string | null;
  latest_published_at: string | null;
  latest_is_prerelease: boolean | null;
  latest_unity_compatibility: string | null;
  unified_unity_minor: string | null;
  unified_version: string | null;
};

type SearchParams = Promise<{
  q?: string;
  scope?: string;
  channel?: string;
  sort?: string;
}>;

type SortKey = "name_asc" | "name_desc" | "updated_desc" | "updated_asc";
type ScopeKey = "all" | "manifest";
type ChannelKey = "all" | "stable" | "prerelease";

const SORT_LABELS: Record<SortKey, string> = {
  name_asc: "Package A-Z",
  name_desc: "Package Z-A",
  updated_desc: "Updated newest",
  updated_asc: "Updated oldest"
};

export default async function PackagesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = normalizeQuery(params.q);
  const scope = parseScope(params.scope);
  const channel = parseChannel(params.channel);
  const sort = parseSort(params.sort);

  const [allPackages, userPackages, bundledVersions] = await Promise.all([
    safeListPackages() as Promise<PackageRow[]>,
    getUserPackages(),
    safeBundledVersions()
  ]);
  const userSet = new Set(userPackages);
  const filtered = sortPackages(
    allPackages.filter((pkg) => matchesPackage(pkg, { q, scope, channel, userSet })),
    sort
  );

  return (
    <>
      <section className="page-header">
        <div className="page-header__title-row">
          <h1>All Packages</h1>
        </div>
        <p>
          Showing <strong>{filtered.length.toLocaleString()}</strong> of{" "}
          <strong>{allPackages.length.toLocaleString()}</strong> official Unity packages.
          Search, filter, and click column names to sort.
        </p>
      </section>

      <div className="packages-settings">
        <SidebarUserPackages packages={userPackages} />
      </div>

      <PackagesFilter
        q={q}
        scope={scope}
        channel={channel}
        sort={sort}
        manifestPackagesCount={userSet.size}
      />

      <div className="packages-results">
        <div className="list-toolbar">
          <span className="list-toolbar__count">
            <strong>{filtered.length.toLocaleString()}</strong> packages
            {q ? <> matching <code>{q}</code></> : null}
            {" · "}
            {SORT_LABELS[sort]}
          </span>
        </div>

        {/* tabIndex lets keyboard users scroll the 720px-min table
            horizontally between the tablet breakpoints. */}
        <div className="table-wrap" role="region" aria-label="Package list" tabIndex={0}>
          <table className="dense-table packages-table">
            <thead>
              <tr>
                <th scope="col">
                  <SortLink field="name" currentSort={sort} q={q} scope={scope} channel={channel}>
                    Package
                  </SortLink>
                </th>
                <th scope="col" style={{ width: 140 }}>Latest</th>
                <th scope="col" style={{ width: 130 }}>
                  <SortLink field="updated" currentSort={sort} q={q} scope={scope} channel={channel}>
                    Updated
                  </SortLink>
                </th>
                <th scope="col" style={{ width: 120 }}>Channel</th>
                <th scope="col" style={{ width: 120 }}>Links</th>
                <th scope="col" style={{ width: 36 }}>
                  <span className="visually-hidden">Open release notes</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((pkg) => {
                const frozen = isRegistryFrozen(pkg.latest_published_at);
                const bundled = frozen ? bundledVersions.get(pkg.name) : undefined;
                // Unity 6.4+ "unified versioning": only surface when the
                // docs/Editor-aligned version is genuinely *newer* than the
                // registry latest (i.e. the registry is serving an older line,
                // as for entities 1.4.x vs 6.4.0). Skips packages that already
                // version per-Unity on the registry (AR Foundation) or whose
                // docs path matched the package's own historical 6.x.
                const unified =
                  pkg.unified_version && isNewerVersion(pkg.unified_version, pkg.latest_version)
                    ? pkg.unified_version
                    : null;
                return (
                <PackageRowClient
                  key={pkg.name}
                  packageName={pkg.name}
                  displayName={pkg.display_name}
                  registryUrl={pkg.source_url}
                >
                  <td>
                    <strong>{pkg.display_name ?? pkg.name}</strong>
                    <div className="muted package-table__name">{pkg.name}</div>
                    {bundled ? (
                      <div className="package-table__bundled">
                        Bundled with Editor · <strong>{bundled.toVersion}</strong> as of{" "}
                        {bundled.editorVersion}
                        {" — "}last registry release {pkg.latest_version ?? "-"}
                        {pkg.latest_published_at ? `, ${formatMonthYear(pkg.latest_published_at)}` : ""}
                      </div>
                    ) : null}
                    {unified && pkg.unified_unity_minor ? (
                      <div className="package-table__unified">
                        <span>
                          Unity {pkg.unified_unity_minor}: <strong>{unified}</strong>
                        </span>
                        {" · "}
                        <span>
                          Unity {earlierUnityRange(pkg.unified_unity_minor)}:{" "}
                          <strong>{pkg.latest_version ?? "-"}</strong> (registry)
                        </span>
                        <span className="package-table__unified-hint">
                          {" "}— same package, renumbered to match the Editor in{" "}
                          {pkg.unified_unity_minor}
                        </span>
                      </div>
                    ) : null}
                  </td>
                  <td data-label="Latest">
                    <span className="chip chip--package tabnums">{pkg.latest_version ?? "-"}</span>
                  </td>
                  <td data-label="Updated">
                    <span className="muted tabnums">
                      {pkg.latest_published_at ? formatDate(pkg.latest_published_at) : "-"}
                    </span>
                    {bundled ? (
                      <span
                        className="chip chip--frozen"
                        title={`Unity 6 moved ${pkg.name} into the Editor as a version-bound core package. It no longer publishes to the package registry - its version advances with the Editor. Last independent registry release: ${pkg.latest_version ?? "?"}. Currently ships as ${bundled.toVersion} (as of ${bundled.editorVersion}).`}
                      >
                        Bundled with Editor
                      </span>
                    ) : frozen ? (
                      <span
                        className="chip chip--frozen"
                        title="No registry release since before Unity 6 (2024). This package is likely Editor-bundled/version-bound in Unity 6, so packages.unity.com no longer reflects its current version - check the Unity 6 / Editor docs."
                      >
                        Frozen
                      </span>
                    ) : null}
                  </td>
                  <td data-label="Channel">
                    {pkg.latest_is_prerelease ? (
                      <span className="chip chip--impact-known_issue">Pre</span>
                    ) : (
                      <span className="muted text-xs">
                        Stable
                      </span>
                    )}
                  </td>
                  <td data-label="Links">
                    <span className="cluster">
                      <ExternalLink href={pkg.source_url}>Registry</ExternalLink>
                    </span>
                  </td>
                </PackageRowClient>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <h2>No packages match these filters.</h2>
          <p>Clear the search or broaden the filters to see the full package index.</p>
        </div>
      ) : null}
    </>
  );
}

function SortLink({
  field,
  currentSort,
  q,
  scope,
  channel,
  children
}: {
  field: "name" | "updated";
  currentSort: SortKey;
  q: string;
  scope: ScopeKey;
  channel: ChannelKey;
  children: ReactNode;
}) {
  const nextSort = nextSortFor(field, currentSort);
  const active = currentSort.startsWith(field === "name" ? "name_" : "updated_");
  const direction = currentSort.endsWith("_asc") ? "asc" : "desc";
  const href = packageHref({ q, scope, channel, sort: nextSort });
  return (
    <a
      className="sort-link"
      href={href}
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : undefined}
    >
      {children}
      <span aria-hidden="true">{active ? (direction === "asc" ? "↑" : "↓") : "↕"}</span>
    </a>
  );
}

function nextSortFor(field: "name" | "updated", currentSort: SortKey): SortKey {
  if (field === "name") {
    return currentSort === "name_asc" ? "name_desc" : "name_asc";
  }
  return currentSort === "updated_desc" ? "updated_asc" : "updated_desc";
}

function packageHref(input: { q: string; scope: ScopeKey; channel: ChannelKey; sort: SortKey }) {
  const params = new URLSearchParams();
  if (input.q) params.set("q", input.q);
  if (input.scope !== "all") params.set("scope", input.scope);
  if (input.channel !== "all") params.set("channel", input.channel);
  if (input.sort !== "updated_desc") params.set("sort", input.sort);
  const query = params.toString();
  return query ? `/packages?${query}` : "/packages";
}

function matchesPackage(
  pkg: PackageRow,
  input: { q: string; scope: ScopeKey; channel: ChannelKey; userSet: Set<string> }
) {
  if (input.scope === "manifest" && !input.userSet.has(pkg.name)) return false;
  if (input.channel === "stable" && pkg.latest_is_prerelease) return false;
  if (input.channel === "prerelease" && !pkg.latest_is_prerelease) return false;
  if (!input.q) return true;

  const haystack = [
    pkg.name,
    pkg.display_name ?? "",
    pkg.description ?? "",
    pkg.latest_version ?? "",
    pkg.latest_unity_compatibility ?? ""
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(input.q.toLowerCase());
}

function sortPackages(packages: PackageRow[], sort: SortKey) {
  return [...packages].sort((a, b) => {
    if (sort === "name_asc" || sort === "name_desc") {
      const result = packageLabel(a).localeCompare(packageLabel(b), undefined, {
        sensitivity: "base"
      });
      return sort === "name_asc" ? result : -result;
    }

    const result = timeValue(a.latest_published_at) - timeValue(b.latest_published_at);
    if (result === 0) {
      return packageLabel(a).localeCompare(packageLabel(b), undefined, { sensitivity: "base" });
    }
    return sort === "updated_asc" ? result : -result;
  });
}

function packageLabel(pkg: PackageRow) {
  return pkg.display_name ?? pkg.name;
}

function timeValue(value: string | null) {
  return value ? new Date(value).getTime() : 0;
}

function parseSort(value: string | undefined): SortKey {
  if (value === "name_asc" || value === "name_desc" || value === "updated_asc") return value;
  return "updated_desc";
}

function parseScope(value: string | undefined): ScopeKey {
  return value === "manifest" ? "manifest" : "all";
}

function parseChannel(value: string | undefined): ChannelKey {
  if (value === "stable" || value === "prerelease") return value;
  return "all";
}

function normalizeQuery(value: string | undefined) {
  return (value ?? "").trim();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function formatMonthYear(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short"
  });
}

async function safeListPackages() {
  try {
    return await listPackages(10000);
  } catch {
    return [];
  }
}

async function safeBundledVersions(): Promise<Map<string, EditorBundledVersion>> {
  try {
    return await getEditorBundledVersions();
  } catch {
    return new Map();
  }
}
