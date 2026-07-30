import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ProductGrid,
  ProductPrimaryActions,
  ProductUpdateFilters,
  ProductUpdateFamilyNav,
  ProductUpdateList,
  ProductUpdatesUnavailable
} from "../_components/ProductUpdateViews";
import {
  loadProductUpdates,
  parseProductUpdateFilters,
  parseProductUpdatePage,
  requireProductUpdateUi
} from "../_data";
import { getProductUpdateFamily } from "@/lib/product-updates/catalog";
import { pageSocialMetadata } from "@/lib/site";
import { productUpdatesSchemaReady } from "@/lib/product-updates/repositories";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params
}: {
  params: Promise<{ family: string }>;
}): Promise<Metadata> {
  const { family: familyKey } = await params;
  const family = getProductUpdateFamily(familyKey);
  if (!family) return {};
  const title = `${family.name} Updates`;
  const path = `/updates/${family.key}`;
  return {
    title,
    description: family.description,
    alternates: { canonical: path },
    ...pageSocialMetadata({ title, description: family.description, path }),
    ...((await productUpdatesSchemaReady())
      ? {}
      : { robots: { index: false, follow: false } })
  };
}

export default async function ProductUpdateFamilyPage({
  params,
  searchParams
}: {
  params: Promise<{ family: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  requireProductUpdateUi();
  const { family: familyKey } = await params;
  const family = getProductUpdateFamily(familyKey);
  if (!family) notFound();
  const rawSearchParams = await searchParams;
  const filters = parseProductUpdateFilters(rawSearchParams);
  const page = parseProductUpdatePage(rawSearchParams);
  const data = await loadProductUpdates({
    family: family.key,
    ...filters,
    limit: 60,
    page,
    includeFacets: true
  });

  return (
    <>
      <section className="page-header product-updates-header">
        <div className="page-header__title-row">
          <div>
            {/* Tier eyebrow dropped: the family name and description below
                already say what this is, and the tier label was internal
                taxonomy, not reader-facing information. */}
            <h1>{family.name} Updates</h1>
          </div>
        </div>
        <p>{family.description}</p>
      </section>

      <ProductUpdateFamilyNav activeFamily={family.key} />

      {data ? (
        <>
          <ProductPrimaryActions products={data.products} />
          <ProductUpdateFilters
            values={filters}
            facets={
              data.facets ?? {
                versions: [],
                channels: [],
                changeKinds: [],
                platforms: []
              }
            }
            products={data.products}
            clearHref={`/updates/${family.key}`}
          />
          <ProductUpdateList
            updates={data.updates}
            heading={`${family.name} release notes`}
            total={data.total}
            page={data.page}
            pageSize={data.pageSize}
            baseHref={`/updates/${family.key}`}
            filters={filters}
          />
          {family.key === "editor-tooling" ? null : (
            <ProductGrid products={data.products} />
          )}
        </>
      ) : (
        <ProductUpdatesUnavailable />
      )}
    </>
  );
}
