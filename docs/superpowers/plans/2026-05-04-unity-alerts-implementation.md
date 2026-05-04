# Unity Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a tested Railway-ready Unity 6+ release intelligence app with Postgres schema, ingestion parsers, search APIs, RSS/watch URLs, and minimal functional UI.

**Architecture:** A Next.js TypeScript app owns the public UI and route handlers. Source-specific ingestion code lives in `src/lib/ingest`, pure parsers live in `src/lib/parsers`, database access lives in `src/lib/db`, and tests exercise parsers, classifiers, query builders, and ingestion normalization without requiring a live Postgres instance. Railway cron services run CLI entrypoints under `src/jobs`.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, `pg`, `zod`, `fast-xml-parser`, Postgres full-text search with `pg_trgm`, Railway.

---

## File Structure

- `package.json`: scripts and dependencies.
- `tsconfig.json`, `next.config.mjs`, `vitest.config.ts`: project configuration.
- `src/lib/parsers/version.ts`: Unity version parser and comparer.
- `src/lib/parsers/release-notes.ts`: Markdown release-note parser.
- `src/lib/parsers/release-page.ts`: Unity release page metadata extractor.
- `src/lib/parsers/package-registry.ts`: package registry parser.
- `src/lib/parsers/rss.ts`: Unity blog RSS parser.
- `src/lib/classification.ts`: area/platform/impact/risk extraction.
- `src/lib/db/schema.sql`: Postgres schema and indexes.
- `src/lib/db/client.ts`: `pg` connection helper.
- `src/lib/db/repositories.ts`: upsert/query functions.
- `src/lib/search.ts`: release-note search query builder.
- `src/lib/ingest/*.ts`: source fetch and normalization flows.
- `src/jobs/*.ts`: Railway cron/backfill entrypoints.
- `src/app/**`: minimal functional pages and route handlers.
- `tests/**/*.test.ts`: unit/integration tests around pure code and SQL generation.

## Tasks

### Task 1: Scaffold Project

- [ ] Create TypeScript/Next/Vitest project files.
- [ ] Install dependencies.
- [ ] Add a smoke test and verify the test runner.
- [ ] Commit the scaffold.

### Task 2: Unity Version Parsing

- [ ] Write failing tests for `6000.3.14f1`, `6000.4.0b12`, `6000.5.0a8`, exact/minor/major fields, stream labels, and sort order.
- [ ] Implement `parseUnityVersion`, `compareUnityVersions`, and `isUnity6OrNewer`.
- [ ] Run the version parser tests.
- [ ] Commit version parsing.

### Task 3: Release Note Parsing And Classification

- [ ] Write failing tests for Known Issues, Features, Improvements, API Changes, Fixes, Package Changes, area prefixes, issue IDs, package names, platform tags, impact kinds, and risk levels.
- [ ] Implement release-note parsing and rule-based classification.
- [ ] Run parser tests.
- [ ] Commit release-note parsing.

### Task 4: Source Metadata Parsers

- [ ] Write failing tests for release page metadata extraction, package registry JSON normalization with optional fields, and Unity blog RSS parsing.
- [ ] Implement source parsers.
- [ ] Run source parser tests.
- [ ] Commit source parsers.

### Task 5: Postgres Schema And Search

- [ ] Write failing tests that assert schema includes required tables, `pg_trgm`, `tsvector`, GIN indexes, snapshot/audit fields, artifact/module tables, and issue mentions.
- [ ] Implement `schema.sql`.
- [ ] Write failing tests for search SQL generation with text query, exact version, minor line, section, area, platform, impact/risk, package, and issue filters.
- [ ] Implement search query builder.
- [ ] Run DB/search tests.
- [ ] Commit DB schema and search.

### Task 6: Ingestion And Repository Layer

- [ ] Write failing tests for release normalization, package normalization, event creation, stable GUID generation, and watch query serialization.
- [ ] Implement repository helpers and ingestion flows.
- [ ] Add CLI jobs for backfill, editor polling, package polling, news polling, migration, and health checks.
- [ ] Run ingestion tests.
- [ ] Commit ingestion and jobs.

### Task 7: API, RSS, And Minimal UI

- [ ] Write failing tests for watch URL serialization and RSS XML generation.
- [ ] Implement route handlers for releases, release-note search, packages, events, RSS, health, and upgrade comparison.
- [ ] Implement minimal server-rendered pages for homepage, explorer, release detail, package detail, issue detail, upgrade impact, and watch builder.
- [ ] Run API/RSS tests.
- [ ] Commit API and UI.

### Task 8: Railway And Final Verification

- [ ] Add Railway/Nixpacks docs and start/job scripts.
- [ ] Run `npm test`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Update README with setup, Railway deployment, cron commands, and current limitations.
- [ ] Commit final docs and config.

## Self-Review

The plan covers the spec's core implementation areas: Unity 6+ ingestion, package registry ingestion, blog RSS, Postgres schema/search, source snapshots/audit, artifacts/modules, issue mentions, upgrade impact, RSS/watch URLs, and minimal functional UI. Visual polish is explicitly deferred by user request.
