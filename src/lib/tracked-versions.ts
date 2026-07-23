/**
 * Shape the editor minor lines we hold into the grouping /faq and /llms.txt
 * describe to readers.
 *
 * Pure - takes rows in, returns groups out - so the copy that tells people
 * which Unity versions the site tracks can be unit-tested without a database,
 * and so both surfaces render the same answer from one implementation.
 *
 * Generation-agnostic: Unity 7 lines group under "Unity 7" the moment they
 * are ingested, with no code change here.
 */

import { isModernMajor, unityMajorLabel } from "./unity-generation";

export type TrackedLine = {
  /** e.g. "6000.7". */
  minorLine: string;
  major: number;
  minor: number;
  /** Newest version on the line, preferring stable builds. */
  latestVersion: string;
  stream: string;
  releaseCount: number;
  /** True when this line is the long-term-support branch of its generation. */
  isLts: boolean;
};

export type TrackedGeneration = {
  major: number;
  /** "Unity 6" / "Unity 7" / "Unity 2022 LTS". */
  label: string;
  /** True for 6000+ majors; false for the legacy year-based lines. */
  isModern: boolean;
  /** Lines newest-first. */
  lines: TrackedLine[];
};

type InputRow = {
  minorLine: string;
  latestVersion: string;
  stream: string;
  releaseCount: number;
};

/**
 * Group raw minor-line rows by major, newest generation first and newest line
 * first within each. Rows whose `minor_line` isn't `<major>.<minor>` are
 * dropped rather than rendered - this feeds user-facing prose, so a malformed
 * row should disappear, not show up as "Unity NaN".
 */
export function groupTrackedLines(rows: readonly InputRow[]): TrackedGeneration[] {
  const byMajor = new Map<number, TrackedLine[]>();

  for (const row of rows) {
    const match = row.minorLine?.match(/^(\d+)\.(\d+)$/);
    if (!match) continue;
    const major = Number(match[1]);
    const minor = Number(match[2]);

    const bucket = byMajor.get(major) ?? [];
    bucket.push({
      minorLine: row.minorLine,
      major,
      minor,
      latestVersion: row.latestVersion,
      stream: row.stream,
      releaseCount: row.releaseCount,
      isLts: row.stream === "LTS"
    });
    byMajor.set(major, bucket);
  }

  return [...byMajor.entries()]
    .sort(([a], [b]) => b - a)
    .map(([major, lines]) => ({
      major,
      label: unityMajorLabel(major),
      isModern: isModernMajor(major),
      lines: lines.sort((a, b) => b.minor - a.minor)
    }));
}

/**
 * One-line summary of a generation's lines, e.g.
 * "6000.7, 6000.0 (LTS) · 6000.5, 6000.4 (Supported) · 6000.8 (pre-release)".
 *
 * Three buckets rather than LTS/not-LTS: a line whose only builds so far are
 * alphas or betas (6000.7 was exactly this for months) is not "Supported",
 * and telling an LLM otherwise would be a factual error about what's shippable.
 * Buckets with no lines are omitted entirely.
 */
export function describeGeneration(generation: TrackedGeneration): string {
  const lts = generation.lines.filter((line) => line.isLts);
  const supported = generation.lines.filter(
    (line) => !line.isLts && line.stream === "Update/Supported"
  );
  const prerelease = generation.lines.filter(
    (line) => !line.isLts && line.stream !== "Update/Supported"
  );

  const parts: string[] = [];
  const join = (lines: TrackedLine[]) => lines.map((l) => l.minorLine).join(", ");
  if (lts.length > 0) parts.push(`${join(lts)} (LTS)`);
  if (supported.length > 0) parts.push(`${join(supported)} (Supported)`);
  if (prerelease.length > 0) parts.push(`${join(prerelease)} (pre-release)`);
  return parts.join(" · ");
}
