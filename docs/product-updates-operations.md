# Product Updates operations

Product Updates is an additive, optional ingestion domain for Unity products
outside the core Editor release and package workflows. It has separate tables,
run history, health, feature flags, jobs, and Railway cron services. A Product
Updates failure must never change `/api/health`, stop `ingest:all`, or alter the
default Activity Feed.

## Safe defaults

| Variable | Default | Purpose |
|---|---|---|
| `PRODUCT_UPDATE_INGEST_ENABLED` | `false` | Global fetch and publish kill switch |
| `PRODUCT_UPDATE_UI_ENABLED` | `false` | Enables direct Product Updates routes and scoped reads |
| `PRODUCT_UPDATE_NAV_ENABLED` | `false` | Adds Product Updates navigation and discovery links |
| `PRODUCT_UPDATE_SOURCES` | empty | Exact comma-separated source-key allowlist |
| `PRODUCT_UPDATE_CIRCUIT_BREAKER_ENABLED` | `true` | Opens a six-hour target circuit after three failures |
| `PRODUCT_UPDATE_GROUP_CONCURRENCY` | `2` | Concurrent child source processes, clamped to 1–4 |
| `PRODUCT_UPDATE_SOURCE_DEADLINE_MS` | `600000` | Per-source hard deadline |
| `PRODUCT_UPDATE_GROUP_DEADLINE_MS` | `1200000` | Whole-family execution budget |

Keep all three feature flags off until the migration and dry runs pass.
`PRODUCT_UPDATE_SOURCES` never accepts wildcards. List the checked-in source
catalog with:

```bash
npm run product-updates:sources
npm run product-updates:sources -- monetization
```

Newly published mediation pages are not discovered at runtime. Review and add
them to the checked-in inventory, a fixture, and the live contract before
adding their exact source keys to the environment.

## Railway services

Product Updates does not run from `ingest:all`. Use the four independent
config-as-code files:

| Family | Config | Schedule |
|---|---|---|
| Editor tooling | `config/railway/cron-updates-editor-tooling.json` | Every 6 hours at minute 15 |
| Platform and services | `config/railway/cron-updates-platform-services.json` | Daily at 04:30 UTC |
| Monetization | `config/railway/cron-updates-monetization.json` | Daily at 04:45 UTC |
| Industry and enterprise | `config/railway/cron-updates-industry-enterprise.json` | Mondays at 05:00 UTC |

Manifests retain their own source cadence. A more frequent family cron safely
returns `skipped-not-due` for targets that are not due.

The group runner uses bounded child-process concurrency. It sends `SIGTERM`
when a source exceeds its deadline and `SIGKILL` after a five-second grace
period. Work that cannot start before the family deadline is reported as
`skipped-budget`, not as a source failure. Sibling sources continue after a
failure, and the group exits nonzero only after all started children finish.

## Rollout

1. Apply the additive schema:

   ```bash
   npm run db:migrate
   ```

2. Leave ingestion globally disabled and inventory the intended family:

   ```bash
   npm run product-updates:sources -- editor-tooling
   ```

3. Set `PRODUCT_UPDATE_INGEST_ENABLED=true` on that family’s cron service and
   set `PRODUCT_UPDATE_SOURCES` to the exact reviewed keys.
4. Dry-run an individual source against the real runner:

   ```bash
   npm run ingest:product-update -- --source unity-hub --force --dry-run
   ```

5. Publish, repeat for idempotency, then replay the stored snapshot:

   ```bash
   npm run ingest:product-update -- --source unity-hub --force
   npm run ingest:product-update -- --source unity-hub --force
   npm run ingest:product-update -- --source unity-hub --target all-channels --replay 123 --dry-run
   ```

6. Inspect `/api/updates/health`. Then enable
   `PRODUCT_UPDATE_UI_ENABLED=true`. Enable navigation last with
   `PRODUCT_UPDATE_NAV_ENABLED=true`.

For a multi-target source such as Unity Studio, `--target` is required with
`--replay` so a snapshot can never be applied to a sibling target.

## Health and failure handling

- `/api/health` is core-only and intentionally unchanged.
- `/api/updates/health` reports optional target state and circuit breakers.
- Fetch failures are classified as transient, rate-limited,
  access/configuration blocked, not-found candidates, parser drift, or unknown.
  Three 404/410 probes separated by at least six hours move a target to
  `suspected-retired` and a weekly probe cadence. A successful validated run
  restores `active`.
- `/stats` shows optional counts and degraded targets only while the Product
  Updates UI flag is enabled.
- `/timeline` excludes Product Updates by default. The Product Updates filter
  and `/api/events?scope=product-updates` are explicit opt-ins.
- Raw snapshots are stored before parsing. Parser drift quarantines the new
  snapshot and preserves the last known-good published rows.
- Conditional requests replay the validated snapshot automatically when a
  parser version changes and the upstream returns `304`.
- Set a checked-in target manifest to `retired: true` only after a manual
  retirement decision. This yields `skipped-retired`; removing the property
  reactivates the target without deleting its history.
- When navigation is enabled, `sitemap.xml` and `llms.txt` expose the optional
  family and stable detail routes. They contain no Product Updates routes while
  the flags remain off.
- Family and product histories accept URL-stable product, change-kind,
  platform/SDK, version, channel, and date filters. The same optional filters
  are available on `/api/updates`.

When a source breaks:

1. Remove only its exact key from `PRODUCT_UPDATE_SOURCES`.
2. Inspect its target in `/api/updates/health` and replay the saved snapshot
   with the candidate parser. Add `--force` when the source has already been
   removed from the allowlist.
3. Disable the family by removing that family’s keys if several related pages
   changed.
4. Set `PRODUCT_UPDATE_INGEST_ENABLED=false` for the global fetch kill switch.
5. Leave historical reads enabled unless the read surface itself is unsafe.
6. Set `PRODUCT_UPDATE_NAV_ENABLED=false` to remove discovery without deleting
   data.

No rollback requires deleting Product Updates tables or reverting a core
Editor migration.

## Current upstream families

- Editor tooling: [Unity Hub release notes](https://unity.com/unity-hub/release-notes)
  and [Unity CLI release notes](https://docs.unity.com/en-us/unity-cli/release-notes).
- Platform and services: licensing, Unity Version Control, Asset Manager, UGS,
  and the Unity/Core/Unreal Vivox histories.
- Monetization: [Unity Ads](https://docs.unity.com/en-us/grow/ads/changelog),
  the Unity/Android/iOS LevelPlay SDK histories, and the explicit adapters
  linked by [Mediation Networks for Unity](https://docs.unity.com/en-us/grow/levelplay/sdk/unity/mediation-networks).
- Industry and enterprise: Unity Studio, Asset Transformer/Pixyz, AWS and
  on-premises Unity Cloud Self-Hosted, and `vpctl`.

Two related surfaces are intentionally not separate adapters:

- Unity IAP remains package-owned. Its version and changelog are already
  ingested through the official package registry, so a second documentation
  scraper would create competing records for the same release.
- Azure deployment guidance exists for Unity Cloud Self-Hosted, but Unity does
  not currently publish an Azure-specific release-note history alongside the
  AWS, on-premises, and `vpctl` histories. Add it as a new isolated target if
  Unity publishes one; do not infer releases from mutable setup guidance.

The checked-in source catalog is authoritative; this section is only an
operator-friendly overview.
