CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS source_snapshots (
  id BIGSERIAL PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_url TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  http_status INTEGER,
  etag TEXT,
  last_modified TEXT,
  content_sha256 TEXT NOT NULL,
  content_text TEXT NOT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (source_url, content_sha256)
);

CREATE TABLE IF NOT EXISTS ingestion_runs (
  id BIGSERIAL PRIMARY KEY,
  source_type TEXT NOT NULL,
  job_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',
  parser_version TEXT NOT NULL,
  source_count INTEGER NOT NULL DEFAULT 0,
  records_created INTEGER NOT NULL DEFAULT 0,
  records_updated INTEGER NOT NULL DEFAULT 0,
  records_deleted INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS unity_releases (
  id BIGSERIAL PRIMARY KEY,
  version TEXT NOT NULL UNIQUE,
  major_line TEXT NOT NULL,
  minor_line TEXT NOT NULL,
  patch INTEGER NOT NULL,
  suffix_channel TEXT NOT NULL,
  suffix_number INTEGER NOT NULL,
  stream TEXT NOT NULL,
  release_date TIMESTAMPTZ,
  changeset TEXT,
  short_revision TEXT,
  release_page_url TEXT NOT NULL,
  release_notes_url TEXT,
  unity_hub_deep_link TEXT,
  raw_metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_snapshot_id BIGINT REFERENCES source_snapshots(id),
  ingestion_run_id BIGINT REFERENCES ingestion_runs(id),
  parser_version TEXT NOT NULL,
  normalized_sha256 TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS release_sections (
  id BIGSERIAL PRIMARY KEY,
  unity_release_id BIGINT NOT NULL REFERENCES unity_releases(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  body TEXT NOT NULL,
  parser_confidence NUMERIC NOT NULL DEFAULT 1,
  source_order INTEGER NOT NULL,
  source_snapshot_id BIGINT REFERENCES source_snapshots(id),
  ingestion_run_id BIGINT REFERENCES ingestion_runs(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (unity_release_id, section, source_order)
);

CREATE TABLE IF NOT EXISTS release_note_items (
  id BIGSERIAL PRIMARY KEY,
  unity_release_id BIGINT NOT NULL REFERENCES unity_releases(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  major_line TEXT NOT NULL,
  minor_line TEXT NOT NULL,
  stream TEXT NOT NULL,
  release_date TIMESTAMPTZ,
  section TEXT NOT NULL,
  area TEXT,
  platforms TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  impact_kind TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  risk_reasons TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  body TEXT NOT NULL,
  issue_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  issue_text TEXT NOT NULL DEFAULT '',
  issue_links_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  package_names TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  source_url TEXT NOT NULL,
  source_anchor TEXT,
  source_order INTEGER NOT NULL,
  source_snapshot_id BIGINT REFERENCES source_snapshots(id),
  ingestion_run_id BIGINT REFERENCES ingestion_runs(id),
  parser_version TEXT NOT NULL,
  normalized_sha256 TEXT NOT NULL,
  search_vector tsvector NOT NULL DEFAULT ''::tsvector,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (unity_release_id, section, source_order, normalized_sha256)
);

CREATE TABLE IF NOT EXISTS unity_release_artifacts (
  id BIGSERIAL PRIMARY KEY,
  unity_release_id BIGINT NOT NULL REFERENCES unity_releases(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  architecture TEXT NOT NULL,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  checksum TEXT,
  size_bytes BIGINT,
  is_headless_suitable BOOLEAN NOT NULL DEFAULT false,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_snapshot_id BIGINT REFERENCES source_snapshots(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (unity_release_id, platform, architecture, category, name, url)
);

CREATE TABLE IF NOT EXISTS unity_release_modules (
  id BIGSERIAL PRIMARY KEY,
  unity_release_id BIGINT NOT NULL REFERENCES unity_releases(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  architecture TEXT NOT NULL,
  module_name TEXT NOT NULL,
  module_category TEXT NOT NULL,
  url TEXT NOT NULL,
  checksum TEXT,
  size_bytes BIGINT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_snapshot_id BIGINT REFERENCES source_snapshots(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (unity_release_id, platform, architecture, module_name, url)
);

CREATE TABLE IF NOT EXISTS issue_mentions (
  id BIGSERIAL PRIMARY KEY,
  issue_id TEXT NOT NULL,
  issue_url TEXT NOT NULL,
  unity_release_id BIGINT NOT NULL REFERENCES unity_releases(id) ON DELETE CASCADE,
  release_note_item_id BIGINT REFERENCES release_note_items(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  area TEXT,
  platforms TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  mention_kind TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS packages (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT,
  description TEXT,
  documentation_url TEXT,
  keywords TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  source_url TEXT NOT NULL,
  source_snapshot_id BIGINT REFERENCES source_snapshots(id),
  ingestion_run_id BIGINT REFERENCES ingestion_runs(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS package_versions (
  id BIGSERIAL PRIMARY KEY,
  package_id BIGINT NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  published_at TIMESTAMPTZ,
  unity_compatibility TEXT,
  unity_min_version TEXT,
  unity_max_version TEXT,
  is_prerelease BOOLEAN NOT NULL DEFAULT false,
  changelog TEXT,
  dependencies_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  dist_tags_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  tarball_url TEXT,
  shasum TEXT,
  raw_metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_snapshot_id BIGINT REFERENCES source_snapshots(id),
  ingestion_run_id BIGINT REFERENCES ingestion_runs(id),
  parser_version TEXT NOT NULL,
  normalized_sha256 TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (package_id, version)
);

-- Package versions Unity ships *bundled with a given Editor*, mined from
-- the "Package changes" block of each release's notes. This is the
-- Unity-6-accurate source for Editor-bound packages whose package-registry
-- "latest" is frozen (e.g. URP shows 10.10.1 on the registry but ships as
-- 17.0.3 in 6000.0.23f1). package_name is intentionally not a FK - notes can
-- mention packages we don't carry a registry row for.
CREATE TABLE IF NOT EXISTS editor_package_versions (
  id BIGSERIAL PRIMARY KEY,
  unity_release_id BIGINT NOT NULL REFERENCES unity_releases(id) ON DELETE CASCADE,
  editor_version TEXT NOT NULL,
  package_name TEXT NOT NULL,
  from_version TEXT,
  to_version TEXT,
  change_kind TEXT NOT NULL,
  source_snapshot_id BIGINT REFERENCES source_snapshots(id),
  ingestion_run_id BIGINT REFERENCES ingestion_runs(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (unity_release_id, package_name, change_kind)
);

CREATE INDEX IF NOT EXISTS idx_editor_package_versions_package ON editor_package_versions (package_name);
CREATE INDEX IF NOT EXISTS idx_editor_package_versions_editor ON editor_package_versions (editor_version);

-- Packages that adopted Unity 6.4+ "unified versioning" - the package version
-- is renumbered to match the Editor (e.g. com.unity.entities ships as 6.4.0 in
-- Unity 6.4) and only exists in the docs, while the registry keeps serving the
-- old line (1.4.x) for earlier Unity 6. Discovered by probing
-- docs.unity3d.com/Packages/<pkg>@<unity-minor>. One row per package: the
-- highest Unity minor at which a version-aligned build is documented.
CREATE TABLE IF NOT EXISTS package_unified_versions (
  id BIGSERIAL PRIMARY KEY,
  package_name TEXT NOT NULL UNIQUE,
  unity_minor TEXT NOT NULL,          -- e.g. "6.4"
  aligned_version TEXT NOT NULL,      -- e.g. "6.4.0"
  released_on DATE,                   -- from the changelog entry
  doc_url TEXT NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS blog_posts (
  id BIGSERIAL PRIMARY KEY,
  guid TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  link TEXT NOT NULL,
  published_at TIMESTAMPTZ,
  categories TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  raw_xml_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resources (
  id BIGSERIAL PRIMARY KEY,
  -- Stable identifier from Unity's URL: the `/resources/<slug>` segment.
  slug TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  og_image TEXT,
  -- Content-type label as Unity tags it (E-book, Video, Webinar, …).
  resource_type TEXT,
  -- Industry tag - Unity uses 'Other' (or NULL) for games content; any
  -- other value (Automotive, Manufacturing, Retail, Multi …) signals
  -- enterprise/buyer-pitch content.
  industry TEXT,
  topics TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  -- Resources behind a Salesforce form fill ("download to read").
  is_gated BOOLEAN NOT NULL DEFAULT false,
  sfdc_form_id TEXT,
  resource_date DATE,
  read_duration TEXT,
  author TEXT,
  -- Sitemap <lastmod> drives the incremental ingester: only re-fetch
  -- when this advances beyond the value we already have on file.
  lastmod TIMESTAMPTZ,
  body_hash TEXT,
  raw_metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_snapshot_id BIGINT REFERENCES source_snapshots(id),
  ingestion_run_id BIGINT REFERENCES ingestion_runs(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hub_releases (
  id BIGSERIAL PRIMARY KEY,
  version TEXT NOT NULL UNIQUE,
  release_date TIMESTAMPTZ,
  body TEXT NOT NULL,
  source_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  event_time TIMESTAMPTZ NOT NULL,
  source_url TEXT NOT NULL,
  unity_release_id BIGINT REFERENCES unity_releases(id) ON DELETE CASCADE,
  package_version_id BIGINT REFERENCES package_versions(id) ON DELETE CASCADE,
  blog_post_id BIGINT REFERENCES blog_posts(id) ON DELETE CASCADE,
  hub_release_id BIGINT REFERENCES hub_releases(id) ON DELETE CASCADE,
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  stable_guid TEXT NOT NULL UNIQUE,
  risk_level TEXT,
  source_snapshot_id BIGINT REFERENCES source_snapshots(id),
  ingestion_run_id BIGINT REFERENCES ingestion_runs(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_release_note_items_search ON release_note_items USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_release_note_items_body_trgm ON release_note_items USING GIN (body gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_release_note_items_version ON release_note_items (version);
CREATE INDEX IF NOT EXISTS idx_release_note_items_minor_line ON release_note_items (minor_line);
CREATE INDEX IF NOT EXISTS idx_release_note_items_stream ON release_note_items (stream);
CREATE INDEX IF NOT EXISTS idx_release_note_items_section ON release_note_items (section);
CREATE INDEX IF NOT EXISTS idx_release_note_items_area ON release_note_items (area);
CREATE INDEX IF NOT EXISTS idx_release_note_items_impact ON release_note_items (impact_kind);
CREATE INDEX IF NOT EXISTS idx_release_note_items_risk ON release_note_items (risk_level);
CREATE INDEX IF NOT EXISTS idx_release_note_items_release_id ON release_note_items (unity_release_id);
-- Composite indexes that cover the diff-page lane queries (filter by impact + range, sort by date).
CREATE INDEX IF NOT EXISTS idx_release_note_items_impact_date ON release_note_items (impact_kind, release_date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_release_note_items_release_date ON release_note_items (release_date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_release_note_items_platforms ON release_note_items USING GIN (platforms);
CREATE INDEX IF NOT EXISTS idx_release_note_items_packages ON release_note_items USING GIN (package_names);
CREATE INDEX IF NOT EXISTS idx_release_note_items_issues ON release_note_items USING GIN (issue_ids);
CREATE INDEX IF NOT EXISTS idx_release_note_items_issue_text_trgm ON release_note_items USING GIN (issue_text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_unity_release_artifacts_release_id ON unity_release_artifacts (unity_release_id);
CREATE INDEX IF NOT EXISTS idx_unity_release_modules_release_id ON unity_release_modules (unity_release_id);
CREATE INDEX IF NOT EXISTS idx_issue_mentions_release_id ON issue_mentions (unity_release_id);
CREATE INDEX IF NOT EXISTS idx_issue_mentions_issue_id ON issue_mentions (issue_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_issue_mentions_issue_release ON issue_mentions (issue_id, unity_release_id, release_note_item_id);
-- Supports the FK cascade DELETE that fires when release_note_items
-- rows are replaced during editor-release re-ingest. Without this
-- index, the cascade triggers a seq-scan of the 76k-row
-- issue_mentions table per deleted parent row, which blows past the
-- 8s statement_timeout once a release touches enough rows. (The
-- existing uniq_issue_mentions_issue_release index has
-- release_note_item_id in the third column, so it can't service a
-- lookup keyed on it alone.) Caused the cron-all editor job to fail
-- in prod on 2026-05-17.
CREATE INDEX IF NOT EXISTS idx_issue_mentions_release_note_item_id ON issue_mentions (release_note_item_id);
-- Powers the build-score / upgrade-score CTEs in `getIssueLifespans`
-- and the longest-open / fastest-fix facts in `getVersionFacts`. Without
-- this index Postgres seq-scans the 70k+ row issue_mentions table twice
-- per /visualizer render (once for 'Known Issues', once for 'Fixes').
CREATE INDEX IF NOT EXISTS idx_issue_mentions_section_issue ON issue_mentions (section, issue_id, unity_release_id);
-- Powers the per-version COUNT(*) FILTER aggregates used by
-- getVersionAggregates / getScoreInputs / getVersionFacts. The existing
-- `idx_release_note_items_impact` is single-column on impact_kind only;
-- pairing with version turns the per-fact `GROUP BY version` queries
-- into Index Only Scans.
CREATE INDEX IF NOT EXISTS idx_release_note_items_impact_version ON release_note_items (impact_kind, version);
CREATE INDEX IF NOT EXISTS idx_package_versions_package_id ON package_versions (package_id);
CREATE INDEX IF NOT EXISTS idx_content_events_time ON content_events (event_time DESC);
CREATE INDEX IF NOT EXISTS idx_content_events_type ON content_events (event_type);
CREATE INDEX IF NOT EXISTS idx_resources_date ON resources (resource_date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_resources_type ON resources (resource_type);
CREATE INDEX IF NOT EXISTS idx_resources_industry ON resources (industry);
CREATE INDEX IF NOT EXISTS idx_resources_gated ON resources (is_gated);
CREATE INDEX IF NOT EXISTS idx_resources_topics ON resources USING GIN (topics);

CREATE OR REPLACE FUNCTION update_release_note_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.issue_text := array_to_string(NEW.issue_ids, ' ');
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.version, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.section, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.area, '')), 'A') ||
    setweight(to_tsvector('english', array_to_string(NEW.issue_ids, ' ')), 'A') ||
    setweight(to_tsvector('english', array_to_string(NEW.package_names, ' ')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.body, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_release_note_items_search_vector ON release_note_items;
CREATE TRIGGER trg_release_note_items_search_vector
BEFORE INSERT OR UPDATE ON release_note_items
FOR EACH ROW EXECUTE FUNCTION update_release_note_search_vector();

-- Lightweight self-hosted analytics. We deliberately do NOT store IPs,
-- user-agent strings, or any other identifier. The whole point is to
-- count pageviews + UX interactions for the public /stats page without
-- introducing a vendor dependency or a GDPR surface. If we ever need
-- unique-visitor estimates we can add a hashed (ip + day-salt) column
-- later; for now we trade that granularity for being radically simple
-- to operate.
CREATE TABLE IF NOT EXISTS page_views (
  id BIGSERIAL PRIMARY KEY,
  path TEXT NOT NULL,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_page_views_viewed_at ON page_views (viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_path_time ON page_views (path, viewed_at DESC);

CREATE TABLE IF NOT EXISTS site_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  event_path TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_site_events_occurred_at ON site_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_events_type_time ON site_events (event_type, occurred_at DESC);

-- =====================================================================
-- Unity Discussions (discussions.unity.com) staff post tracking
--
-- The forum is Discourse; staff are the `unity_staff` user group
-- (id 41). We ingest posts authored by staff group members, store
-- each post's live state, and append an immutable revision row
-- every time we observe a real change (raw_sha256 differs or version
-- bumped). The ingester runs inside the existing mega-cron at
-- 00:00 + 12:00 UTC and rate-limits itself to 60 req/min.
--
-- discourse_post_id, discourse_user_id, discourse_category_id are
-- the upstream identifiers from Discourse — never reassigned, used
-- as upsert keys. Our own BIGSERIAL `id` is what other tables FK to.
-- =====================================================================
CREATE TABLE IF NOT EXISTS discourse_staff_users (
  id BIGSERIAL PRIMARY KEY,
  discourse_user_id BIGINT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  display_name TEXT,
  avatar_template TEXT,
  user_title TEXT,
  trust_level INTEGER,
  primary_group_name TEXT,
  flair_group_id INTEGER,
  -- Last activity timestamps as Discourse reports them. last_seen_at
  -- is Discourse-login activity; last_posted_at drives the active-user
  -- filter the ingester uses to skip dormant ex-employees.
  last_posted_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  added_to_group_at TIMESTAMPTZ,
  -- False when a roster walk no longer sees this username under
  -- unity_staff. We keep the row + its posts so historical attribution
  -- survives, but new posts won't be polled.
  active_in_group BOOLEAN NOT NULL DEFAULT true,
  last_polled_at TIMESTAMPTZ,
  raw_metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_snapshot_id BIGINT REFERENCES source_snapshots(id),
  ingestion_run_id BIGINT REFERENCES ingestion_runs(id),
  parser_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS discourse_categories (
  id BIGSERIAL PRIMARY KEY,
  discourse_category_id INTEGER NOT NULL UNIQUE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_discourse_category_id INTEGER,
  description TEXT,
  color TEXT,
  text_color TEXT,
  raw_metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_snapshot_id BIGINT REFERENCES source_snapshots(id),
  ingestion_run_id BIGINT REFERENCES ingestion_runs(id),
  parser_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS discourse_posts (
  id BIGSERIAL PRIMARY KEY,
  -- Upstream identifiers. discourse_post_id is the upsert key.
  discourse_post_id BIGINT NOT NULL UNIQUE,
  discourse_topic_id BIGINT NOT NULL,
  post_number INTEGER NOT NULL,
  topic_slug TEXT,
  topic_title TEXT,
  -- Author. FK to our staff_users for join-friendly queries, plus
  -- denormalized fields so the list view doesn't need a JOIN on every
  -- row. was_staff_at_post is the *ingest-time* attestation that the
  -- author was in unity_staff when we saw the post — set TRUE
  -- unconditionally during the staff-user fan-out per critique risk
  -- #4. Defends against later group changes mis-relabeling history.
  staff_user_id BIGINT REFERENCES discourse_staff_users(id) ON DELETE SET NULL,
  discourse_user_id BIGINT NOT NULL,
  username TEXT NOT NULL,
  was_staff_at_post BOOLEAN NOT NULL DEFAULT true,
  -- Category + tags denormalized for list-page filtering.
  -- discourse_category_id stays nullable when a topic is in a private
  -- category we can't read.
  discourse_category_id INTEGER,
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  -- Live post state.
  raw TEXT NOT NULL,
  cooked TEXT NOT NULL,
  excerpt TEXT,
  raw_sha256 TEXT NOT NULL,
  -- Discourse's own version counter; bumps on every edit (author or
  -- moderation). Stored as INTEGER for direct comparison.
  discourse_version INTEGER NOT NULL DEFAULT 1,
  edit_reason TEXT,
  -- Discourse-reported timestamps. last_edited_at moves only on real
  -- changes (set by ingester when version bumps or raw_sha256
  -- differs). updated_at on this row moves on every poll for
  -- bookkeeping.
  discourse_created_at TIMESTAMPTZ NOT NULL,
  discourse_updated_at TIMESTAMPTZ NOT NULL,
  last_edited_at TIMESTAMPTZ,
  -- Engagement signals.
  reply_count INTEGER NOT NULL DEFAULT 0,
  reads INTEGER,
  score NUMERIC(10, 2),
  incoming_link_count INTEGER NOT NULL DEFAULT 0,
  -- Soft-delete: when /posts/:id.json returns 404, the row stays so
  -- links keep resolving; the page just renders a tombstone.
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  -- Provenance.
  raw_metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  search_vector TSVECTOR,
  source_snapshot_id BIGINT REFERENCES source_snapshots(id),
  ingestion_run_id BIGINT REFERENCES ingestion_runs(id),
  parser_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Append-only audit log: every real change to a discourse_posts row
-- produces a revision. The UNIQUE constraint guarantees an idempotent
-- ingest — re-seeing the same (post, version) tuple is a no-op insert.
CREATE TABLE IF NOT EXISTS discourse_post_revisions (
  id BIGSERIAL PRIMARY KEY,
  -- FK by surrogate id (consistent with the rest of the schema where
  -- FKs target BIGSERIAL pks, not UNIQUE upstream-id columns). No
  -- CASCADE because discourse_posts are soft-deleted in practice —
  -- a revision outliving its parent is the explicit audit-log goal.
  discourse_post_db_id BIGINT NOT NULL REFERENCES discourse_posts(id) ON DELETE NO ACTION,
  discourse_post_id BIGINT NOT NULL,
  discourse_version INTEGER NOT NULL,
  raw TEXT NOT NULL,
  raw_sha256 TEXT NOT NULL,
  edit_reason TEXT,
  observed_updated_at TIMESTAMPTZ NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_snapshot_id BIGINT REFERENCES source_snapshots(id),
  ingestion_run_id BIGINT REFERENCES ingestion_runs(id),
  parser_version TEXT NOT NULL,
  UNIQUE (discourse_post_id, discourse_version)
);

-- Lookup + sort indexes.
CREATE INDEX IF NOT EXISTS idx_discourse_staff_users_username ON discourse_staff_users (username);
CREATE INDEX IF NOT EXISTS idx_discourse_staff_users_active ON discourse_staff_users (active_in_group, last_posted_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_discourse_categories_slug ON discourse_categories (slug);
CREATE INDEX IF NOT EXISTS idx_discourse_posts_updated_at ON discourse_posts (discourse_updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_discourse_posts_created_at ON discourse_posts (discourse_created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discourse_posts_user ON discourse_posts (discourse_user_id);
CREATE INDEX IF NOT EXISTS idx_discourse_posts_category ON discourse_posts (discourse_category_id);
CREATE INDEX IF NOT EXISTS idx_discourse_posts_tags ON discourse_posts USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_discourse_posts_search ON discourse_posts USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_discourse_posts_body_trgm ON discourse_posts USING GIN (raw gin_trgm_ops);
-- Partial index: the list page defaults to visible posts ordered by
-- recent activity. Trimming deleted + non-staff rows keeps the index
-- small and the default query a single seek.
CREATE INDEX IF NOT EXISTS idx_discourse_posts_visible_recent ON discourse_posts (discourse_updated_at DESC)
  WHERE is_deleted = false AND was_staff_at_post = true;
CREATE INDEX IF NOT EXISTS idx_discourse_post_revisions_post ON discourse_post_revisions (discourse_post_id, discourse_version DESC);

-- tsvector trigger: title (A) + author handle (B) + raw body (C).
-- Mirrors the release_note_items pattern but weighted for "who said
-- what about which Unity feature."
CREATE OR REPLACE FUNCTION update_discourse_post_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.topic_title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.username, '')), 'B') ||
    setweight(to_tsvector('english', array_to_string(NEW.tags, ' ')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.raw, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_discourse_posts_search_vector ON discourse_posts;
CREATE TRIGGER trg_discourse_posts_search_vector
BEFORE INSERT OR UPDATE ON discourse_posts
FOR EACH ROW EXECUTE FUNCTION update_discourse_post_search_vector();


-- =====================================================================
-- Unity GitHub (github.com/Unity-Technologies) public org tracking
--
-- We mirror the org's public repositories and recent public activity
-- so the /github page can show latest updates (releases/pushes), newest
-- projects, popular repos (by stars), and a hand-curated "notable" set.
-- The ingester runs inside the mega-cron and uses GITHUB_TOKEN when set
-- (5000 req/hr) or unauthenticated (60 req/hr) otherwise.
--
-- github_repo_id / github_event_id are the upstream numeric ids, used
-- as upsert/dedupe keys; our BIGSERIAL `id` is the local key.
-- =====================================================================
CREATE TABLE IF NOT EXISTS github_repos (
  id BIGSERIAL PRIMARY KEY,
  github_repo_id BIGINT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  owner TEXT NOT NULL,
  description TEXT,
  html_url TEXT NOT NULL,
  homepage TEXT,
  -- Popularity / activity signals as GitHub reports them.
  stargazers_count INTEGER NOT NULL DEFAULT 0,
  forks_count INTEGER NOT NULL DEFAULT 0,
  open_issues_count INTEGER NOT NULL DEFAULT 0,
  watchers_count INTEGER NOT NULL DEFAULT 0,
  language TEXT,
  topics TEXT[] NOT NULL DEFAULT '{}',
  license_spdx TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  is_fork BOOLEAN NOT NULL DEFAULT false,
  is_template BOOLEAN NOT NULL DEFAULT false,
  default_branch TEXT,
  size_kb INTEGER,
  -- Curated highlight flag, set by the ingester from a maintained list.
  is_notable BOOLEAN NOT NULL DEFAULT false,
  -- Upstream timestamps. repo_pushed_at drives "latest updates" by repo;
  -- repo_created_at drives "new projects".
  repo_created_at TIMESTAMPTZ,
  repo_updated_at TIMESTAMPTZ,
  repo_pushed_at TIMESTAMPTZ,
  -- first_seen_at is ours (when we first ingested it); useful for "new to
  -- us" even if GitHub's created_at is old.
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_sha256 TEXT,
  source_snapshot_id BIGINT REFERENCES source_snapshots(id),
  ingestion_run_id BIGINT REFERENCES ingestion_runs(id),
  search_vector tsvector,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Append/dedupe log of recent public org activity (releases, pushes,
-- new repos). Keyed by GitHub's event id, which is unique and stable.
CREATE TABLE IF NOT EXISTS github_events (
  id BIGSERIAL PRIMARY KEY,
  github_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  repo_full_name TEXT NOT NULL,
  repo_github_id BIGINT,
  actor_login TEXT,
  actor_avatar_url TEXT,
  -- Human one-liner derived at ingest time (e.g. "Released v2.1.0").
  summary TEXT NOT NULL,
  ref TEXT,
  html_url TEXT,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  event_created_at TIMESTAMPTZ NOT NULL,
  ingestion_run_id BIGINT REFERENCES ingestion_runs(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_github_repos_stars ON github_repos (stargazers_count DESC);
CREATE INDEX IF NOT EXISTS idx_github_repos_created ON github_repos (repo_created_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_github_repos_pushed ON github_repos (repo_pushed_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_github_repos_notable ON github_repos (is_notable) WHERE is_notable = true;
CREATE INDEX IF NOT EXISTS idx_github_repos_language ON github_repos (language);
CREATE INDEX IF NOT EXISTS idx_github_repos_topics ON github_repos USING GIN (topics);
CREATE INDEX IF NOT EXISTS idx_github_repos_search ON github_repos USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_github_events_created ON github_events (event_created_at DESC);
CREATE INDEX IF NOT EXISTS idx_github_events_repo ON github_events (repo_full_name);
CREATE INDEX IF NOT EXISTS idx_github_events_type ON github_events (event_type);

-- search_vector: repo name (A) + topics (B) + description (C).
CREATE OR REPLACE FUNCTION update_github_repo_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', array_to_string(NEW.topics, ' ')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_github_repos_search_vector ON github_repos;
CREATE TRIGGER trg_github_repos_search_vector
BEFORE INSERT OR UPDATE ON github_repos
FOR EACH ROW EXECUTE FUNCTION update_github_repo_search_vector();

-- Head commit message for PushEvents, so repo cards can show the latest
-- commit without an extra per-repo API call. Additive for existing deploys.
ALTER TABLE github_events ADD COLUMN IF NOT EXISTS head_commit_message TEXT;

-- Latest commit on each repo's default branch, fetched per-repo during
-- ingestion (the org events feed doesn't carry commit messages). Powers
-- the "latest commit" line on repo cards. Additive for existing deploys.
ALTER TABLE github_repos ADD COLUMN IF NOT EXISTS latest_commit_message TEXT;
ALTER TABLE github_repos ADD COLUMN IF NOT EXISTS latest_commit_at TIMESTAMPTZ;
ALTER TABLE github_repos ADD COLUMN IF NOT EXISTS latest_commit_url TEXT;
