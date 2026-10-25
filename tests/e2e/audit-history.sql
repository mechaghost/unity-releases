-- Older data exercises complete histories without changing the newest-update fixtures.
INSERT INTO unity_releases (
  version, major_line, minor_line, patch, suffix_channel, suffix_number,
  stream, release_date, release_page_url, release_notes_url,
  raw_metadata_json, parser_version, normalized_sha256
)
VALUES
  ('2022.3.1f1', '2022', '2022.3', 1, 'f', 1, 'LTS', '2025-01-01',
   'https://unity.com/releases/editor/whats-new/2022.3.1f1',
   'https://unity.com/releases/editor/whats-new/2022.3.1f1', '{}', 'e2e-v1', 'audit-legacy-release'),
  ('6000.0.0f1', '6000', '6000.0', 0, 'f', 1, 'LTS', '2025-06-01',
   'https://unity.com/releases/editor/whats-new/6000.0.0f1',
   'https://unity.com/releases/editor/whats-new/6000.0.0f1', '{}', 'e2e-v1', 'audit-modern-release');

INSERT INTO release_note_items (
  unity_release_id, version, major_line, minor_line, stream, release_date,
  section, area, platforms, impact_kind, risk_level, risk_reasons, body,
  issue_ids, issue_links_json, package_names, source_url, source_order,
  parser_version, normalized_sha256
)
SELECT r.id, r.version, r.major_line, r.minor_line, r.stream, r.release_date,
  'Fixes', 'Editor', ARRAY['Windows'], 'fix', 'info', ARRAY[]::text[],
  'Audit history note ' || n, ARRAY['UUM-99155'], '[]', ARRAY[]::text[],
  r.release_notes_url, n, 'e2e-v1', 'audit-note-' || n
FROM unity_releases r CROSS JOIN generate_series(1, 154) n
WHERE r.version = '6000.0.0f1';

INSERT INTO release_note_items (
  unity_release_id, version, major_line, minor_line, stream, release_date,
  section, area, platforms, impact_kind, risk_level, risk_reasons, body,
  issue_ids, issue_links_json, package_names, source_url, source_order,
  parser_version, normalized_sha256
)
SELECT id, version, major_line, minor_line, stream, release_date,
  'Fixes', 'Editor', ARRAY['Windows'], 'fix', 'info', ARRAY[]::text[],
  'Audit history earliest legacy fix', ARRAY['UUM-99155'], '[]', ARRAY[]::text[],
  release_notes_url, 1, 'e2e-v1', 'audit-note-legacy'
FROM unity_releases WHERE version = '2022.3.1f1';

INSERT INTO packages (name, display_name, description, source_url)
VALUES ('com.unity.audit-history', 'Audit History', 'A paged history fixture.',
        'https://packages.unity.com/com.unity.audit-history');

INSERT INTO package_versions (
  package_id, version, published_at, unity_compatibility, is_prerelease,
  changelog, parser_version, normalized_sha256
)
SELECT p.id, '1.0.' || n, '2025-01-01'::timestamptz + n * interval '1 day',
  '6000.0', false, 'Audit package history entry ' || n, 'e2e-v1', 'audit-package-' || n
FROM packages p CROSS JOIN generate_series(1, 55) n
WHERE p.name = 'com.unity.audit-history';

INSERT INTO resources (slug, url, title, summary, resource_type, resource_date)
SELECT 'audit-history-' || lpad(n::text, 3, '0'),
  'https://unity.com/resources/audit-history-' || n,
  'Audit-history resource ' || lpad(n::text, 3, '0'),
  'Pagination fixture', CASE WHEN n % 2 = 0 THEN 'Article' ELSE 'Video' END,
  '2025-01-01'::date
FROM generate_series(1, 205) n;
