import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ProductUpdateFilters,
  ProductUpdateFamilyNav,
  ProductUpdateFreshnessNotice,
  ProductUpdateList,
  ProductUpdatesUnavailable
} from "../../_components/ProductUpdateViews";
import {
  loadProductUpdates,
  parseProductUpdateFilters,
  parseProductUpdatePage,
  requireProductUpdateUi
} from "../../_data";
import {
  getProductUpdateFamily,
  getProductUpdatePrimaryAction
} from "@/lib/product-updates/catalog";
import type { ProductUpdateFamily } from "@/lib/product-updates/types";
import { getUnityProductBySlug } from "@/lib/product-updates/repositories";
import { pageSocialMetadata } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params
}: {
  params: Promise<{ product: string }>;
}): Promise<Metadata> {
  const { product: productSlug } = await params;
  const product = await getUnityProductBySlug(productSlug).catch(() => null);
  if (!product) {
    return { robots: { index: false, follow: false } };
  }
  const title = `${product.displayName} Updates`;
  const description =
    product.description || `Validated ${product.displayName} release history.`;
  const path = `/updates/products/${encodeURIComponent(product.slug)}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    ...pageSocialMetadata({ title, description, path })
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
  const rawSearchParams = await searchParams;
  const filters = parseProductUpdateFilters(rawSearchParams);
  const page = parseProductUpdatePage(rawSearchParams);
  const data = await loadProductUpdates({
    ...filters,
    product: productSlug,
    limit: 100,
    page,
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
        status={product.status}
        lastValidatedAt={product.lastValidatedAt}
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
        total={data.total}
        page={data.page}
        pageSize={data.pageSize}
        baseHref={`/updates/products/${product.slug}`}
        filters={filters}
      />
    </>
  );
}

function ProductPageHeader({
  productName,
  description,
  canonicalUrl,
  primaryAction,
  status,
  lastValidatedAt
}: {
  productName: string;
  description?: string;
  canonicalUrl?: string | null;
  primaryAction?: { href: string; label: string } | null;
  status?: string;
  lastValidatedAt?: string | null;
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
      <ProductUpdateFreshnessNotice
        status={status ?? "active"}
        lastValidatedAt={lastValidatedAt}
      />
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
