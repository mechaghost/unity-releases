import React, { Suspense, type ComponentProps } from "react";
import { submitCompareAction } from "../_actions/compare-submit";
import { CompareStreamFilter } from "./CompareStreamFilter";
import { Icon } from "./Icon";
import type { StreamName } from "@/lib/stream-filter";
import { compareUnityVersions, parseUnityVersion } from "@/lib/parsers/version";

type ReleaseOption = {
  version: string;
  stream: string | null;
  release_date: string | null;
};

type Props = {
  fromVersion: string;
  toVersion: string;
  releases: ReleaseOption[];
  selectedStreams: StreamName[];
  children?: React.ReactNode;
  /** Optional right-side slot rendered on the streams chip row (e.g. the
   *  Filter trigger on the active compare view). */
  streamRowEnd?: React.ReactNode;
  action?: ComponentProps<"form">["action"];
};

/**
 * Group label shown on each <optgroup> in the From/To dropdowns. Major
 * lines are presented in DESC version order (Unity 6 first, then the
 * legacy LTS lines newest-to-oldest), and inside each group the
 * versions sort by `compareUnityVersions` DESC so a `6000.5.0b6`
 * appears before `6000.4.5f1` and well above `6000.0.x`. Without the
 * grouping the picker is a flat list of 400+ options interleaved by
 * release date, which is unreadable.
 */
function majorLabel(major: number): string {
  if (major === 6000) return "Unity 6";
  return `Unity ${major} LTS`;
}

function groupReleasesByMajor(releases: ReleaseOption[]): Array<[number, ReleaseOption[]]> {
  const groups = new Map<number, ReleaseOption[]>();
  for (const release of releases) {
    let major: number;
    try {
      major = parseUnityVersion(release.version).major;
    } catch {
      continue;
    }
    const bucket = groups.get(major) ?? [];
    bucket.push(release);
    groups.set(major, bucket);
  }
  for (const bucket of groups.values()) {
    bucket.sort((a, b) => compareUnityVersions(b.version, a.version));
  }
  // Major DESC: 6000 first, then 2022, 2021, 2020, 2019.
  return [...groups.entries()].sort(([a], [b]) => b - a);
}

export function ComparePicker({
  fromVersion,
  toVersion,
  releases,
  selectedStreams,
  children,
  streamRowEnd,
  action = submitCompareAction
}: Props) {
  const groupedReleases = groupReleasesByMajor(releases);
  const swapHref =
    fromVersion && toVersion
      ? `/compare?from=${encodeURIComponent(toVersion)}&to=${encodeURIComponent(fromVersion)}${
          selectedStreams.length > 0
            ? `&${selectedStreams.map((s) => `stream=${encodeURIComponent(s)}`).join("&")}`
            : ""
        }`
      : "";

  return (
    <>
      {/*
        Submitting via server action persists the `from` value as the user's
        saved Unity version - no separate "Your Unity version" widget needed.

        Stream scope sits above the picker so the user picks which Unity
        streams to draw From/To options from before they pick a version.
      */}
      <div className="compare-stream-row">
        <Suspense fallback={null}>
          <CompareStreamFilter selected={selectedStreams} />
        </Suspense>
        {streamRowEnd ? (
          <div className="compare-stream-row__end">{streamRowEnd}</div>
        ) : null}
      </div>
      <form className="compare-picker" action={action}>
        <label>
          <span>From</span>
          <select name="from" defaultValue={fromVersion} required>
            <option value="" disabled>
              Pick a version
            </option>
            {groupedReleases.map(([major, items]) => (
              <optgroup key={major} label={majorLabel(major)}>
                {items.map((r) => (
                  <option key={r.version} value={r.version}>
                    {r.version}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        {swapHref ? (
          <a className="compare-picker__swap" href={swapHref} aria-label="Swap from and to" title="Swap from and to">
            <Icon name="arrows-left-right" size={16} />
          </a>
        ) : (
          <button type="button" className="compare-picker__swap" aria-label="Swap from and to" disabled>
            <Icon name="arrows-left-right" size={16} />
          </button>
        )}

        <label>
          <span>To</span>
          <select name="to" defaultValue={toVersion} required>
            <option value="" disabled>
              Pick a version
            </option>
            {groupedReleases.map(([major, items]) => (
              <optgroup key={major} label={majorLabel(major)}>
                {items.map((r) => (
                  <option key={r.version} value={r.version}>
                    {r.version}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        {/* Round-trip the stream scope through compare-submit so picking
            new versions doesn't reset the user's stream selection. */}
        {selectedStreams.map((s) => (
          <input key={s} type="hidden" name="stream" value={s} />
        ))}

        <button type="submit" className="btn btn--primary compare-picker__go">
          <Icon name="git-compare" size={14} />
          Compare
        </button>
      </form>
      {children}
    </>
  );
}
