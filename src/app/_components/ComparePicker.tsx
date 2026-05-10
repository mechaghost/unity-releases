import React, { Suspense, type ComponentProps } from "react";
import { submitCompareAction } from "../_actions/compare-submit";
import { CompareStreamFilter } from "./CompareStreamFilter";
import { Icon } from "./Icon";
import type { StreamName } from "@/lib/stream-filter";

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

export function ComparePicker({
  fromVersion,
  toVersion,
  releases,
  selectedStreams,
  children,
  streamRowEnd,
  action = submitCompareAction
}: Props) {
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
            {releases.map((r) => (
              <option key={r.version} value={r.version}>
                {r.version}
              </option>
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
            {releases.map((r) => (
              <option key={r.version} value={r.version}>
                {r.version}
              </option>
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
