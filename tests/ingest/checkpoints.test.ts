import { expect, test } from "vitest";
import { legacyCheckIsFresh } from "../../src/lib/ingest/checkpoints";
test("legacy skipping requires matching parser, valid lastmod, complete data and a recent successful check", () => {
  const now = Date.parse('2026-11-04T12:00:00Z');
  const row = { value: { lastmod: '2026-01-01', parserVersion: 'v1', complete: true }, checkedAt: new Date(now).toISOString() };
  expect(legacyCheckIsFresh(row, '2026-01-01', 'v1', now)).toBe(true);
  expect(legacyCheckIsFresh(row, '2026-01-02', 'v1', now)).toBe(false);
  expect(legacyCheckIsFresh(row, '2026-01-01', 'v2', now)).toBe(false);
  expect(legacyCheckIsFresh(row, null, 'v1', now)).toBe(false);
  expect(legacyCheckIsFresh(row, 'invalid', 'v1', now)).toBe(false);
  expect(legacyCheckIsFresh(row, '2026-01-01', 'v1', now + 7 * 86400000)).toBe(false);
  expect(legacyCheckIsFresh({ ...row, value: { ...row.value, complete: false } }, '2026-01-01', 'v1', now)).toBe(false);
});
