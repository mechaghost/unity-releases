import { ExternalLink } from "../../_components/ExternalLink";
import {
  getProductUpdatePrimaryAction,
  PRODUCT_UPDATE_FAMILY_CATALOG,
  PRODUCT_UPDATE_FAMILY_DETAILS
} from "@/lib/product-updates/catalog";
import type {
  getProductUpdateDetail,
  ProductUpdateFacets,
  listProductUpdates,
  listUnityProducts
} from "@/lib/product-updates/repositories";
import type { ProductUpdateFamily } from "@/lib/product-updates/types";

export type ProductSummary = Awaited<ReturnType<typeof listUnityProducts>>[number];
export type UpdateSummary = Awaited<ReturnType<typeof listProductUpdates>>[number];
export type UpdateDetail = NonNullable<
  Awaited<ReturnType<typeof getProductUpdateDetail>>
>;

export type ProductUpdateFilterValues = {
  product?: string;
  changeKind?: string;
  platform?: string;
  version?: string;
  channel?: string;
  from?: string;
  to?: string;
};

export function ProductUpdateFamilyNav({
  activeFamily
}: {
  activeFamily?: ProductUpdateFamily;
}) {
  return (
    <nav className="product-family-nav" aria-label="Product update families">
      <a
        href="/updates"
        className="product-family-nav__item"
        aria-current={activeFamily === undefined ? "page" : undefined}
      >
        All products
      </a>
      {PRODUCT_UPDATE_FAMILY_CATALOG.map((family) => (
        <a
          href={`/updates/${family.key}`}
          className="product-family-nav__item"
          aria-current={activeFamily === family.key ? "page" : undefined}
          key={family.key}
        >
          {family.shortName}
        </a>
      ))}
    </nav>
  );
}

export function ProductFamilyGrid({
  products
}: {
  products: ProductSummary[];
}) {
  const productCounts = new Map<ProductUpdateFamily, number>();
  const updateCounts = new Map<ProductUpdateFamily, number>();
  for (const product of products) {
    const family = product.family as ProductUpdateFamily;
    productCounts.set(family, (productCounts.get(family) ?? 0) + 1);
    updateCounts.set(family, (updateCounts.get(family) ?? 0) + product.updateCount);
  }

  return (
    <ul className="product-family-grid" aria-label="Unity product families">
      {PRODUCT_UPDATE_FAMILY_CATALOG.map((family) => (
        <li
          className="product-family-card"
          data-priority={family.priority}
          key={family.key}
        >
          <div className="product-family-card__identity">
            <span className="product-family-card__eyebrow">
              {family.priority === "core-adjacent"
                ? "Editor-adjacent"
                : "Optional intelligence"}
            </span>
            <h2>
              <a href={`/updates/${family.key}`}>{family.name}</a>
            </h2>
          </div>
          <p className="product-family-card__description">
            {family.description}
          </p>
          <dl className="product-family-card__counts">
            <div>
              <dt>Products</dt>
              <dd>{(productCounts.get(family.key) ?? 0).toLocaleString()}</dd>
            </div>
            <div>
              <dt>Updates</dt>
              <dd>{(updateCounts.get(family.key) ?? 0).toLocaleString()}</dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
}

export function ProductGrid({
  products,
  emptyMessage = "No products have been published in this family yet."
}: {
  products: ProductSummary[];
  emptyMessage?: string;
}) {
  if (products.length === 0) {
    return (
      <div className="empty-state product-updates-empty">
        <h2>No product updates yet.</h2>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <details className="product-directory">
      <summary>
        Browse {products.length.toLocaleString()} tracked{" "}
        {products.length === 1 ? "product" : "products"}
      </summary>
      <ul className="product-grid" aria-label="Unity products">
        {products.map((product) => (
          <li className="product-card" key={product.productKey}>
            <div>
              <span className="product-card__family">
                {PRODUCT_UPDATE_FAMILY_DETAILS[
                  product.family as ProductUpdateFamily
                ]?.shortName ?? product.family}
              </span>
              <h2>
                <a href={`/updates/products/${product.slug}`}>
                  {product.displayName}
                </a>
              </h2>
              {product.description ? <p>{product.description}</p> : null}
            </div>
            <div className="product-card__meta">
              <span>
                <strong>{product.updateCount.toLocaleString()}</strong>{" "}
                {product.updateCount === 1 ? "update" : "updates"}
              </span>
              <span>
                {product.latestUpdateAt
                  ? `Latest ${formatProductUpdateDate(product.latestUpdateAt)}`
                  : "Awaiting first update"}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function ProductPrimaryActions({
  products
}: {
  products: ProductSummary[];
}) {
  const actionableProducts = products.flatMap((product) => {
    const action = getProductUpdatePrimaryAction(product);
    return action ? [{ product, action }] : [];
  });
  if (actionableProducts.length === 0) return null;

  return (
    <section
      className="product-primary-actions"
      aria-labelledby="product-primary-actions-heading"
    >
      <div className="product-primary-actions__header">
        <div>
          <span className="product-card__family">Official tools</span>
          <h2 id="product-primary-actions-heading">Get the tools</h2>
        </div>
        <p>Install or open the product, then use this page for release history.</p>
      </div>
      <ul className="product-primary-actions__list">
        {actionableProducts.map(({ product, action }) => (
          <li key={product.productKey}>
            <div>
              <h3>{product.displayName}</h3>
              <span>
                {product.updateCount.toLocaleString()}{" "}
                {product.updateCount === 1 ? "release" : "releases"} tracked
              </span>
            </div>
            <div className="product-primary-actions__buttons">
              <a
                className="btn btn--primary"
                href={action.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {action.label}
              </a>
              <a
                className="btn btn--secondary"
                href={`/updates/products/${product.slug}`}
              >
                Release history
              </a>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ProductUpdateFilters({
  values,
  facets,
  products = [],
  clearHref,
  showProduct = true
}: {
  values: ProductUpdateFilterValues;
  facets: ProductUpdateFacets;
  products?: ProductSummary[];
  clearHref: string;
  showProduct?: boolean;
}) {
  const hasFilters = Object.values(values).some(Boolean);
  return (
    <form
      className="product-update-filters"
      method="get"
      aria-label="Product update filters"
    >
      <div className="product-update-filters__fields">
        {showProduct ? (
          <FilterSelect
            label="Product"
            name="product"
            value={values.product}
            options={products.map((product) => ({
              value: product.slug,
              label: product.displayName
            }))}
          />
        ) : null}
        <FilterSelect
          label="Change kind"
          name="kind"
          value={values.changeKind}
          options={facets.changeKinds.map(option)}
        />
        <FilterSelect
          label="Platform / SDK"
          name="platform"
          value={values.platform}
          options={facets.platforms.map(option)}
        />
        <FilterSelect
          label="Version"
          name="version"
          value={values.version}
          options={facets.versions.map(option)}
        />
        <FilterSelect
          label="Channel"
          name="channel"
          value={values.channel}
          options={facets.channels.map(option)}
        />
        <label className="product-update-filters__field">
          <span>From</span>
          <input type="date" name="from" defaultValue={values.from ?? ""} />
        </label>
        <label className="product-update-filters__field">
          <span>To</span>
          <input type="date" name="to" defaultValue={values.to ?? ""} />
        </label>
      </div>
      <div className="product-update-filters__actions">
        <button className="btn btn--primary" type="submit">
          Apply filters
        </button>
        {hasFilters ? (
          <a className="btn btn--secondary" href={clearHref}>
            Clear
          </a>
        ) : null}
      </div>
    </form>
  );
}

function FilterSelect({
  label,
  name,
  value,
  options
}: {
  label: string;
  name: string;
  value?: string;
  options: Array<{ value: string; label: string }>;
}) {
  const normalizedOptions =
    value && !options.some((candidate) => candidate.value === value)
      ? [{ value, label: value }, ...options]
      : options;
  return (
    <label className="product-update-filters__field">
      <span>{label}</span>
      <select name={name} defaultValue={value ?? ""}>
        <option value="">All</option>
        {normalizedOptions.map((item) => (
          <option value={item.value} key={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function option(value: string) {
  return { value, label: value };
}

export function ProductUpdateList({
  updates,
  heading = "Recent updates",
  emptyMessage = "No validated updates have been published yet."
}: {
  updates: UpdateSummary[];
  heading?: string;
  emptyMessage?: string;
}) {
  return (
    <section className="product-update-section" aria-labelledby="recent-product-updates">
      <div className="product-update-section__header">
        <h2 id="recent-product-updates">{heading}</h2>
        <span>{updates.length.toLocaleString()} shown</span>
      </div>
      {updates.length === 0 ? (
        <div className="empty-state product-updates-empty">
          <h3>Nothing published yet.</h3>
          <p>{emptyMessage}</p>
        </div>
      ) : (
        <ol className="product-update-list">
          {updates.map((update) => (
            <li className="product-update-row" key={update.id}>
              <div className="product-update-row__date tabnums">
                {formatProductUpdateDate(update.releaseDate ?? update.sortTime)}
              </div>
              <div className="product-update-row__body">
                <div className="product-update-row__context">
                  <a href={`/updates/products/${update.productSlug}`}>
                    {update.productName}
                  </a>
                  {update.version ? <span>{update.version}</span> : null}
                  {update.channel ? <span>{update.channel}</span> : null}
                </div>
                <h3>
                  <a
                    href={`/updates/products/${update.productSlug}/${update.slug}`}
                  >
                    {update.title}
                  </a>
                </h3>
                {update.summary ? <p>{update.summary}</p> : null}
              </div>
              <div className="product-update-row__sources">
                {update.sourceCount} {update.sourceCount === 1 ? "source" : "sources"}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function ProductUpdateDetailView({ detail }: { detail: UpdateDetail }) {
  return (
    <>
      <div className="product-update-detail__summary">
        {detail.update.summary ? <p>{detail.update.summary}</p> : null}
        <dl>
          {detail.update.version ? (
            <div>
              <dt>Version</dt>
              <dd>{detail.update.version}</dd>
            </div>
          ) : null}
          {detail.update.releaseDate ? (
            <div>
              <dt>Released</dt>
              <dd>{formatProductUpdateDate(detail.update.releaseDate)}</dd>
            </div>
          ) : null}
          <div>
            <dt>Product</dt>
            <dd>
              <a href={`/updates/products/${detail.product.slug}`}>
                {detail.product.displayName}
              </a>
            </dd>
          </div>
        </dl>
      </div>

      <div className="product-update-observations">
        {detail.observations.map((observation) => (
          <section
            className="product-update-observation"
            aria-labelledby={`observation-${observation.id}`}
            key={observation.id}
          >
            <header>
              <div>
                <span className="product-card__family">{observation.sourceName}</span>
                <h2 id={`observation-${observation.id}`}>{observation.title}</h2>
              </div>
              <ExternalLink href={observation.sourceUrl}>Official notes</ExternalLink>
            </header>
            {observation.summary &&
            observation.summary !== detail.update.summary ? (
              <p>{observation.summary}</p>
            ) : null}
            {observation.items.length > 0 ? (
              <ol className="product-update-items">
                {observation.items.map((item) => (
                  <li key={item.itemKey}>
                    <div className="product-update-items__meta">
                      <span>{item.section}</span>
                      <span>{item.changeKind}</span>
                    </div>
                    <p>{item.body}</p>
                    {item.tags.length > 0 ? (
                      <ul className="product-update-items__tags" aria-label="Tags">
                        {item.tags.map((tag) => (
                          <li key={tag}>{tag}</li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted">
                This source publishes release-level notes without individual change
                items.
              </p>
            )}
          </section>
        ))}
      </div>
    </>
  );
}

export function ProductUpdatesUnavailable() {
  return (
    <div className="empty-state product-updates-empty">
      <h2>Product Updates is temporarily unavailable.</h2>
      <p>
        The optional product index is not configured. Editor releases, package
        intelligence, issues, and upgrade comparisons are unaffected.
      </p>
    </div>
  );
}

export function formatProductUpdateDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  });
}
