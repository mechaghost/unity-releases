import type { Metadata } from "next";
import {
  ProductFamilyGrid,
  ProductUpdateFamilyNav,
  ProductUpdateList,
  ProductUpdatesUnavailable
} from "./_components/ProductUpdateViews";
import { loadProductUpdates, requireProductUpdateUi } from "./_data";
import { pageSocialMetadata } from "@/lib/site";

export const dynamic = "force-dynamic";

const DESCRIPTION =
  "Validated release notes for Unity products beyond the Editor, organized by product family and kept separate from core upgrade intelligence.";

export const metadata: Metadata = {
  title: "Product Updates",
  description: DESCRIPTION,
  alternates: { canonical: "/updates" },
  ...pageSocialMetadata({
    title: "Product Updates",
    description: DESCRIPTION,
    path: "/updates"
  })
};

export default async function ProductUpdatesPage() {
  requireProductUpdateUi();
  const data = await loadProductUpdates({ limit: 40 });

  return (
    <>
      <section className="page-header product-updates-header">
        <div className="page-header__title-row">
          <div>
            <span className="product-updates-eyebrow">Secondary intelligence</span>
            <h1>Product Updates</h1>
          </div>
        </div>
        <p>
          Release notes for Unity products beyond the Editor. These sources are
          isolated from Editor ingestion, so a changing product page cannot affect
          upgrade comparisons, release search, issues, or packages.
        </p>
      </section>

      <ProductUpdateFamilyNav />

      {data ? (
        <>
          <ProductFamilyGrid products={data.products} />
          <ProductUpdateList updates={data.updates} />
        </>
      ) : (
        <ProductUpdatesUnavailable />
      )}
    </>
  );
}
