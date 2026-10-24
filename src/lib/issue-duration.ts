/**
 * Days in the observed open period. The issue queries all use fk/ff for
 * first known/fix and lk/lf for latest known/fix. Cross-line fixes cannot
 * establish a closed duration, so return NULL rather than a misleading age.
 * Reopened issues start at the first Known Issues mention after the last fix.
 */
export const ISSUE_DAYS_OPEN_SQL = `CASE
  WHEN fk.release_date IS NULL OR fk.release_date > now() THEN NULL
  WHEN lf.release_date IS NOT NULL AND lk.release_date > lf.release_date THEN
    EXTRACT(EPOCH FROM (now() - (
      SELECT MIN(reopened_release.release_date)
      FROM issue_mentions reopened_mention
      JOIN unity_releases reopened_release ON reopened_release.id = reopened_mention.unity_release_id
      WHERE reopened_mention.issue_id = fk.issue_id
        AND reopened_mention.section = 'Known Issues'
        AND reopened_release.release_date > lf.release_date
        AND reopened_release.release_date <= now()
    ))) / 86400
  WHEN ff.release_date IS NULL THEN EXTRACT(EPOCH FROM (now() - fk.release_date)) / 86400
  WHEN ff.release_date < fk.release_date
    OR split_part(ff.version, '.', 1) <> split_part(fk.version, '.', 1)
    OR split_part(ff.version, '.', 2) <> split_part(fk.version, '.', 2) THEN NULL
  ELSE EXTRACT(EPOCH FROM (ff.release_date - fk.release_date)) / 86400
END`;
