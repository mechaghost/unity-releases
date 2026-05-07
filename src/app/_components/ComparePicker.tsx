import React, { type ComponentProps } from "react";
import { formatReleaseDate } from "@/lib/format-date";
import { streamLabel } from "@/lib/stream-labels";
import { submitCompareAction } from "../_actions/compare-submit";
import { Icon } from "./Icon";

type ReleaseOption = {
  version: string;
  stream: string | null;
  release_date: string | null;
};

type Props = {
  fromVersion: string;
  toVersion: string;
  releases: ReleaseOption[];
  children?: React.ReactNode;
  action?: ComponentProps<"form">["action"];
};

export function ComparePicker({
  fromVersion,
  toVersion,
  releases,
  children,
  action = submitCompareAction
}: Props) {
  const swapHref =
    fromVersion && toVersion
      ? `/compare?from=${encodeURIComponent(toVersion)}&to=${encodeURIComponent(fromVersion)}`
      : "";

  return (
    <>
      {/*
        Submitting via server action persists the `from` value as the user's
        saved Unity version — no separate "Your Unity version" widget needed.
      */}
      <form className="compare-picker" action={action}>
        <label>
          <span>From</span>
          <select name="from" defaultValue={fromVersion} required>
            <option value="" disabled>
              Select a version
            </option>
            {releases.map((r) => (
              <option key={r.version} value={r.version}>
                {versionOptionLabel(r)}
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
              Select a version
            </option>
            {releases.map((r) => (
              <option key={r.version} value={r.version}>
                {versionOptionLabel(r)}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" className="btn btn--primary compare-picker__go">
          <Icon name="git-compare" size={14} />
          Compare
        </button>
      </form>
      {children}
    </>
  );
}

function versionOptionLabel(release: ReleaseOption): string {
  const meta = [
    release.stream ? streamLabel(release.stream) : null,
    release.release_date ? formatReleaseDate(release.release_date) : null
  ].filter(Boolean);
  return meta.length > 0 ? `${release.version} - ${meta.join(" / ")}` : release.version;
}
