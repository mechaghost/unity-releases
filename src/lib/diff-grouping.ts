/**
 * Pure helpers used by /compare to group, dedupe, and aggregate release-note
 * rows once they've been pulled from the database. Kept free of React /
 * pg / next/headers so they can be unit-tested in isolation.
 */

// ─── Date helpers ──────────────────────────────────────────────

/** Coerce a TIMESTAMPTZ that pg may have returned as Date | string into a number. */
export function toTime(value: string | Date | null | undefined): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : 0;
}

// ─── Range scoping ─────────────────────────────────────────────

/**
 * Minor lines between two version strings of the form "MAJOR.MINOR".
 * Both endpoints are included; in-between minor numbers (numerical) are
 * filled in so a 6000.0 → 6000.5 jump still picks up 6000.1..4 patches.
 *
 * If the majors differ or either side fails to parse, only the endpoints
 * are returned. Order of the two arguments doesn't matter.
 */
export function minorLinesBetween(fromMinor: string, toMinor: string): string[] {
  const parse = (s: string) => {
    const [maj, min] = s.split(".").map((n) => Number(n));
    return { maj, min };
  };
  const a = parse(fromMinor);
  const b = parse(toMinor);
  if (!Number.isFinite(a.maj) || !Number.isFinite(b.maj)) return [fromMinor, toMinor];
  if (a.maj !== b.maj) return [fromMinor, toMinor];
  if (!Number.isFinite(a.min) || !Number.isFinite(b.min)) return [fromMinor, toMinor];

  const lo = Math.min(a.min, b.min);
  const hi = Math.max(a.min, b.min);
  const out: string[] = [];
  for (let m = lo; m <= hi; m += 1) out.push(`${a.maj}.${m}`);
  return out;
}

// ─── Grouping ──────────────────────────────────────────────────

export type GroupableByVersion = {
  version: string;
  release_date: string | Date | null;
};

export type ReleaseGroup<T extends GroupableByVersion> = {
  version: string;
  releaseDate: string | Date | null;
  rows: T[];
};

/** Group a sorted-by-date list of rows into per-release buckets. */
export function groupByVersion<T extends GroupableByVersion>(rows: T[]): ReleaseGroup<T>[] {
  const groups = new Map<string, ReleaseGroup<T>>();
  for (const row of rows) {
    const existing = groups.get(row.version);
    if (existing) {
      existing.rows.push(row);
    } else {
      groups.set(row.version, {
        version: row.version,
        releaseDate: row.release_date,
        rows: [row]
      });
    }
  }
  return [...groups.values()];
}

// ─── Dedupe by issue ───────────────────────────────────────────

export type DedupableByIssue = GroupableByVersion & {
  body: string;
  issue_ids: string[];
};

export type DedupedIssue<T extends DedupableByIssue> = {
  key: string;
  /** Most recent restatement is treated as the canonical row. */
  primary: T;
  mentionCount: number;
  firstVersion: string;
  lastVersion: string;
  firstDate: string | Date | null;
  lastDate: string | Date | null;
};

/**
 * Deduplicate rows that restate the same fact (most commonly: a known
 * issue carried forward across many releases) by their first issue id,
 * falling back to a stable hash of the body when no issue id is set.
 *
 * Result is sorted with the most-recently-last-seen item first; ties
 * break by mention count (more frequent first).
 */
export function dedupeByIssue<T extends DedupableByIssue>(rows: T[]): DedupedIssue<T>[] {
  const map = new Map<string, DedupedIssue<T>>();
  for (const row of rows) {
    const id = (row.issue_ids ?? [])[0];
    const key = id ? `id:${id}` : `body:${shortHash(row.body ?? "")}`;
    const rowTime = toTime(row.release_date);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        key,
        primary: row,
        mentionCount: 1,
        firstVersion: row.version,
        lastVersion: row.version,
        firstDate: row.release_date,
        lastDate: row.release_date
      });
      continue;
    }
    existing.mentionCount += 1;
    if (rowTime && (!existing.firstDate || rowTime < toTime(existing.firstDate))) {
      existing.firstDate = row.release_date;
      existing.firstVersion = row.version;
    }
    if (rowTime && (!existing.lastDate || rowTime > toTime(existing.lastDate))) {
      existing.lastDate = row.release_date;
      existing.lastVersion = row.version;
      existing.primary = row;
    }
  }
  return [...map.values()].sort((a, b) => {
    const cmp = toTime(b.lastDate) - toTime(a.lastDate);
    if (cmp !== 0) return cmp;
    return b.mentionCount - a.mentionCount;
  });
}

// ─── Aggregate by package ──────────────────────────────────────

export type AggregatableByPackage = GroupableByVersion & {
  body: string;
  package_names: string[];
};

export type DedupedPackage = {
  packageName: string;
  mentionCount: number;
  firstVersion: string;
  lastVersion: string;
  firstDate: string | Date | null;
  lastDate: string | Date | null;
  /** Body of the most recent mention; useful as a one-line preview. */
  sampleBody: string;
};

/**
 * Collapse rows-mentioning-packages into one entry per package, with
 * mention count and the first/last Editor versions in which it appears.
 * Sorted by mention count descending.
 */
export function aggregateByPackage<T extends AggregatableByPackage>(rows: T[]): DedupedPackage[] {
  const map = new Map<string, DedupedPackage>();
  for (const row of rows) {
    const names = row.package_names ?? [];
    if (names.length === 0) continue;
    const rowTime = toTime(row.release_date);
    for (const pkg of names) {
      const existing = map.get(pkg);
      if (!existing) {
        map.set(pkg, {
          packageName: pkg,
          mentionCount: 1,
          firstVersion: row.version,
          lastVersion: row.version,
          firstDate: row.release_date,
          lastDate: row.release_date,
          sampleBody: row.body ?? ""
        });
        continue;
      }
      existing.mentionCount += 1;
      if (rowTime && (!existing.firstDate || rowTime < toTime(existing.firstDate))) {
        existing.firstDate = row.release_date;
        existing.firstVersion = row.version;
      }
      if (rowTime && (!existing.lastDate || rowTime > toTime(existing.lastDate))) {
        existing.lastDate = row.release_date;
        existing.lastVersion = row.version;
        if (row.body) existing.sampleBody = row.body;
      }
    }
  }
  return [...map.values()].sort((a, b) => b.mentionCount - a.mentionCount);
}

// ─── Internals ─────────────────────────────────────────────────

/** Tiny non-cryptographic string hash for grouping rows by body content. */
export function shortHash(value: string): string {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) {
    h = (h * 31 + value.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}
