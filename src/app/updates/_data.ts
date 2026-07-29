import { notFound } from "next/navigation";
import {
  countProductUpdates,
  getProductUpdateDetail,
  listProductUpdateFacets,
  listProductUpdates,
  listUnityProducts,
  productUpdatesSchemaReady,
  type ProductUpdateFacets
} from "@/lib/product-updates/repositories";
import { productUpdateUiEnabled } from "@/lib/product-updates/flags";

export function requireProductUpdateUi() {
  if (!productUpdateUiEnabled()) notFound();
}

type ProductUpdateSearchParams = Record<
  string,
  string | string[] | undefined
>;

export function parseProductUpdateFilters(params: ProductUpdateSearchParams) {
  const text = (key: string, maximum: number) => {
    const raw = params[key];
    const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
    return value && value.length <= maximum ? value : undefined;
  };
  const date = (key: string) => {
    const value = text(key, 10);
    return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
  };
  const product = text("product", 120);
  return {
    product:
      product && /^[a-z0-9][a-z0-9-]*$/.test(product)
        ? product
        : undefined,
    changeKind: text("kind", 80),
    platform: text("platform", 80),
    version: text("version", 120),
    channel: text("channel", 80),
    from: date("from"),
    to: date("to")
  };
}

export function parseProductUpdatePage(params: ProductUpdateSearchParams) {
  const raw = params.page;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !/^\d{1,5}$/.test(value)) return 1;
  return Math.min(Math.max(Number(value), 1), 10_000);
}

export async function loadProductUpdates(options: {
  family?: string;
  product?: string;
  changeKind?: string;
  platform?: string;
  version?: string;
  channel?: string;
  from?: string;
  to?: string;
  limit?: number;
  page?: number;
  includeFacets?: boolean;
} = {}) {
  try {
    if (!(await productUpdatesSchemaReady())) return null;
    const pageSize = Math.min(Math.max(options.limit ?? 50, 1), 100);
    const page = Math.min(Math.max(options.page ?? 1, 1), 10_000);
    const listOptions = {
      family: options.family,
      product: options.product,
      changeKind: options.changeKind,
      platform: options.platform,
      version: options.version,
      channel: options.channel,
      from: options.from,
      to: options.to
    };
    const [products, updates, total, facets] = await Promise.all([
      listUnityProducts(options.family),
      listProductUpdates({
        ...listOptions,
        limit: pageSize,
        offset: (page - 1) * pageSize
      }),
      countProductUpdates(listOptions),
      options.includeFacets
        ? listProductUpdateFacets({
            family: options.family,
            product: options.product
          })
        : Promise.resolve(null)
    ]);
    return {
      products,
      updates,
      total,
      page,
      pageSize,
      facets: facets as ProductUpdateFacets | null
    };
  } catch {
    return null;
  }
}

export async function loadProductUpdateDetail(
  productSlug: string,
  updateSlug: string
) {
  try {
    if (!(await productUpdatesSchemaReady())) return undefined;
    return await getProductUpdateDetail(productSlug, updateSlug);
  } catch {
    return undefined;
  }
}
