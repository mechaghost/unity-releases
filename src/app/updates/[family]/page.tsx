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
  requireProductUpdateUi
} from "../_data";
import { getProductUpdateFamily } from "@/lib/product-updates/catalog";
import { pageSocialMetadata } from "@/lib/site";

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
    ...pageSocialMetadata({ title, description: family.description, path })
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
  const filters = parseProductUpdateFilters(await searchParams);
  const data = await loadProductUpdates({
    family: family.key,
    ...filters,
    limit: 60,
    includeFacets: true
  });

  return (
    <>
      <section className="page-header product-updates-header">
        <div className="page-header__title-row">
          <div>
            <span className="product-updates-eyebrow">
              {family.priority === "core-adjacent"
                ? "Editor-adjacent"
                : "Secondary intelligence"}
            </span>
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
