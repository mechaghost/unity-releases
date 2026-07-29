import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ProductUpdateDetailView,
  ProductUpdateFreshnessNotice,
  ProductUpdatesUnavailable
} from "../../../_components/ProductUpdateViews";
import {
  loadProductUpdateDetail,
  requireProductUpdateUi
} from "../../../_data";
import {
  getProductUpdateFamily,
  getProductUpdatePrimaryAction
} from "@/lib/product-updates/catalog";
import { getProductUpdateDetail } from "@/lib/product-updates/repositories";
import { pageSocialMetadata } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params
}: {
  params: Promise<{ product: string; update: string }>;
}): Promise<Metadata> {
  const { product, update } = await params;
  const detail = await getProductUpdateDetail(product, update).catch(() => null);
  if (!detail) {
    return { robots: { index: false, follow: false } };
  }
  const title = `${detail.product.displayName}: ${detail.update.title}`;
  const description =
    detail.update.summary ||
    `Validated ${detail.product.displayName} release notes for ${detail.update.version ?? detail.update.title}.`;
  const path = `/updates/products/${encodeURIComponent(detail.product.slug)}/${encodeURIComponent(detail.update.slug)}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    ...pageSocialMetadata({ title, description, path })
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
  const family = getProductUpdateFamily(detail.product.family);

  return (
    <>
      <nav className="product-update-breadcrumbs" aria-label="Breadcrumb">
        <a href="/updates">Product Updates</a>
        <span aria-hidden>/</span>
        {family ? (
          <>
            <a href={`/updates/${family.key}`}>{family.name}</a>
            <span aria-hidden>/</span>
          </>
        ) : null}
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
      <ProductUpdateFreshnessNotice
        status={detail.product.status}
        lastValidatedAt={detail.product.lastValidatedAt}
      />
      <ProductUpdateDetailView detail={detail} />
    </>
  );
}
