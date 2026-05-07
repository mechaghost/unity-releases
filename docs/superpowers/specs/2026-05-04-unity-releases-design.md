# Unity Releases Design Spec

Date: 2026-05-04
Status: Reviewed draft

## Purpose

Unity Releases is a release-first website for Unity 6 and newer. It gives Unity developers one place to track official Editor releases, package releases, Unity Hub updates, beta/pre-release changes, and broader Unity news.

The product exists because Unity changes are spread across several official surfaces: Editor release pages, package registry metadata, Unity Hub release notes, beta release pages, package documentation, the blog RSS feed, and issue tracker links embedded inside release notes. The MVP should make those sources searchable, filterable, and alertable without mixing high-signal release events into an undifferentiated news feed.

The product should answer a practical upgrade question, not only index releases:

> I am on one Unity 6 version with a known package/platform stack. What changed, what might break, and should I review an upgrade?

## Product Scope

### Included in MVP

- Unity Editor releases for Unity 6 and newer, starting with `6000.x`.
- Unity beta, alpha, and pre-release Editor releases for Unity 6 and newer.
- Official Unity package releases from `packages.unity.com`.
- Unity Hub release notes.
- Unity blog/news posts from the official Unity RSS feed.
- Searchable release-note items parsed from Unity release notes.
- Version filtering by exact version, minor line, stream, and future major line.
- Upgrade impact comparison between Unity 6 versions or minor lines.
- Shareable watch URLs and RSS feeds for public filtered views.
- Release artifact and module metadata when official pages expose it.
- Rule-based impact and risk labels for release-note items.
- Railway deployment with Postgres.

### Excluded from MVP

- User-facing backfill for Unity `2022.3`, `2021.3`, or older releases.
- Asset Store package tracking.
- Community package registries.
- User accounts.
- Email, Discord, Slack, or webhook delivery.
- AI summaries as a primary product feature.
- User-uploaded `manifest.json` or `packages-lock.json` analysis.
- Paid subscriptions.

Legacy Unity release pages may be kept as parser test fixtures, but they are not product data.

The MVP launch core is stable Unity 6 Editor release tracking, curated official package tracking, searchable release notes, upgrade impact comparison, and RSS/watch URLs. Beta/alpha, Hub, and blog/news lanes are included from day one as separate secondary lanes, but they must not dominate default release alerts.

## Core User Workflows

### Release Feed

Users open the homepage and see a release-first timeline:

- Latest Unity 6 Editor releases.
- Latest beta/alpha releases.
- Official package updates.
- Unity Hub releases.
- Broader Unity blog/news posts in a separate news lane.

Release events should always visually outrank blog/news posts.

### Upgrade Impact

Users can compare a current Unity 6 version or minor line against a target version or line.

The comparison should show:

- Fixes gained.
- Known issues introduced or still present.
- API and breaking changes.
- Package changes and package compatibility warnings.
- Platform/module changes that may affect installs or CI builders.
- Issue IDs grouped by area and platform.
- A rule-based review signal: `likely_safe`, `worth_reviewing`, or `hold_off`.

The signal is advisory and should explain the underlying risk signals. It must not claim certainty.

### Release Notes Explorer

Users can search dense Unity release notes and narrow results by:

- Exact Editor version, such as `6000.3.14f1`.
- Version line, such as `6000.3.x`.
- Stream, such as LTS, Update/Supported, beta, or alpha. `Latest` is a selector, not a stream.
- Category, such as Known Issues, Features, Improvements, API Changes, Changes, Fixes, and Package Changes.
- Area prefix, such as Graphics, UI Toolkit, Android, XR, Editor, URP, HDRP, WebGL, Audio, or Physics.
- Platform tag, such as Android, iOS, WebGL, Windows, macOS, Linux, XR, or server/headless where extractable.
- Impact kind, such as fix, known issue, API change, breaking change, package change, platform risk, install risk, security-related fix, or upgrade blocker.
- Issue ID, such as `UUM-136929`.
- Package name, such as `com.unity.inputsystem`.
- Free text, such as `memory leak`, `RenderGraph`, or `decals`.

Each parseable release-note item should be represented as a searchable record. Ambiguous or unparsed blocks should be preserved internally at release-section level with parser confidence. Public UI links to the official source and may display extracted factual records or short excerpts, but raw source snapshots are internal/admin-only.

### Release Detail Page

Users can open a release detail page and see:

- Version.
- Release date.
- Stream.
- Changeset or short revision when available.
- Download links when available.
- Platform and architecture artifact metadata when available.
- Module metadata when available, such as Android Build Support, Web Build Support, language packs, documentation bundles, and target support installers.
- Known issues.
- Release-note sections.
- Package changes.
- Source URL.

Admin-only views can also show parser confidence, source snapshots, ingestion runs, and last ingestion time.

### Package Detail Page

Users can open a package detail page and see:

- Package name.
- Display name.
- Latest version.
- Release history.
- Publish timestamps.
- Changelog per version when available.
- Unity compatibility metadata.
- Documentation URL.
- Package dependency metadata.
- Compatibility filters for Unity 6 minor lines.
- Dependency and dist-tag changes that may affect project upgrades.

### Alerts

The MVP supports RSS feeds for filtered views, such as:

- All Unity 6 Editor releases.
- `6000.3.x` releases.
- Package updates for `com.unity.inputsystem`.
- Release notes matching `WebGL memory leak`.
- Known issues for `URP`.

The MVP also includes a no-account watch URL/RSS builder. Users select a Unity line, packages, platforms, areas, sections, impact kinds, and keywords, then copy a stable URL or RSS feed. RSS feeds should use stable item IDs, cap initial backfill results, group large releases where needed, and avoid flooding subscribers after parser fixes.

Email and webhooks should come after ingestion, search, and RSS are stable.

## Official Sources

### Editor Release Pages

Primary source:

- `https://unity.com/releases/editor/latest`
- `https://unity.com/releases/editor/archive`
- `https://unity.com/releases/editor/whats-new/<version>`
- `https://unity.com/releases/editor/beta`
- `https://unity.com/releases/editor/alpha`

Observed behavior:

- The latest release page resolves to a specific Unity version page.
- Release pages currently expose structured metadata in the rendered application payload.
- Current release pages include a release notes Markdown asset URL hosted under Google Storage.
- Release pages include release date, version, stream, download URLs, modules, changeset/short revision, known issues, and release note content.

These are observed implementation details as of 2026-05-04, not guaranteed public contracts. Ingestion should prefer structured metadata and release-note Markdown assets when available, but must tolerate HTML-only pages, payload schema drift, locale redirects, and missing fields.

### Unity Package Registry

Primary source:

- `https://packages.unity.com/<package-name>`

Observed behavior:

- The endpoint returns npm-style JSON package metadata for known package names.
- Metadata may include versions, `dist-tags`, publish times, `_upm.changelog`, documentation URLs, dependencies, Unity compatibility metadata, tarball URLs, and checksums.
- Field presence varies by package and version.

Initial package tracking should use the Unity Package Manager registry endpoint for known package names on a best-effort basis. Treat all metadata fields as optional, keep raw JSON, and avoid registry-wide discovery unless Unity documents a supported endpoint.

### Unity Hub Release Notes

Primary source:

- `https://unity.com/unity-hub/release-notes`

Hub updates should be tracked as their own event type. They are relevant because Editor installation, module management, and Unity version access are often mediated through Hub.

### Unity Blog RSS

Primary source:

- `https://unity.com/blog/rss`

Blog polling should tolerate redirects and store the final resolved URL. Blog posts should be included from day one but displayed separately from release events. Blog posts may be tagged by source category, title keywords, and Unity product area where possible.

### Issue Tracker Links

Release notes often link to Unity Issue Tracker items through `UUM-*` IDs. The MVP should extract issue IDs and links from release notes. It should not attempt to fully crawl the Issue Tracker unless a later product milestone needs issue status synchronization.

The MVP should still make issue IDs useful by providing issue-centric filters and pages. For each extracted issue, show direct Issue Tracker links, linked release-note items, first seen version, latest seen version, related sections, affected areas, affected platforms where extractable, and whether the issue appears in a Known Issues or Fixes section.

## Legal And Branding

Unity Releases is an independent, unofficial project. It is not affiliated with, endorsed by, sponsored by, or approved by Unity Technologies or its affiliates.

Unity and related marks are trademarks or registered trademarks of Unity Technologies or its affiliates. The product should not use Unity logos, official branding assets, or wording that implies official status.

Public UI should link to official sources and display extracted factual records or short excerpts where appropriate. Full raw source snapshots and copied upstream documents are for internal reproducibility and parser repair only.

## Data Model

Postgres is the source of truth.

### Tables

#### `source_snapshots`

Stores raw fetched source content for reproducibility and parser repair.

Fields:

- `id`
- `source_type`
- `source_url`
- `fetched_at`
- `http_status`
- `etag`
- `last_modified`
- `content_sha256`
- `content_text`
- `metadata_json`

#### `ingestion_runs`

Stores ingestion attempts for auditability, health checks, and replay.

Fields:

- `id`
- `source_type`
- `job_name`
- `started_at`
- `finished_at`
- `status`
- `parser_version`
- `source_count`
- `records_created`
- `records_updated`
- `records_deleted`
- `error_message`
- `metadata_json`

#### `unity_releases`

Stores normalized Unity Editor releases.

Fields:

- `id`
- `version`
- `major_line`
- `minor_line`
- `patch`
- `suffix_channel`
- `suffix_number`
- `stream`
- `release_date`
- `changeset`
- `short_revision`
- `release_page_url`
- `release_notes_url`
- `unity_hub_deep_link`
- `raw_metadata_json`
- `source_snapshot_id`
- `ingestion_run_id`
- `parser_version`
- `normalized_sha256`
- `created_at`
- `updated_at`

Unique key:

- `version`

#### `release_note_items`

Stores one searchable row per release-note bullet or package-change item.

Fields:

- `id`
- `unity_release_id`
- `version`
- `major_line`
- `minor_line`
- `stream`
- `release_date`
- `section`
- `area`
- `platforms`
- `impact_kind`
- `risk_level`
- `risk_reasons`
- `body`
- `issue_ids`
- `issue_links_json`
- `package_names`
- `source_url`
- `source_anchor`
- `source_order`
- `source_snapshot_id`
- `ingestion_run_id`
- `parser_version`
- `normalized_sha256`
- `search_vector`
- `created_at`
- `updated_at`

Indexes:

- GIN index on `search_vector`.
- GIN trigram index on `body`.
- GIN trigram index on `issue_ids` or generated issue text.
- B-tree indexes on `version`, `minor_line`, `stream`, `section`, `area`, `impact_kind`, and `risk_level`.

#### `release_sections`

Stores release-section blocks, including ambiguous or partially parsed content.

Fields:

- `id`
- `unity_release_id`
- `section`
- `body`
- `parser_confidence`
- `source_order`
- `source_snapshot_id`
- `ingestion_run_id`
- `created_at`

#### `unity_release_artifacts`

Stores Editor installer and download artifact metadata when exposed by official release pages.

Fields:

- `id`
- `unity_release_id`
- `platform`
- `architecture`
- `category`
- `name`
- `url`
- `checksum`
- `size_bytes`
- `is_headless_suitable`
- `metadata_json`
- `source_snapshot_id`
- `created_at`

#### `unity_release_modules`

Stores module metadata for target support installers, language packs, documentation bundles, and development tools when exposed by official release pages.

Fields:

- `id`
- `unity_release_id`
- `platform`
- `architecture`
- `module_name`
- `module_category`
- `url`
- `checksum`
- `size_bytes`
- `metadata_json`
- `source_snapshot_id`
- `created_at`

#### `issue_mentions`

Stores extracted Unity Issue Tracker IDs and their relationship to release-note items.

Fields:

- `id`
- `issue_id`
- `issue_url`
- `unity_release_id`
- `release_note_item_id`
- `section`
- `area`
- `platforms`
- `mention_kind`
- `created_at`

#### `packages`

Stores normalized package identity.

Fields:

- `id`
- `name`
- `display_name`
- `description`
- `documentation_url`
- `keywords`
- `source_url`
- `source_snapshot_id`
- `ingestion_run_id`
- `created_at`
- `updated_at`

Unique key:

- `name`

#### `package_versions`

Stores package version metadata.

Fields:

- `id`
- `package_id`
- `version`
- `published_at`
- `unity_compatibility`
- `unity_min_version`
- `unity_max_version`
- `is_prerelease`
- `changelog`
- `dependencies_json`
- `dist_tags_json`
- `tarball_url`
- `shasum`
- `raw_metadata_json`
- `source_snapshot_id`
- `ingestion_run_id`
- `parser_version`
- `normalized_sha256`
- `created_at`
- `updated_at`

Unique key:

- `(package_id, version)`

#### `content_events`

Unified feed event table.

Fields:

- `id`
- `event_type`
- `title`
- `summary`
- `event_time`
- `source_url`
- `unity_release_id`
- `package_version_id`
- `blog_post_id`
- `hub_release_id`
- `tags`
- `stable_guid`
- `risk_level`
- `source_snapshot_id`
- `ingestion_run_id`
- `created_at`

#### `blog_posts`

Stores Unity blog RSS entries.

Fields:

- `id`
- `guid`
- `title`
- `description`
- `link`
- `published_at`
- `categories`
- `raw_xml_json`
- `created_at`
- `updated_at`

#### `hub_releases`

Stores Unity Hub release notes.

Fields:

- `id`
- `version`
- `release_date`
- `body`
- `source_url`
- `created_at`
- `updated_at`

## Search Design

Postgres search should be used for the MVP.

Use:

- `tsvector` for full-text search.
- GIN indexes for text search.
- `pg_trgm` for fuzzy matching and partial terms.
- Weighted search vectors, giving more weight to version, area, section, package names, and issue IDs than body text.

Search should combine:

- Structured filters through SQL predicates.
- Full-text query ranking.
- Trigram similarity for fuzzy Unity terms and issue IDs.

The search API should support empty-query filtering. This allows the Release Notes Explorer to be used as a faceted browser, not only a search box.

## Version And Risk Taxonomy

### Version Parsing

Unity version parsing should normalize:

- Full version, such as `6000.3.14f1`.
- Major line, such as `6000`.
- Minor line, such as `6000.3`.
- Patch/build number, such as `14`.
- Suffix channel, such as `f`, `p`, `a`, or `b`.
- Suffix number, such as `1`.
- Stream label, such as LTS, Update/Supported, beta, or alpha.
- Comparable sort order.

### Impact Classification

Each release-note item should get rule-based labels. Initial labels can be conservative and explainable:

- `fix`
- `known_issue`
- `api_change`
- `breaking_change`
- `package_change`
- `platform_risk`
- `install_risk`
- `security_related_fix`
- `upgrade_blocker`
- `documentation`
- `unknown`

### Risk Levels

Risk levels are advisory:

- `info`
- `review`
- `caution`
- `blocker`

Risk levels should be derived from transparent rules, such as section, area, platform, keywords, issue references, package names, and whether the item appears in Known Issues, API Changes, or Package Changes.

The product must show the reason for each risk label and avoid pretending to know whether an upgrade is safe for every project.

## Ingestion Design

### Backfill Job

The backfill job imports historical Unity 6+ releases.

Steps:

1. Discover Unity 6+ version pages from official archive/source metadata.
2. Fetch each release page.
3. Extract structured metadata and release notes Markdown URL.
4. Fetch release notes Markdown when available.
5. Store raw snapshots.
6. Parse release notes into sections and bullet items.
7. Extract area prefixes, issue IDs, issue links, package names, and version references.
8. Upsert `unity_releases`.
9. Upsert `release_note_items`.
10. Create or update `content_events`.

The job must be idempotent. Re-running it should not duplicate rows.

Every normalized record created by the job should link to a `source_snapshot`, `ingestion_run`, and `parser_version`. A release event should be replayable from stored snapshots with byte-identical normalized output for the same parser version.

### Incremental Editor Polling

Railway cron polls official latest, archive, beta, and alpha sources.

Behavior:

- Fetch latest source pages.
- Compare source checksums and known versions.
- If a new version appears, run the release ingestion flow for that version.
- Emit a release event.
- Alert if a release page is detected but zero release-note items are parsed.
- Alert if a known release mutates upstream after initial ingestion.
- Alert on source shape anomalies, such as a missing Known Issues section, sudden section-count changes, missing module/artifact metadata, or missing release-note asset where previous versions had one.

### Package Polling

Package polling uses a curated allowlist of official packages.

Behavior:

- Fetch `https://packages.unity.com/<package-name>`.
- Compare known versions and publish times.
- Upsert package metadata and versions.
- Emit package update events for new versions.
- Treat registry fields as optional.
- Detect dist-tag movement, dependency changes, checksum changes, pre-release versions, and Unity compatibility changes when fields exist.

The initial allowlist should include high-impact packages such as:

- `com.unity.inputsystem`
- `com.unity.addressables`
- `com.unity.render-pipelines.universal`
- `com.unity.render-pipelines.high-definition`
- `com.unity.entities`
- `com.unity.netcode.gameobjects`
- `com.unity.netcode`
- `com.unity.timeline`
- `com.unity.cinemachine`
- `com.unity.test-framework`
- `com.unity.recorder`
- `com.unity.probuilder`
- `com.unity.visualscripting`
- `com.unity.shadergraph`
- `com.unity.burst`
- `com.unity.mathematics`
- `com.unity.collections`
- `com.unity.transport`

Package allowlists should be tiered:

- Core MVP: Input System, Addressables, URP, HDRP, render pipeline core, Cinemachine, Timeline, Test Framework, Recorder, Burst, Collections, Mathematics.
- DOTS/multiplayer: Entities, Netcode for GameObjects, Netcode for Entities where available, Transport, Physics.
- Authoring/tools: ProBuilder, Visual Scripting, Shader Graph, AI Navigation, Localization, Splines, UGUI.
- XR/mobile/services: official XR, mobile, and services packages where known package endpoints are reliable.

### Blog RSS Polling

Blog polling fetches official Unity RSS.

Behavior:

- Parse RSS entries.
- Upsert by GUID or link.
- Emit news events for new posts.
- Tag posts heuristically by title and description.
- Store final resolved feed URL after redirects.

### Hub Polling

Hub polling fetches the Unity Hub release notes page.

Behavior:

- Parse Hub versions and release-note bodies.
- Upsert by version.
- Emit Hub release events for new versions.

### Package Lockfile Workflows

User-uploaded lockfile analysis is not part of the MVP. The schema and event model should leave room for a later local or uploaded analyzer for `manifest.json` and `packages-lock.json`.

Post-MVP lockfile workflows should compare direct dependencies, transitive dependencies, package source URLs, resolved versions, checksum changes, Unity compatibility constraints, and dist-tag movement against the release/package database.

## Railway Deployment

Recommended services:

- `web`: Next.js application.
- `cron-editor`: scheduled Editor latest/archive/beta/alpha polling.
- `cron-packages`: scheduled package polling.
- `cron-news`: scheduled blog and Hub polling.
- `cron-backfill`: manually triggered or one-off backfill job.
- `postgres`: Railway Postgres database.

Railway cron jobs must finish and exit. Jobs should use database locks to prevent overlapping runs.

Environment variables:

- `DATABASE_URL`
- `APP_BASE_URL`
- `INGESTION_USER_AGENT`
- `BACKFILL_BATCH_SIZE`
- `PACKAGE_ALLOWLIST`
- `CRON_SECRET`

### Build Farm Consumption

The public API should include JSON endpoints for machine consumers:

- Release list and detail endpoints.
- Release-note search endpoint.
- Package list and detail endpoints.
- Filtered event feed endpoint.
- RSS equivalents for filtered event feeds.

Endpoints should use stable IDs, pagination, cache headers, and deterministic ordering. RSS feeds should cap initial backfill items and avoid changing GUIDs when parser output improves.

The admin/health surface should show the last successful poll, last failure, ingestion lag, source counts, parser version, and record counts per source.

## UI Design

### Homepage

The homepage should be the product, not a marketing landing page.

Primary sections:

- Latest Unity 6 release activity.
- Important package updates.
- Beta/pre-release lane.
- Unity Hub lane.
- News/blog lane.
- Search entry point for release notes.

### Release Notes Explorer

The explorer should have:

- Search input.
- Version selector.
- Minor-line filter.
- Stream filter.
- Section filter.
- Area filter.
- Platform filter.
- Impact/risk filter.
- Package filter.
- Issue ID filter.
- Results list with version, section, area, issue IDs, and source link.

It should support URLs that preserve filters so filtered RSS feeds can map to the same query model.

### Release Detail

The detail page should preserve the original release-note structure while adding filters within the release.

### Package Detail

Package pages should emphasize project impact: compatible Unity 6 lines, dependency changes, changelog highlights, breaking/deprecation notes, pre-release status, dist-tag changes, and whether the package matters for common stacks like URP, HDRP, Netcode, Addressables, Input System, DOTS, WebGL, Android, iOS, or XR.

### Watch URL Builder

The watch URL builder should let users select:

- Unity version line.
- Current and target versions for upgrade comparison.
- Packages.
- Platforms.
- Areas.
- Sections.
- Impact kinds and risk levels.
- Keywords.

It should output a shareable URL and RSS URL without requiring an account.

### Issue Detail

Issue detail pages should show:

- Issue ID.
- Direct Issue Tracker URL.
- Release-note items that mention the issue.
- First seen version.
- Latest seen version.
- Sections where it appears, such as Known Issues or Fixes.
- Related areas, platforms, and packages where extractable.

### Upgrade Impact Page

The upgrade impact page should compare source and target versions or version lines. It should summarize:

- Fixes gained.
- Known issues introduced or remaining.
- API and breaking changes.
- Platform risks.
- Package changes.
- Release artifacts/modules that changed or are newly available.
- Relevant issue IDs.
- Advisory risk label and reasons.

## Testing Strategy

### Parser Fixtures

Keep saved fixtures for:

- A current Unity 6 release page with Markdown release notes.
- A Unity 6 beta/pre-release page.
- A Unity 6 release with package changes.
- A package registry JSON response.
- Unity Blog RSS.
- Unity Hub release notes.
- A small number of legacy release pages for parser drift testing only.
- Release artifact/module metadata from a Unity 6 release page.
- Package registry JSON with missing optional fields.
- Package registry JSON with dependency and dist-tag changes.

### Unit Tests

Test:

- Version normalization.
- Version sort order.
- Section parsing.
- Bullet extraction.
- Issue ID extraction.
- Area prefix extraction.
- Platform tag extraction.
- Impact/risk classification.
- Package-change parsing.
- Package registry parsing.
- RSS parsing.

### Integration Tests

Test:

- Backfill idempotency.
- Incremental polling creates no duplicates.
- Search filters combine correctly.
- RSS filtered feeds return expected entries.
- Upgrade impact comparison returns expected gained fixes and known issues.
- Watch URLs round-trip to the same filters and RSS feed.
- Release artifacts and modules are linked to the source release.
- Stored snapshots can replay normalized records for the same parser version.

### Ingestion Health Checks

Alert internally when:

- A new release is detected but zero release-note items are parsed.
- Package registry JSON schema changes.
- RSS parsing returns zero posts after a previously successful parse.
- A source fetch fails repeatedly.
- Known section counts change sharply for comparable release pages.
- Artifact or module counts unexpectedly drop to zero.
- A previously ingested upstream record changes checksum.

## Open Design Decisions

- Whether to add user accounts before email/webhook alerts.
- Whether to add a separate search engine after Postgres search.
- Whether beta/alpha releases should appear in the main feed by default or only behind an opt-in toggle.
- Whether package lockfile analysis should run as a browser-local tool, server upload, or CLI companion later.

## MVP Acceptance Criteria

- The site deploys to Railway.
- Postgres migrations create the needed schema and search indexes.
- Unity 6+ release backfill imports multiple releases without duplicate rows.
- Latest Editor polling detects new Unity 6 versions.
- Package polling detects new official package versions from the allowlist.
- Blog RSS polling imports Unity blog posts.
- The homepage shows release-first activity and a separate news lane.
- Release Notes Explorer can search and filter by exact version, version line, stream, section, area, platform, impact/risk, package, and issue ID.
- Public RSS feeds work for filtered views.
- Parser fixture tests pass.
- A user can compare two Unity 6 versions or lines and see gained fixes, known issues, API changes, package changes, platform risks, and an advisory risk label with reasons.
- A user can create a shareable watch URL and RSS URL without an account.
- A user can find all known URP or WebGL issues in a selected `6000.x` line.
- A user can find package updates compatible with a selected Unity 6 line when compatibility metadata exists.
- A user can open direct official source links for every issue/release/package result.
- Release detail pages expose artifact/module provenance when available.
- Admin health surfaces show last successful poll per source and parser anomaly warnings.
