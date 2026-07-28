export const PRODUCT_UPDATE_FAMILIES = [
  "editor-tooling",
  "platform-services",
  "monetization",
  "industry-enterprise"
] as const;

export type ProductUpdateFamily = (typeof PRODUCT_UPDATE_FAMILIES)[number];

export type ProductUpdateTargetManifest = {
  targetKey: string;
  url: string;
  allowedHosts: readonly string[];
  retired?: boolean;
};

export type ProductUpdateAdapterManifest = {
  sourceKey: string;
  displayName: string;
  family: ProductUpdateFamily;
  parserVersion: string;
  displayPriority?: number;
  cadenceHours: number;
  timeoutMs: number;
  maxResponseBytes: number;
  minimumExpectedRecords: number;
  maximumExpectedRecords?: number;
  maximumRecordDropFraction?: number;
  targets: readonly ProductUpdateTargetManifest[];
};

export type ProductUpdateSnapshot = {
  sourceKey: string;
  targetKey: string;
  requestedUrl: string;
  finalUrl: string;
  fetchedAt: string;
  status: number;
  etag: string | null;
  lastModified: string | null;
  sha256: string;
  text: string;
};

export type NormalizedProductUpdateItem = {
  itemKey: string;
  section: string;
  changeKind: string;
  body: string;
  platforms: string[];
  tags: string[];
  sourceOrder: number;
  metadata?: Record<string, unknown>;
};

export type NormalizedProductUpdateObservation = {
  productKey: string;
  productSlug: string;
  productName: string;
  productDescription?: string;
  productCanonicalUrl?: string | null;
  componentKey: string;
  sourceUpdateKey: string;
  canonicalKey: string;
  updateSlug: string;
  version?: string | null;
  channel?: string | null;
  releaseDate?: string | null;
  title: string;
  summary?: string;
  sourceUrl: string;
  metadata?: Record<string, unknown>;
  items: NormalizedProductUpdateItem[];
};

export type ProductUpdateAdapter = {
  manifest: ProductUpdateAdapterManifest;
  parse(snapshot: ProductUpdateSnapshot): NormalizedProductUpdateObservation[];
};

export type ProductUpdateTargetState = {
  sourceId: number;
  targetId: number;
  sourceKey: string;
  targetKey: string;
  url: string;
  status: string;
  failureKind: ProductUpdateFailureKind | null;
  nextDueAt: string | null;
  circuitOpenUntil: string | null;
  validatedEtag: string | null;
  validatedLastModified: string | null;
  validatedBodyHash: string | null;
  validatedParserVersion: string | null;
  validatedSnapshotId: number | null;
  observedSnapshotId: number | null;
  publishedParserVersion: string | null;
  lastValidatedRecordCount: number | null;
};

export type ProductUpdateFailureKind =
  | "transient"
  | "rate-limited"
  | "access-configuration-blocked"
  | "not-found-candidate"
  | "parser-drift"
  | "unknown";

export type ProductUpdateFetchResult =
  | {
      kind: "not-modified";
      requestedUrl: string;
      finalUrl: string;
      status: 304;
      etag: string | null;
      lastModified: string | null;
    }
  | {
      kind: "content";
      requestedUrl: string;
      finalUrl: string;
      status: number;
      etag: string | null;
      lastModified: string | null;
      sha256: string;
      text: string;
    };

export type ProductUpdateRunResult = {
  sourceKey: string;
  targetKey: string;
  status:
    | "success"
    | "not-modified"
    | "dry-run"
    | "skipped-disabled"
    | "skipped-not-due"
    | "skipped-overlap"
    | "skipped-circuit-open"
    | "skipped-retired"
    | "not-configured"
    | "failed"
    | "quarantined";
  recordsObserved: number;
  recordsCreated: number;
  recordsUpdated: number;
  snapshotId?: number;
  error?: string;
};
