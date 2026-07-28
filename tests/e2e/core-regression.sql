INSERT INTO ingestion_runs (
  source_type, job_name, started_at, finished_at, status, parser_version,
  source_count, records_created, records_updated
)
VALUES
  ('editor_release', 'e2e-editor', '2026-07-27T00:00:00Z', '2026-07-27T00:00:05Z', 'success', 'e2e-v1', 2, 2, 0),
  ('package_registry', 'e2e-packages', '2026-07-27T00:05:00Z', '2026-07-27T00:05:02Z', 'success', 'e2e-v1', 1, 1, 0);

INSERT INTO unity_releases (
  version, major_line, minor_line, patch, suffix_channel, suffix_number,
  stream, release_date, release_page_url, release_notes_url,
  raw_metadata_json, parser_version, normalized_sha256
)
VALUES
  (
    '6000.0.1f1', '6000', '6000.0', 1, 'f', 1, 'LTS',
    '2026-07-01T00:00:00Z',
    'https://unity.com/releases/editor/whats-new/6000.0.1',
    'https://unity.com/releases/editor/whats-new/6000.0.1',
    '{}'::jsonb, 'e2e-v1', 'e2e-release-1'
  ),
  (
    '6000.0.2f1', '6000', '6000.0', 2, 'f', 1, 'LTS',
    '2026-07-15T00:00:00Z',
    'https://unity.com/releases/editor/whats-new/6000.0.2',
    'https://unity.com/releases/editor/whats-new/6000.0.2',
    '{}'::jsonb, 'e2e-v1', 'e2e-release-2'
  );

INSERT INTO release_note_items (
  unity_release_id, version, major_line, minor_line, stream, release_date,
  section, area, platforms, impact_kind, risk_level, risk_reasons, body,
  issue_ids, issue_links_json, package_names, source_url, source_order,
  parser_version, normalized_sha256
)
SELECT
  id, version, major_line, minor_line, stream, release_date,
  'Known Issues', 'Editor', ARRAY['Windows'], 'known_issue', 'caution',
  ARRAY['Known issue'], 'The editor may become unresponsive while importing a test asset.',
  ARRAY['UUM-10001'],
  '[{"id":"UUM-10001","url":"https://issuetracker.unity3d.com/issues/uum-10001"}]'::jsonb,
  ARRAY[]::text[], release_notes_url, 1, 'e2e-v1', 'e2e-note-known'
FROM unity_releases
WHERE version = '6000.0.1f1';

INSERT INTO release_note_items (
  unity_release_id, version, major_line, minor_line, stream, release_date,
  section, area, platforms, impact_kind, risk_level, risk_reasons, body,
  issue_ids, issue_links_json, package_names, source_url, source_order,
  parser_version, normalized_sha256
)
SELECT
  id, version, major_line, minor_line, stream, release_date,
  'Fixes', 'Editor', ARRAY['Windows'], 'fix', 'info',
  ARRAY[]::text[], 'Fixed an editor import hang tracked as UUM-10001.',
  ARRAY['UUM-10001'],
  '[{"id":"UUM-10001","url":"https://issuetracker.unity3d.com/issues/uum-10001"}]'::jsonb,
  ARRAY[]::text[], release_notes_url, 1, 'e2e-v1', 'e2e-note-fix'
FROM unity_releases
WHERE version = '6000.0.2f1';

INSERT INTO issue_mentions (
  issue_id, issue_url, unity_release_id, release_note_item_id, section,
  area, platforms, mention_kind
)
SELECT
  'UUM-10001',
  'https://issuetracker.unity3d.com/issues/uum-10001',
  unity_release_id,
  id,
  section,
  area,
  platforms,
  CASE WHEN impact_kind = 'fix' THEN 'fix' ELSE 'known_issue' END
FROM release_note_items
WHERE 'UUM-10001' = ANY(issue_ids);

INSERT INTO packages (
  name, display_name, description, documentation_url, keywords, source_url
)
VALUES (
  'com.unity.inputsystem',
  'Input System',
  'A test official Unity package used by the deterministic regression fixture.',
  'https://docs.unity3d.com/Packages/com.unity.inputsystem@1.11/manual/index.html',
  ARRAY['input'],
  'https://packages.unity.com/com.unity.inputsystem'
);

INSERT INTO package_versions (
  package_id, version, published_at, unity_compatibility, is_prerelease,
  changelog, dependencies_json, dist_tags_json, raw_metadata_json,
  parser_version, normalized_sha256
)
SELECT
  id, '1.11.2', '2026-07-10T00:00:00Z', '6000.0', false,
  'Deterministic fixture package update.', '{}'::jsonb, '{}'::jsonb,
  '{}'::jsonb, 'e2e-v1', 'e2e-package-version'
FROM packages
WHERE name = 'com.unity.inputsystem';

INSERT INTO editor_package_versions (
  unity_release_id, editor_version, package_name, from_version, to_version,
  change_kind
)
SELECT id, version, 'com.unity.inputsystem', '1.11.1', '1.11.2', 'updated'
FROM unity_releases
WHERE version = '6000.0.2f1';

INSERT INTO blog_posts (
  guid, title, description, link, published_at, categories, raw_xml_json
)
VALUES (
  'e2e-news-1',
  'Deterministic Unity news fixture',
  'A stable news entry for browser regression tests.',
  'https://unity.com/blog/e2e-news',
  '2026-07-20T00:00:00Z',
  ARRAY['Unity'],
  '{}'::jsonb
);

INSERT INTO resources (
  slug, url, title, summary, resource_type, topics, is_gated, resource_date
)
VALUES (
  'e2e-resource',
  'https://unity.com/resources/e2e-resource',
  'Deterministic Unity resource fixture',
  'A stable resource entry for browser regression tests.',
  'Guide',
  ARRAY['Unity 6'],
  false,
  '2026-07-18'
);

INSERT INTO content_events (
  event_type, title, summary, event_time, source_url, unity_release_id,
  stable_guid, tags, risk_level
)
SELECT
  'unity_release',
  'Unity 6000.0.2f1',
  'Deterministic core activity event.',
  release_date,
  release_page_url,
  id,
  'e2e-event-release-2',
  ARRAY['LTS'],
  'info'
FROM unity_releases
WHERE version = '6000.0.2f1';
