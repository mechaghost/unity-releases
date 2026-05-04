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
CREATE INDEX IF NOT EXISTS idx_release_note_items_section ON release_note_items (section);
CREATE INDEX IF NOT EXISTS idx_release_note_items_area ON release_note_items (area);
CREATE INDEX IF NOT EXISTS idx_release_note_items_impact ON release_note_items (impact_kind);
CREATE INDEX IF NOT EXISTS idx_release_note_items_risk ON release_note_items (risk_level);
CREATE INDEX IF NOT EXISTS idx_release_note_items_platforms ON release_note_items USING GIN (platforms);
CREATE INDEX IF NOT EXISTS idx_release_note_items_packages ON release_note_items USING GIN (package_names);
CREATE INDEX IF NOT EXISTS idx_release_note_items_issues ON release_note_items USING GIN (issue_ids);
CREATE INDEX IF NOT EXISTS idx_release_note_items_issue_text_trgm ON release_note_items USING GIN (issue_text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_content_events_time ON content_events (event_time DESC);

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
