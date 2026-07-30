import type { Metadata } from "next";
import {
  ProductFamilyGrid,
  ProductUpdateFamilyNav,
  ProductUpdateList,
  ProductUpdatesUnavailable
} from "./_components/ProductUpdateViews";
import {
  loadProductUpdates,
  parseProductUpdatePage,
  requireProductUpdateUi
} from "./_data";
import { pageSocialMetadata } from "@/lib/site";
import { productUpdatesSchemaReady } from "@/lib/product-updates/repositories";

export const dynamic = "force-dynamic";

const DESCRIPTION =
  "Validated release notes for Unity products beyond the Editor, organized by product family and kept separate from core upgrade intelligence.";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Product Updates",
    description: DESCRIPTION,
    alternates: { canonical: "/updates" },
    ...pageSocialMetadata({
      title: "Product Updates",
      description: DESCRIPTION,
      path: "/updates"
    }),
    ...((await productUpdatesSchemaReady())
      ? {}
      : { robots: { index: false, follow: false } })
  };
}

export default async function ProductUpdatesPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  requireProductUpdateUi();
  const page = parseProductUpdatePage(await searchParams);
  const data = await loadProductUpdates({ limit: 40, page });

  return (
    <>
      <section className="page-header product-updates-header">
        <div className="page-header__title-row">
          <div>
            {/* No tier eyebrow here - it ranked the page for us rather than
                telling the reader anything; the paragraph below already
                explains what this section is and isn't. */}
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
          <ProductUpdateList
            updates={data.updates}
            total={data.total}
            page={data.page}
            pageSize={data.pageSize}
            baseHref="/updates"
          />
        </>
      ) : (
        <ProductUpdatesUnavailable />
      )}
    </>
  );
}
