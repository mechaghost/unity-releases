# Unity Product Updates — Implementation Plan

> **Status:** Approved; execution in progress
>
> **Working branch:** `codex/product-updates-ia`
>
> **Merge target:** `main`, only after the final regression review and explicit approval
>
> **Deployment:** Out of scope for this plan. Do not update `release` until the completed branch has been merged and separately approved for deployment.

## 1. Outcome

Add Unity Hub and the other identified Unity product changelogs without weakening the app's primary purpose: Unity Engine and Editor release intelligence.

The implementation must:

- keep every current route, API, ingestion job, and Editor workflow;
- keep Editor releases, packages, release-note search, issue analysis, and upgrade intelligence visually dominant;
- place new changelogs in a separate Product Updates domain;
- isolate every new source so one source can fail, move, change format, or disappear without affecting another source or any core ingestion;
- preserve the last known-good data when a source fails validation;
- ship in independently reviewable and reversible phases on `codex/product-updates-ia`;
- prove the existing product still works before adding new behavior and after every phase.

This is an additive program, not a rewrite of the current release tracker.

---

## 2. Locked constraints

### Branch and release safety

- Perform all implementation on `codex/product-updates-ia`.
- Use checkpoint commits for every phase and source family.
- Do not merge to `main` as part of implementation.
- Do not push or update the Railway `release` branch.
- Before merge approval, review `git diff main...codex/product-updates-ia` and run the complete verification matrix in §12.

### Core preservation

The following behavior is frozen unless a phase explicitly names an additive change:

- `/` and `/compare`: Upgrade Intelligence.
- `/releases` and `/releases/[version]`: Editor release index and detail.
- `/visualizer`: Editor release visualization.
- `/explorer`: Editor release-note search.
- `/issues` and `/issues/[issueId]`: Editor issue intelligence.
- `/packages`: official package intelligence.
- `/upgrade`: compatibility redirect.
- `/github`, `/discussions`, `/timeline`, `/news`, `/resources`, `/stats`, and `/faq`.
- `/compare.md`, `/llms.txt`, `/robots.txt`, and `/sitemap.xml`.
- `/api/events`, `/api/health`, `/api/packages`, `/api/packages/[name]/versions`,
  `/api/release-notes`, `/api/releases`, and `/api/track`.
- `npm run ingest:editor`, `ingest:legacy-lts`, `ingest:packages`, `ingest:package-docs`, and `ingest:all`.
- Existing Editor tables, package tables, scoring rules, search indexes, and freshness semantics.

Existing routes may move under visible navigation headings, but their paths, labels, links, and behavior must remain present. The existing `Search Notes` label remains unchanged.

### Explicit non-goals

- Do not place Hub or product changelogs in `unity_releases` or `release_note_items`.
- Do not refactor `withIngestionTransaction` or retrofit the core ingestion jobs.
- Do not replace the current schema application process with a new migration framework.
- Do not merge product updates into Editor comparisons, upgrade scores, Editor search results, or package compatibility calculations.
- Do not automatically enable new URLs discovered from a sitemap.
- Do not automatically delete stored updates when a Unity page stops listing them.
- Do not expose or render raw source HTML.

---

## 3. Regression baseline

The branch was created from a clean `main` worktree. The pre-change baseline is:

| Check | Baseline |
|---|---|
| `npm test` | 54 files passed; 532 tests passed; 3 opt-in live contract tests skipped |
| `npm run typecheck` | Passed when run serially after the build |
| `npm run build` | Passed |
| Git worktree | Clean |

Do not run `npm run typecheck` concurrently with `npm run build`. Both access `.next/types`, and a concurrent run can report missing generated files even when the code is valid.

Phase 0 must turn this informal baseline into a committed regression contract before product-update code is added.

---

## 4. Information architecture

### Naming rule

- **Release** means a Unity Engine or Editor release.
- **Update** means a Hub, service, SDK, monetization, industry, or enterprise product changelog entry.

The app must not use “release” as the top-level label for the new product domain.

### Navigation hierarchy

The current left navigation gains visible section labels.

#### Engine & Editor — primary

- Upgrade Intelligence
- Editor Releases
- Release Visualizer
- Search Notes
- Issue Explorer
- Packages
- Editor Tooling Updates

`Editor Tooling Updates` is the only product-update link allowed in the primary section. It opens the Editor-adjacent family containing Hub and CLI. Licensing Server belongs to platform and development infrastructure because its primary workflow is organizational license administration.

#### Unity Products — secondary

- Product Updates

This is one entry, not one sidebar item per Unity product. The landing page contains the lower-priority source families.

#### Community & reference — supporting

- Unity GitHub
- Staff Discussions
- Activity Feed
- News
- Resources
- Stats
- FAQ

Every existing destination remains linked.

### Route hierarchy

Keep all existing routes unchanged. Add:

```text
/updates
/updates/[family]
/updates/products/[product]
/updates/products/[product]/[update]
```

Allowed family slugs:

```text
editor-tooling
platform-services
monetization
industry-enterprise
```

Examples:

```text
/updates/editor-tooling
/updates/products/unity-hub
/updates/products/unity-hub/3.14.0
/updates/products/vivox-core
/updates/products/levelplay-unity
/updates/products/asset-transformer
```

Family routes are browse filters. Canonical product and update URLs are family-independent, so a future Unity reorganization does not break stable URLs. Product and update slugs are stored, URL-safe, collision-resistant identifiers rather than normalized titles.

Exactly one sidebar item owns `aria-current="page"` for each path:

- `Editor Tooling Updates` owns `/updates/editor-tooling`;
- `Product Updates` owns `/updates`, every other family route, and all canonical product/update routes;
- no matcher may mark both items active.

### Product Updates landing page

`/updates` renders the families in this order:

1. Editor tooling
2. Platform and services
3. Monetization
4. Industry and enterprise

Each family shows:

- family description;
- number of tracked products;
- most recent update;
- freshness or degraded-source indicator;
- compact links to product histories.

The page must use the existing dense list and filter conventions. Do not introduce a marketing-style card grid.

### Family and product pages

Family pages support:

- product filter;
- update kind;
- platform or SDK;
- version or channel where available;
- date range;
- explicit result count.

Product pages show a compact chronological history. Update detail pages show normalized sections and links to every supporting Unity source.

### Activity Feed and API compatibility

- The default `/timeline` result must contain the same event classes and ordering it contains before this project.
- Product updates are opt-in through a new filter.
- Existing `/api/events` behavior remains unchanged by default.
- If product updates become available through `/api/events`, require an explicit scope parameter. A dedicated `/api/updates` endpoint is preferred.
- Product updates never affect the Editor filters on `/explorer`.

---

## 5. Source catalog and priority

### Family 1: Editor tooling

| Source key | Product | Initial cadence | Priority |
|---|---|---:|---|
| `unity-hub` | Unity Hub | Every 6 hours | Highest new-source priority |
| `unity-cli` | Unity CLI | Every 6 hours | Highest new-source priority |

### Family 2: Platform and services

| Source key | Product | Initial cadence | Notes |
|---|---|---:|---|
| `unity-version-control` | Unity Version Control | Daily | Plastic/UVCS history |
| `asset-manager` | Unity Asset Manager | Daily | Cloud product updates |
| `licensing-server` | Unity Licensing Server | Daily | Development infrastructure |
| `ugs` | Unity Gaming Services | Daily | Aggregate service feed |
| `vivox-unity` | Vivox Unity SDK | Daily | May overlap UGS |
| `vivox-core` | Vivox Core SDK | Daily | Separate SDK identity |
| `vivox-unreal` | Vivox Unreal SDK | Daily | Separate SDK identity |

### Family 3: Monetization

| Source key | Product | Initial cadence | Notes |
|---|---|---:|---|
| `unity-ads-unity` | Unity Ads Unity SDK | Daily | Separate platform history |
| `unity-ads-android` | Unity Ads Android SDK | Daily | Separate platform history |
| `unity-ads-ios` | Unity Ads iOS SDK | Daily | Separate platform history |
| `levelplay-unity` | LevelPlay Unity SDK | Daily | Separate failure boundary |
| `levelplay-android` | LevelPlay Android SDK | Daily | Separate failure boundary |
| `levelplay-ios` | LevelPlay iOS SDK | Daily | Separate failure boundary |
| Assigned in Phase 5 inventory | LevelPlay mediation adapters | Daily | Checked-in allowlist; one stable source key and state record per page |

Only add an IAP documentation adapter if its changelog contains information that is not already represented by the package registry. If it duplicates package versions, attach it as evidence rather than emitting a second update.

### Family 4: Industry and enterprise

| Source key | Product | Initial cadence | Notes |
|---|---|---:|---|
| `unity-studio` | Unity Studio | Daily | Volatile product surface |
| `asset-transformer` | Asset Transformer/Pixyz | Weekly | Versioned documentation |
| `vpc-aws` | Virtual Private Cloud for AWS | Weekly | Independent source |
| `vpc-on-premises` | Virtual Private Cloud on-premises | Weekly | Independent source |
| `vpctl` | VPC command-line tool | Weekly | Independent source |

Cadence is adapter configuration, not parser logic. It can change without changing normalized data.

---

## 6. Additive architecture

### New module boundary

Add:

```text
src/lib/product-updates/
  types.ts
  registry.ts
  runner.ts
  validation.ts
  normalization.ts
  repositories.ts
  sources/
    unity-hub.ts
    unity-cli.ts
    licensing-server.ts
    unity-version-control.ts
    asset-manager.ts
    ugs.ts
    vivox-unity.ts
    vivox-core.ts
    vivox-unreal.ts
    unity-ads-*.ts
    levelplay-*.ts
    unity-studio.ts
    asset-transformer.ts
    vpc-aws.ts
    vpc-on-premises.ts
    vpctl.ts
```

Add independent entrypoints:

```text
src/jobs/poll-product-update.ts
src/jobs/poll-product-update-group.ts
```

Do not import the product-update runner from a core ingestion job.

### Adapter contract

Each adapter implements one shared contract:

```ts
type ProductUpdateAdapter = {
  manifest: {
    sourceKey: string;
    family: ProductUpdateFamily;
    targets: readonly {
      targetKey: string;
      url: string;
      allowedHosts: readonly string[];
    }[];
    parserVersion: string;
    cadence: "six-hourly" | "daily" | "weekly";
    timeoutMs: number;
    maxResponseBytes: number;
    minimumExpectedRecords: number;
    maximumExpectedRecords?: number;
    maximumRecordDropFraction?: number;
  };
  parse(snapshot: ProductUpdateSnapshot): NormalizedProductUpdateObservation[];
};
```

Every parsed observation supplies its own canonical `productKey`, normalized non-null `componentKey`, and source-local `sourceUpdateKey`. This lets aggregate adapters such as UGS emit observations for several products and lets Unity, Android, and iOS SDK components share one parser without identity collisions.

Shared runner responsibilities:

- URL and redirect validation;
- conditional fetch;
- timeout and retry handling;
- snapshot persistence;
- validation and quarantine;
- per-target advisory locking and run leases;
- transaction control;
- structured logging;
- circuit-breaker state;
- dry-run and snapshot replay.

Adapter responsibilities:

- source-specific structure recognition;
- extraction;
- canonical product/component/version/date mapping;
- section and change-kind normalization;
- source-specific structural warnings.

Adapters never open database transactions.

---

## 7. Additive data model

Product Updates does not reuse `ingestion_runs`. The existing health, Stats, and Activity Feed readers treat every row in that table as core, so reuse would violate the isolation guarantee. Product Updates uses dedicated runs, snapshots, target state, and health queries.

Add the following tables:

### `unity_products`

Canonical product catalog:

- `product_key`
- display name
- family
- description
- status: active, paused, suspected-retired, retired
- canonical Unity URL

### `product_update_sources`

Checked-in adapter identities:

- source key
- display name
- family
- parser version
- enabled metadata

### `product_update_targets`

One independently fetched URL per target:

- source ID and stable target key
- current URL
- cadence and next-due timestamp
- last attempt and last success
- last observed ETag, Last-Modified, body hash, and snapshot ID
- last validated ETag, Last-Modified, body hash, parser version, and snapshot ID
- last published ETag, Last-Modified, body hash, parser version, and snapshot ID
- consecutive failures and state-machine status
- circuit open-until time
- active run lease and heartbeat
- last error and last validated record count

Conditional requests use only the last validated validator. Observed or quarantined validators are never promoted until normalized content commits successfully. A parser-version change replays the newest observed snapshot before accepting a 304.

### `product_update_runs`

Dedicated operational history:

- source and target IDs
- job name and parser version
- start, deadline, heartbeat, and finish timestamps
- status: running, success, failed, quarantined, timed-out, abandoned, skipped-overlap, skipped-budget, or skipped-not-due
- observed/created/updated counts
- error and structured metadata

Runs are outside the core `ingestion_runs` table and therefore cannot affect core freshness or default Activity Feed ordering.

### `product_update_snapshots`

Bounded internal source evidence:

- source and target IDs
- requested and final URLs
- fetch timestamp and HTTP status
- ETag and Last-Modified
- content hash and bounded raw text
- response metadata

### `product_updates`

Canonical, source-independent update identity:

- product ID
- non-null normalized component key
- canonical update key
- stable URL slug
- nullable version
- nullable channel
- nullable release date
- title
- summary
- normalized hash
- first-seen and last-seen timestamps

Unique identity: product, component, and canonical update key.

Date-only and monthly feeds must not invent versions. Their canonical key uses canonical product/component identity, date, and normalized title; it never contains source identity.

### `product_update_observations`

Source-local normalized reports:

- canonical product update ID
- source and target IDs
- source-local update key
- source snapshot and run IDs
- parser version and normalized hash
- observed and published timestamps
- source title, summary, version, date, and URL

Unique identity: source, target, and source-local update key.

Multiple observations can link to one canonical update. Explicit product/component mappings reconcile UGS, Vivox, IAP/package documentation, and other duplicated reports.

### `product_update_observation_items`

Structured entries owned by one observation:

- observation ID
- stable item key
- section
- change kind
- body
- platforms
- tags
- source order
- metadata JSON
- normalized hash

After a complete observation validates, replace only that observation's item set in the same transaction. Never delete a canonical update merely because it disappears from a listing. Canonical display projection uses deterministic source precedence and retains links to every supporting observation.

### APIs and events

Add a dedicated `/api/updates` read API with bounded cursor pagination, stable ordering, validated filters, explicit 404s, and deliberate disabled/not-configured responses.

Do not require `content_events` integration for the first source rollout. Phase 7 adds a nullable `product_update_id` and opt-in Product Updates events after the Phase 0 timeline and API contracts are in place.

### Migration rules

- Use additive, idempotent SQL.
- Do not rename or drop existing columns or tables.
- Do not repurpose `hub_releases`.
- Use explicit `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, guarded named FK creation, and FK indexes for changes to existing tables.
- Add a schema capability preflight. Missing Product Updates tables produce a safe not-configured UI/API state and ingestion no-op while every original route remains operational.
- Apply the schema to a populated local database.
- Test new code against the pre-feature schema and current core code against the expanded schema.
- Verify existing row counts and representative Editor/package queries before and after migration.
- Keep the legacy Hub table until a separate, production-informed cleanup decision.

---

## 8. Failure model

Every source run uses these stages:

1. Acquire a PostgreSQL advisory lock and fenced lease for one source target.
2. Reconcile expired prior leases as timed-out or abandoned.
3. Create and commit a dedicated Product Updates run record.
4. Fetch using a real `AbortController`.
5. Follow redirects manually, validating HTTPS, host, port, and credentials before every hop.
6. Stream the decompressed response and abort when it exceeds the configured byte limit.
7. Use only the last validated ETag and Last-Modified for conditional requests.
8. Retry only transient failures with bounded exponential backoff, jitter, and `Retry-After`.
9. Commit a changed raw snapshot and observed validators before parsing.
10. Parse and normalize in memory.
11. Validate structure and record-count invariants.
12. Quarantine suspicious output without promoting validated or published state.
13. Open a transaction scoped to one source target.
14. Upsert source-local observations, replace their owned items, and reconcile canonical updates.
15. Promote validated/published validators, commit, and mark the run successful.
16. Release the fenced lease.

### Quarantine conditions

- expected document root or heading structure is absent;
- parser returns zero records where the source previously returned records;
- record count drops or spikes beyond adapter bounds;
- canonical keys collide within one parse;
- required titles or source links are absent;
- dates or versions are malformed;
- normalized output exceeds configured size limits.

An unchanged 304 response is a successful no-op only when the validator, content hash, and parser version match the last published success. Otherwise replay the newest observed snapshot.

### Last known-good rule

- Never delete normalized records because they disappeared from a page.
- Never replace good rows with quarantined output.
- Classify failures as transient, rate-limited, access/configuration blocked, not-found candidate, suspected-retired, or manually retired.
- Move repeated 404 or 410 responses through time-separated not-found-candidate probes before `suspected-retired`.
- Probe suspected-retired targets on a long cadence and require a manual decision for final retirement or reactivation.
- Require an explicit code/config decision to mark a product retired.

### Circuit breaker

- Open after three consecutive failures by default.
- Stop scheduled fetches during the configured cooldown.
- Keep the source visible as degraded.
- Support `--force` for a manual probe.
- Reset only after a successful validated run.
- Parent processes and subsequent invocations reconcile hard-killed children so abandoned runs count toward breaker state.

### Security

- Fetch only fixed, checked-in URLs or URLs produced by an adapter's checked-in allowlist.
- Use `redirect: "manual"` and validate every redirect before contacting the next target.
- Reject non-HTTPS URLs, credentials, nonstandard ports, redirect loops, and excessive hops.
- Enforce response limits while streaming, including chunked and compressed bodies without trusted `Content-Length`.
- Store source HTML only in internal snapshots.
- Render normalized plain text or React-escaped content.
- Do not return source snapshots from public APIs.

---

## 9. Scheduling and feature flags

Do not add Product Updates to `npm run ingest:all`.

Add separate Railway cron configurations:

```text
config/railway/cron-updates-editor-tooling.json
config/railway/cron-updates-platform-services.json
config/railway/cron-updates-monetization.json
config/railway/cron-updates-industry-enterprise.json
```

Each group runner:

- selects enabled targets that are due, unless `--force` is supplied;
- launches targets with a small configurable concurrency limit and priority order;
- enforces a per-source hard deadline;
- enforces a total group deadline below the Railway service limit;
- records not-started work as `skipped-budget`, not source failure;
- sends SIGTERM to the child process group, waits briefly, then sends SIGKILL;
- continues after an individual source fails;
- prints a structured per-source summary;
- exits nonzero after all children finish if any failed.

Feature controls:

| Variable | Safe default | Meaning |
|---|---|---|
| `PRODUCT_UPDATE_INGEST_ENABLED` | `false` | Global fetch and publish kill switch |
| `PRODUCT_UPDATE_UI_ENABLED` | `false` | Allows direct read access to validated historical data |
| `PRODUCT_UPDATE_NAV_ENABLED` | `false` | Exposes Product Updates in site navigation and discoverability surfaces |
| `PRODUCT_UPDATE_SOURCES` | empty | Explicit comma-separated source-key allowlist |
| `PRODUCT_UPDATE_CIRCUIT_BREAKER_ENABLED` | `true` | Enables per-source cooldown after repeated failures |

`PRODUCT_UPDATE_SOURCES` is an explicit source-key allowlist. An empty allowlist enables no source.

New adapters must merge disabled by default. Enable one source only after its fixture, replay, live-contract, and failure-injection tests pass.

Disabling ingestion leaves validated historical data readable when the UI flag remains enabled. Sitemap and `llms.txt` follow the navigation/public-read flag.

Core `/api/health` remains unchanged. Add optional-source status to `/stats` and a separate `/api/updates/health` endpoint backed only by Product Updates tables.

---

## 10. Implementation phases

### Phase 0 — Freeze and prove current functionality

**Changes**

- Add a route manifest test covering every current page and API.
- Add navigation contract tests for all existing labels and hrefs.
- Add exact output contracts for:
  - Editor release index;
  - release detail;
  - compare;
  - release-note search;
  - issues;
  - packages;
  - timeline defaults;
  - core health.
- Add a lightweight Playwright smoke suite and `test:e2e` script.
- Add Playwright configuration, deterministic setup, production-server startup, Chromium desktop/mobile projects, and CI execution.
- Add a versioned deterministic database fixture created from the branch-point schema and data contract.
- Add a public-surface manifest covering every route/API, method, representative query/cookie/server-action state, expected status or redirect, required fields/headings, and relevant headers.
- Treat mutable local Editor/package counts only as supplemental evidence.
- Define accessibility gates: semantic nav section headings, one current item, no new automated violations, logical tab order, Escape and focus restoration, drawer background focus containment, and 200% zoom/reflow.

**Exit gate**

- The new regression tests pass on code equivalent to `main`.
- Existing 532 tests still pass.
- Typecheck and production build pass serially.
- Browser smoke tests pass at desktop and mobile widths.
- No product-update schema or behavior exists yet.

**Checkpoint commit**

```text
test: lock existing release intelligence behavior
```

### Phase 1 — Add the isolated foundation

**Changes**

- Add Product Updates types, registry, runner, repositories, and validation.
- Add additive schema.
- Add dry-run and replay commands.
- Add a `test:db` script for the Product Updates integration suite.
- Add fixture helpers and failure-injection tests.
- Add the separate optional-source health model.
- Do not enable a live adapter.

**Tests**

- additive migration against populated local Postgres;
- migration reapplication;
- idempotent normalized upsert;
- changed and unchanged snapshot behavior;
- true request abort;
- retry and `Retry-After`;
- redirect host rejection;
- oversize response rejection;
- quarantine;
- last known-good preservation;
- circuit open, cooldown, force probe, and reset;
- one source failure cannot affect another source;
- core health, data counts, and ingest order remain unchanged.

**Exit gate**

- Foundation tests pass without network access.
- Core regression suite is unchanged and green.
- Product-update feature flags default off.

**Checkpoint commit**

```text
feat: add isolated product update ingestion foundation
```

### Phase 2 — Add the IA shell

**Changes**

- Add visible navigation headings.
- Regroup existing links without changing their routes.
- Add `Editor Tooling Updates` to the primary section.
- Add one `Product Updates` entry to the secondary section.
- Add `/updates`, family browse routes, and stable `/updates/products/...` routes with empty and unavailable states.
- Add shared family/product filter components.
- Add product-update metadata, sitemap, and `llms.txt` descriptions without changing current route descriptions.

**Tests**

- every old nav link remains rendered;
- active nav states for all current routes;
- active state for `/updates/editor-tooling` and lower-priority families;
- desktop and mobile drawer navigation;
- empty database behavior;
- family slug validation and 404s;
- accessibility names and keyboard focus;
- visual checks at desktop and mobile widths.

**Exit gate**

- All current routes and workflows remain reachable.
- No live source is enabled.
- Editor pages remain visually dominant in both navigation modes.

**Checkpoint commit**

```text
feat: add tiered product updates information architecture
```

### Phase 3 — Editor tooling pilot

Implement one adapter per commit:

1. Unity Hub
2. Unity CLI

For each adapter:

- save a sanitized representative fixture;
- implement source-specific parsing;
- implement canonical keys;
- add structural and normalization tests;
- add snapshot replay;
- add an opt-in live contract test;
- add failure and parser-drift cases;
- enable locally only;
- run twice to prove idempotency;
- review the resulting product and detail pages.

After both pass, enable the Editor tooling cron configuration in a non-production environment or manual Railway run. Require two consecutive validated scheduled runs before considering the family complete.

**Exit gate**

- A broken Hub page cannot affect CLI data.
- Last known-good updates survive a broken fixture.
- No Editor ingestion, page, API, or health output changes.

**Checkpoint commits**

```text
feat: track Unity Hub updates
feat: track Unity CLI updates
```

### Phase 4 — Platform and services

Implement separately:

1. Licensing Server
2. Unity Version Control
3. Asset Manager
4. UGS aggregate updates
5. Vivox Unity
6. Vivox Core
7. Vivox Unreal

Add canonical observation reconciliation before enabling UGS and Vivox together. A duplicated announcement may have several observations but must not produce duplicate canonical updates or activity events.

**Exit gate**

- Each source can be disabled independently.
- UGS/Vivox duplicate fixtures merge predictably.
- Core and Editor tooling regression suites stay green.

### Phase 5 — Monetization

Implement Ads platform SDK pages first, then LevelPlay platform SDK pages, then the checked-in mediation-adapter allowlist. The first commit in this phase records the exact current LevelPlay adapter URLs and stable source keys; wildcard source keys never enter runtime configuration.

Each LevelPlay adapter page receives:

- its own source key;
- source state;
- circuit breaker;
- fixtures;
- parser-drift test;
- hard response and record-count bounds.

Do not make newly discovered adapter URLs live automatically.

**Exit gate**

- One adapter failure does not mark the LevelPlay product or group successful.
- Other adapters continue.
- Large adapter batches cannot flood the default Activity Feed.
- Existing package/IAP data is not duplicated.

### Phase 6 — Industry and enterprise

Implement separately:

1. Unity Studio
2. Asset Transformer/Pixyz
3. VPC AWS
4. VPC on-premises
5. `vpctl`

Use conservative weekly cadence where source history changes infrequently. Treat product disappearance or documentation relocation as degraded/suspected-retired.

**Exit gate**

- Every product has independent state and disable controls.
- Versioned documentation URLs are explicit and bounded.
- No source failure affects another family.

### Phase 7 — Final integration and review

**Changes**

- Add a Product Updates filter to Activity Feed while keeping its default event set unchanged.
- Add a nullable `content_events.product_update_id` and emit Product Updates events only for the opt-in filter and explicitly scoped API requests.
- Add Product Updates counts and health to Stats.
- Review pagination and database indexes with populated data.
- Run dry-run and replay for every adapter.
- Review source labels, family descriptions, breadcrumbs, empty states, and degraded states.
- Document operational controls.

**Required reviews**

- architecture and data-integrity review;
- ingestion reliability and security review;
- IA, accessibility, desktop, and mobile review;
- final `main...branch` regression review.

**Exit gate**

- All checks in §12 pass.
- Every source can be disabled without code changes.
- Product Updates can be globally disabled while the original site remains fully operational.
- No merge or deployment occurs without explicit approval.

---

## 11. Testing strategy

### Core regression contract

These checks run after every phase:

- existing Vitest suite;
- route manifest;
- navigation links and labels;
- API response shape;
- representative Editor release queries;
- package queries;
- compare and scoring fixtures;
- timeline default event set;
- core health;
- `ingest:all` job membership and order;
- Editor/package row-count invariants.

### Adapter unit tests

Every adapter requires:

- representative fixture;
- no-update fixture where valid;
- malformed structure;
- missing section;
- invalid version/date;
- duplicate record key;
- excessive record drop;
- excessive record spike;
- normalization snapshot;
- canonical-key stability.

### Runner tests

- 200 changed response;
- 200 unchanged body;
- 304;
- 404 and 410;
- 429 with `Retry-After`;
- 500 retry and exhaustion;
- timeout with actual abort;
- redirect to disallowed host;
- oversize response;
- snapshot persistence before parser failure;
- quarantine rollback;
- durable failed run;
- last known-good preservation;
- circuit breaker;
- sibling source continuation;
- group summary and exit status.

### Database tests

- clean schema creation;
- additive migration on populated schema;
- migration reapplication;
- idempotent update and item upsert;
- evidence deduplication;
- concurrent duplicate source run;
- transaction rollback scoped to one source;
- query plans for family/product lists;
- pagination stability.

### Browser tests

At minimum:

- desktop sidebar and mobile drawer;
- every existing nav destination;
- Editor release list and detail;
- compare;
- packages;
- search and issues;
- Activity Feed default;
- Product Updates landing;
- every family view;
- product history and detail;
- empty, degraded, and quarantined states;
- keyboard navigation and visible focus.

### Live contract tests

Live Unity fetches are opt-in and never required for the offline unit suite. Each adapter's live test validates:

- expected host and final URL;
- expected structural anchor;
- nonzero or otherwise valid record count;
- stable required fields;
- bounded response size.

Run live contracts manually before enabling a source and periodically in the source's scheduled environment.

---

## 12. Verification matrix

Run in this order:

```bash
npm test
npm run build
npm run typecheck
npm run test:e2e
```

Then run database verification:

```bash
DATABASE_URL='postgres://unity:unity@localhost:54329/unity_alerts' npm run db:migrate
DATABASE_URL='postgres://unity:unity@localhost:54329/unity_alerts' npm run test:db
```

For every source enabled in a phase:

```bash
npm run ingest:product-update -- --source <source-key> --dry-run
npm run ingest:product-update -- --source <source-key>
npm run ingest:product-update -- --source <source-key>
npm run ingest:product-update -- --source <source-key> --replay <snapshot-id>
```

Required evidence:

- second live run is idempotent;
- replay produces the same normalized hash;
- source failure leaves prior rows intact;
- core row counts and representative outputs match the Phase 0 contract;
- `/`, `/releases`, `/packages`, `/stats`, `/timeline`, and `/api/health` return successfully in local production mode;
- desktop and mobile Product Updates screenshots pass review.

Before merge approval:

```bash
git status --short
git diff --check
git diff --stat main...codex/product-updates-ia
git log --oneline main..codex/product-updates-ia
```

No verification command may be reported as passing unless its current output was inspected.

---

## 13. Rollback and operational controls

Rollback order:

1. Disable an individual source by removing it from `PRODUCT_UPDATE_SOURCES`.
2. Disable a source family by removing its keys.
3. Set `PRODUCT_UPDATE_INGEST_ENABLED=false`.
4. Keep historical data readable with `PRODUCT_UPDATE_UI_ENABLED=true` unless the read surface itself is unsafe.
5. Set `PRODUCT_UPDATE_NAV_ENABLED=false` to remove discoverability without deleting data.
6. Revert the phase checkpoint commit if code rollback is required.

Disabling Product Updates must not:

- stop any existing cron;
- alter core health;
- remove existing Editor or package data;
- break current routes;
- require a database rollback.

Stored Product Updates data may remain in additive tables while the feature is disabled.

---

## 14. Plan review outcomes

### Architecture review

**Critique:** The first design risked becoming a core ingestion and migration rewrite.

**Decision:** Keep the current pipeline untouched. Build a parallel `product-updates` module, separate jobs, dedicated runs/snapshots/targets, additive canonical and observation tables, and separate health. Any future core runner cleanup is a different project.

### Regression and data-integrity review

**Critique:** “Preserve 100% of the original functionality” is not testable without defining the original contract before implementation.

**Decision:** Phase 0 adds route, navigation, API, database, ingestion, and browser contracts before new behavior. The same suite is a gate after every phase.

### Information-architecture review

**Critique:** A flat list of Hub, UGS, Ads, Vivox, LevelPlay, Studio, VPC, and other products would dilute the release-intelligence product and overload the sidebar.

**Decision:** Keep Engine & Editor primary. Add one primary Editor-tooling entry and one secondary Product Updates entry. All other products live inside ordered families with compact filters.

### Reliability and operations review

**Critique:** Shared run state, promoted quarantined validators, overlapping jobs, automatic redirects, and fail-open schema activation could breach isolation or strand data.

**Decision:** Use dedicated run tables, observed/validated/published validator states, source-target advisory locks and leases, streamed/manual redirects, bounded group execution, explicit failure states, and schema-capability preflight.

### Swarm-review acceptance

The architecture, reliability, and IA/regression reviews converge on an additive, branch-only implementation with independently reversible phases. These amended decisions supersede earlier drafts.

---

## 15. Completion criteria

This project is complete only when:

- every source in §5 has an implemented or explicitly documented non-duplicate adapter decision;
- every enabled source has fixtures, replay, live-contract, failure, and idempotency coverage;
- all current routes, APIs, Editor workflows, package workflows, and core ingestion jobs pass the Phase 0 regression contract;
- every optional source and family can be disabled independently;
- a failed or retired Unity product source preserves last known-good data;
- Product Updates cannot make core health stale or stop core ingestion;
- the IA keeps Engine & Editor first on desktop and mobile;
- the full verification matrix passes;
- the final branch diff has been reviewed;
- the user explicitly approves merging to `main`;
- deployment remains a separate explicit action.
