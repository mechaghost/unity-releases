import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ProductUpdateFilters,
  ProductUpdateFamilyNav,
  ProductUpdateList,
  ProductUpdatesUnavailable
} from "../../_components/ProductUpdateViews";
import {
  loadProductUpdates,
  parseProductUpdateFilters,
  requireProductUpdateUi
} from "../../_data";
import {
  getProductUpdateFamily,
  getProductUpdatePrimaryAction
} from "@/lib/product-updates/catalog";
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
  params,
  searchParams
}: {
  params: Promise<{ product: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  requireProductUpdateUi();
  const { product: productSlug } = await params;
  const filters = parseProductUpdateFilters(await searchParams);
  const data = await loadProductUpdates({
    ...filters,
    product: productSlug,
    limit: 100,
    includeFacets: true
  });
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
  const primaryAction = getProductUpdatePrimaryAction(product);

  return (
    <>
      <ProductPageHeader
        productName={product.displayName}
        description={product.description}
        canonicalUrl={product.canonicalUrl}
        primaryAction={primaryAction}
      />
      {family ? (
        <ProductUpdateFamilyNav
          activeFamily={family.key as ProductUpdateFamily}
        />
      ) : (
        <ProductUpdateFamilyNav />
      )}
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
        clearHref={`/updates/products/${product.slug}`}
        showProduct={false}
      />
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
  canonicalUrl,
  primaryAction
}: {
  productName: string;
  description?: string;
  canonicalUrl?: string | null;
  primaryAction?: { href: string; label: string } | null;
}) {
  return (
    <section className="page-header product-updates-header">
      <div className="page-header__title-row">
        <div>
          <span className="product-updates-eyebrow">Product release history</span>
          <h1>{productName}</h1>
        </div>
        {primaryAction ? (
          <a
            className="btn btn--primary"
            href={primaryAction.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {primaryAction.label}
          </a>
        ) : canonicalUrl ? (
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
