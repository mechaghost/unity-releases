import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ProductGrid,
  ProductUpdateFamilyNav,
  ProductUpdateList,
  ProductUpdatesUnavailable
} from "../_components/ProductUpdateViews";
import { loadProductUpdates, requireProductUpdateUi } from "../_data";
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
  params
}: {
  params: Promise<{ family: string }>;
}) {
  requireProductUpdateUi();
  const { family: familyKey } = await params;
  const family = getProductUpdateFamily(familyKey);
  if (!family) notFound();
  const data = await loadProductUpdates({ family: family.key, limit: 60 });

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
          <ProductGrid products={data.products} />
          <ProductUpdateList
            updates={data.updates}
            heading={`${family.name} release notes`}
          />
        </>
      ) : (
        <ProductUpdatesUnavailable />
      )}
    </>
  );
}
