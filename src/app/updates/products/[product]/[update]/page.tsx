import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ProductUpdateDetailView,
  ProductUpdatesUnavailable
} from "../../../_components/ProductUpdateViews";
import {
  loadProductUpdateDetail,
  requireProductUpdateUi
} from "../../../_data";
import { getProductUpdatePrimaryAction } from "@/lib/product-updates/catalog";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params
}: {
  params: Promise<{ product: string; update: string }>;
}): Promise<Metadata> {
  const { product, update } = await params;
  return {
    title: `${humanizeSlug(product)} ${update}`,
    alternates: {
      canonical: `/updates/products/${encodeURIComponent(product)}/${encodeURIComponent(update)}`
    }
  };
}

export default async function ProductUpdateDetailPage({
  params
}: {
  params: Promise<{ product: string; update: string }>;
}) {
  requireProductUpdateUi();
  const { product, update } = await params;
  const detail = await loadProductUpdateDetail(product, update);
  if (detail === undefined) {
    return (
      <>
        <section className="page-header">
          <h1>Product update</h1>
        </section>
        <ProductUpdatesUnavailable />
      </>
    );
  }
  if (detail === null) notFound();
  const primaryAction = getProductUpdatePrimaryAction(detail.product);

  return (
    <>
      <nav className="product-update-breadcrumbs" aria-label="Breadcrumb">
        <a href="/updates">Product Updates</a>
        <span aria-hidden>/</span>
        <a href={`/updates/products/${detail.product.slug}`}>
          {detail.product.displayName}
        </a>
        <span aria-hidden>/</span>
        <span aria-current="page">
          {detail.update.version ?? detail.update.title}
        </span>
      </nav>
      <section className="page-header product-updates-header">
        <div className="page-header__title-row">
          <div>
            <span className="product-updates-eyebrow">
              {detail.product.displayName}
            </span>
            <h1>{detail.update.title}</h1>
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
          ) : null}
        </div>
      </section>
      <ProductUpdateDetailView detail={detail} />
    </>
  );
}

function humanizeSlug(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
