"use client";

import { useEffect, useRef } from "react";
import { setUserVersionAction } from "../_actions/user-version";
import { Icon } from "./Icon";
import { streamLabel } from "@/lib/stream-labels";

export const VERSION_DIALOG_ID = "user-version-dialog";

export type DialogRelease = {
  version: string;
  stream: string | null;
};

type Props = {
  versions: DialogRelease[];
  currentVersion: string | null;
  /** Open automatically on mount (used for first-visit nudging). */
  autoOpen: boolean;
};

const STREAM_ORDER = ["LTS", "Update/Supported", "beta", "alpha", "patch"];

export function UserVersionDialog({ versions, currentVersion, autoOpen }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  // Auto-open on first visit (no cookie yet).
  useEffect(() => {
    if (autoOpen && ref.current && !ref.current.open) {
      try {
        ref.current.showModal();
      } catch {
        // showModal can throw if the element isn't connected yet; ignore.
      }
    }
  }, [autoOpen]);

  // Allow any "Change" button anywhere to open this dialog by id.
  useEffect(() => {
    function onOpen() {
      const el = ref.current;
      if (!el) return;
      try {
        el.showModal();
      } catch {
        /* already open */
      }
    }
    document.addEventListener("unity-alerts:open-version-dialog", onOpen);
    return () => document.removeEventListener("unity-alerts:open-version-dialog", onOpen);
  }, []);

  const grouped = groupByStream(versions);

  return (
    <dialog ref={ref} id={VERSION_DIALOG_ID} className="version-dialog" aria-labelledby="user-version-dialog-title">
      <form
        action={setUserVersionAction}
        onSubmit={() => {
          // Optimistically close after the action fires.
          window.setTimeout(() => {
            ref.current?.close();
          }, 0);
        }}
      >
        <header className="version-dialog__head">
          <h2 id="user-version-dialog-title">Pick your Unity version</h2>
          <button
            type="button"
            className="version-dialog__close"
            aria-label="Close"
            onClick={() => ref.current?.close()}
          >
            <Icon name="x" size={16} />
          </button>
        </header>

        <p className="version-dialog__copy">
          Unity Alerts compares releases against the version your project is on. Picking it now means
          every <strong>Diff</strong> button on the dashboard, the releases list, and on each release page
          will jump straight to the upgrade-relevant lanes — what breaks, what's fixed, what's new — between
          where you are and where you might be going.
        </p>

        <label className="version-dialog__field">
          <span>Your current Unity version</span>
          <select name="version" defaultValue={currentVersion ?? ""} required>
            <option value="" disabled>
              Select a version…
            </option>
            {grouped.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.items.map((v) => (
                  <option key={v.version} value={v.version}>
                    {v.version}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <footer className="version-dialog__foot">
          <button type="button" className="btn btn--tertiary" onClick={() => ref.current?.close()}>
            Maybe later
          </button>
          <button type="submit" className="btn btn--primary">
            Save
          </button>
        </footer>
      </form>
    </dialog>
  );
}

function groupByStream(versions: DialogRelease[]) {
  const buckets = new Map<string, DialogRelease[]>();
  for (const v of versions) {
    const key = v.stream ?? "Other";
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(v);
  }
  const ordered: { label: string; items: DialogRelease[] }[] = [];
  for (const stream of STREAM_ORDER) {
    if (buckets.has(stream)) {
      ordered.push({ label: prettyStream(stream), items: buckets.get(stream)! });
      buckets.delete(stream);
    }
  }
  for (const [label, items] of buckets) {
    ordered.push({ label: prettyStream(label), items });
  }
  return ordered;
}

function prettyStream(s: string): string {
  return streamLabel(s) || s.charAt(0).toUpperCase() + s.slice(1);
}
