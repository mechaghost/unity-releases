import { notFound } from "next/navigation";
import {
  getProductUpdateDetail,
  listProductUpdates,
  listUnityProducts,
  productUpdatesSchemaReady
} from "@/lib/product-updates/repositories";
import { productUpdateUiEnabled } from "@/lib/product-updates/flags";

export function requireProductUpdateUi() {
  if (!productUpdateUiEnabled()) notFound();
}

export async function loadProductUpdates(options: {
  family?: string;
  product?: string;
  limit?: number;
} = {}) {
  try {
    if (!(await productUpdatesSchemaReady())) return null;
    const [products, updates] = await Promise.all([
      listUnityProducts(options.family),
      listProductUpdates({
        family: options.family,
        product: options.product,
        limit: options.limit
      })
    ]);
    return { products, updates };
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
