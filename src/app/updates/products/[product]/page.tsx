import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ProductUpdateFamilyNav,
  ProductUpdateList,
  ProductUpdatesUnavailable
} from "../../_components/ProductUpdateViews";
import { loadProductUpdates, requireProductUpdateUi } from "../../_data";
import { getProductUpdateFamily } from "@/lib/product-updates/catalog";
import type { ProductUpdateFamily } from "@/lib/product-updates/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params
}: {
  params: Promise<{ product: string }>;
}): Promise<Metadata> {
  const { product } = await params;
  return {
    title: `${humanizeSlug(product)} Updates`,
    alternates: { canonical: `/updates/products/${encodeURIComponent(product)}` }
  };
}

export default async function ProductUpdateHistoryPage({
  params
}: {
  params: Promise<{ product: string }>;
}) {
  requireProductUpdateUi();
  const { product: productSlug } = await params;
  const data = await loadProductUpdates({ product: productSlug, limit: 100 });
  if (!data) {
    return (
      <>
        <ProductPageHeader productName={humanizeSlug(productSlug)} />
        <ProductUpdatesUnavailable />
      </>
    );
  }
  const product = data.products.find((candidate) => candidate.slug === productSlug);
  if (!product) notFound();
  const family = getProductUpdateFamily(product.family);

  return (
    <>
      <ProductPageHeader
        productName={product.displayName}
        description={product.description}
        canonicalUrl={product.canonicalUrl}
      />
      {family ? (
        <ProductUpdateFamilyNav
          activeFamily={family.key as ProductUpdateFamily}
        />
      ) : (
        <ProductUpdateFamilyNav />
      )}
      <ProductUpdateList
        updates={data.updates}
        heading={`${product.displayName} release history`}
        emptyMessage="The product is registered, but no validated release notes have been published."
      />
    </>
  );
}

function ProductPageHeader({
  productName,
  description,
  canonicalUrl
}: {
  productName: string;
  description?: string;
  canonicalUrl?: string | null;
}) {
  return (
    <section className="page-header product-updates-header">
      <div className="page-header__title-row">
        <div>
          <span className="product-updates-eyebrow">Product release history</span>
          <h1>{productName}</h1>
        </div>
        {canonicalUrl ? (
          <a
            className="btn btn--secondary"
            href={canonicalUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Official product page
          </a>
        ) : null}
      </div>
      {description ? <p>{description}</p> : null}
    </section>
  );
}

function humanizeSlug(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
