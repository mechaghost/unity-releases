export function productUpdateIngestionEnabled() {
  return process.env.PRODUCT_UPDATE_INGEST_ENABLED === "true";
}

export function productUpdateUiEnabled() {
  return process.env.PRODUCT_UPDATE_UI_ENABLED === "true";
}

export function productUpdateNavigationEnabled() {
  return (
    productUpdateUiEnabled() &&
    process.env.PRODUCT_UPDATE_NAV_ENABLED === "true"
  );
}
