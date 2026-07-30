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
import {
  groupProductUpdateItems,
  humanizeProductUpdateValue,
  productUpdateClassName
} from "@/lib/product-updates/presentation";
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

export function ProductUpdateFreshnessNotice({
  status,
  lastValidatedAt
}: {
  status: string;
  lastValidatedAt?: string | null;
}) {
  if (status === "active") return null;
  return (
    <div className="product-update-freshness" role="status">
      <strong>Updates may be delayed.</strong>{" "}
      <span>
        Showing the last validated release data
        {lastValidatedAt
          ? ` from ${formatProductUpdateDate(lastValidatedAt)}`
          : ""}
        .
      </span>
    </div>
  );
}

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
          {/* No tier eyebrow: the old editor-adjacent / optional-intelligence
              labels restated what the family name already says (Platform &
              Services, Monetization), so they were noise above every card.
              `data-priority` still drives the card's accent styling. */}
          <div className="product-family-card__identity">
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
              {product.status !== "active" ? (
                <span className="product-update-status">Delayed</span>
              ) : null}
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
  const actionableProducts = products
    .filter((product) => product.family === "editor-tooling")
    .flatMap((product) => {
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
                {product.displayName} release history
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
  emptyMessage = "No validated updates have been published yet.",
  total = updates.length,
  page = 1,
  pageSize = Math.max(updates.length, 1),
  baseHref,
  filters = {}
}: {
  updates: UpdateSummary[];
  heading?: string;
  emptyMessage?: string;
  total?: number;
  page?: number;
  pageSize?: number;
  baseHref?: string;
  filters?: ProductUpdateFilterValues;
}) {
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const firstShown = updates.length > 0 ? (page - 1) * pageSize + 1 : 0;
  const lastShown = updates.length > 0 ? firstShown + updates.length - 1 : 0;
  return (
    <section className="product-update-section" aria-labelledby="recent-product-updates">
      <div className="product-update-section__header">
        <h2 id="recent-product-updates">{heading}</h2>
        <span>
          {updates.length > 0
            ? `Showing ${firstShown.toLocaleString()}–${lastShown.toLocaleString()} of ${total.toLocaleString()}`
            : `0 of ${total.toLocaleString()}`}
        </span>
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
              {/* Only a real upstream release date goes in the date slot.
                  `sortTime` falls back to when WE first saw the row, so
                  rendering it here told readers an old adapter version
                  shipped today (every LevelPlay adapter shares one ingest
                  timestamp). Dateless rows say so instead. */}
              <div className="product-update-row__date tabnums">
                {update.releaseDate ? (
                  formatProductUpdateDate(update.releaseDate)
                ) : (
                  <span
                    className="product-update-row__date-unknown"
                    title="This source does not publish release dates; sorted by when it was first indexed."
                  >
                    No date
                  </span>
                )}
              </div>
              <div className="product-update-row__body">
                <div className="product-update-row__context">
                  <a href={`/updates/products/${update.productSlug}`}>
                    {update.productName}
                  </a>
                  {update.productStatus !== "active" ? (
                    <span
                      className="product-update-status"
                      title={
                        update.lastValidatedAt
                          ? `Last validated ${formatProductUpdateDate(update.lastValidatedAt)}`
                          : "No successful validation recorded"
                      }
                    >
                      Delayed
                    </span>
                  ) : null}
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
      {baseHref && totalPages > 1 ? (
        <nav className="product-update-pagination" aria-label={`${heading} pages`}>
          {page > 1 ? (
            <a
              className="btn btn--secondary"
              href={productUpdatePageHref(baseHref, filters, page - 1)}
              rel="prev"
            >
              Previous
            </a>
          ) : (
            <span />
          )}
          <span>
            Page {page.toLocaleString()} of {totalPages.toLocaleString()}
          </span>
          {page < totalPages ? (
            <a
              className="btn btn--secondary"
              href={productUpdatePageHref(baseHref, filters, page + 1)}
              rel="next"
            >
              Next
            </a>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </section>
  );
}

function productUpdatePageHref(
  baseHref: string,
  filters: ProductUpdateFilterValues,
  page: number
) {
  const params = new URLSearchParams();
  const values: Array<[string, string | undefined]> = [
    ["product", filters.product],
    ["kind", filters.changeKind],
    ["platform", filters.platform],
    ["version", filters.version],
    ["channel", filters.channel],
    ["from", filters.from],
    ["to", filters.to]
  ];
  for (const [key, value] of values) {
    if (value) params.set(key, value);
  }
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `${baseHref}?${query}` : baseHref;
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
        {detail.observations.map((observation) => {
          const itemGroups = groupProductUpdateItems(
            observation.items,
            detail.update.summary
          );
          return (
            <section
              className="product-update-observation"
              aria-labelledby={`observation-${observation.id}`}
              key={observation.id}
            >
              <header>
                <div>
                  <span className="product-card__family">
                    {observation.sourceName}
                  </span>
                  <h2 id={`observation-${observation.id}`}>
                    {observation.title}
                  </h2>
                </div>
                <ExternalLink href={observation.sourceUrl}>
                  Official notes
                </ExternalLink>
              </header>
              {observation.summary &&
              observation.summary !== detail.update.summary ? (
                <p>{observation.summary}</p>
              ) : null}
              {itemGroups.length > 0 ? (
                <div className="product-update-sections">
                  {itemGroups.map((group) => (
                    <section
                      className="product-update-section-group"
                      aria-labelledby={`observation-${observation.id}-${group.id}`}
                      key={group.id}
                    >
                      <h3 id={`observation-${observation.id}-${group.id}`}>
                        {group.section}
                      </h3>
                      {group.items.length > 0 ? (
                        <ol className="product-update-items">
                          {group.items.map((item) => (
                            <li key={item.itemKey}>
                              <span
                                className="product-update-item__kind"
                                data-kind={productUpdateClassName(item.changeKind)}
                              >
                                {humanizeProductUpdateValue(item.changeKind)}
                              </span>
                              <div className="product-update-item__content">
                                <p>{item.body}</p>
                                {item.platforms.length > 0 ? (
                                  <ul
                                    className="product-update-item__platforms"
                                    aria-label="Platforms"
                                  >
                                    {item.platforms.map((platform) => (
                                      <li key={platform}>{platform}</li>
                                    ))}
                                  </ul>
                                ) : null}
                              </div>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p className="product-update-section-group__empty">
                          {group.emptyMessage}
                        </p>
                      )}
                    </section>
                  ))}
                </div>
              ) : (
                <p className="muted">
                  This source publishes release-level notes without additional
                  change items.
                </p>
              )}
            </section>
          );
        })}
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
