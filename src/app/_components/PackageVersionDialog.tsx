"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import { renderChangelog } from "@/lib/changelog-markdown";

type VersionEntry = {
  version: string;
  publishedAt: string | null;
  isPrerelease: boolean;
  unityCompatibility: string | null;
  changelog: string | null;
};

type PackageDetail = {
  name: string;
  displayName: string | null;
  description: string | null;
  sourceUrl: string | null;
  totalVersions: number;
  versions: VersionEntry[];
};

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; data: PackageDetail }
  | { status: "error"; message: string };

type Props = {
  open: boolean;
  onClose: () => void;
  /** Package name (e.g. com.unity.inputsystem) - keys the API fetch. */
  packageName: string;
  /** Display label fallback while the API request is in flight. */
  displayName: string | null;
  /** Registry URL surfaced in the header so the user always has the
   *  external link, even before the version list finishes loading. */
  registryUrl: string;
};

/**
 * Modal dialog showing recent versions and changelogs for one Unity
 * package. Lazy-fetches `/api/packages/<name>/versions` when opened
 * and renders changelogs in a scrollable list. Follows the Apple
 * negative-space conventions: white card on a dim backdrop, no
 * border, soft popover shadow, ESC + backdrop click to close, focus
 * restored to the row that opened the dialog.
 */
export function PackageVersionDialog({
  open,
  onClose,
  packageName,
  displayName,
  registryUrl
}: Props) {
  const [load, setLoad] = useState<LoadState>({ status: "idle" });
  const [mounted, setMounted] = useState(false);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

  // Lazy fetch - only hit the API the first time the dialog is opened
  // for this package. Re-opening reuses the cached result; switching to
  // a different package resets the state.
  useEffect(() => {
    if (!open) return;
    if (load.status === "loaded" || load.status === "loading") return;

    let cancelled = false;
    setLoad({ status: "loading" });

    fetch(`/api/packages/${encodeURIComponent(packageName)}/versions`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Status ${res.status}`);
        return (await res.json()) as PackageDetail;
      })
      .then((data) => {
        if (cancelled) return;
        setLoad({ status: "loaded", data });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setLoad({ status: "error", message: err.message || "Request failed" });
      });

    return () => {
      cancelled = true;
    };
    // We intentionally re-run only when `open` flips so the fetch fires on
    // first open for this dialog instance; load is read inside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, packageName]);

  // Focus management: capture the previously focused element when we open,
  // move focus inside, restore it on close. ESC closes; body scroll locks.
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Wait for paint so the close button is in the DOM.
    const id = window.requestAnimationFrame(() => {
      closeBtnRef.current?.focus();
    });

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Tab") {
        // Lightweight focus trap - keep Tab cycling within the dialog.
        const root = dialogRef.current;
        if (!root) return;
        const focusables = root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);

    return () => {
      window.cancelAnimationFrame(id);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  const titleId = `pkg-dialog-title-${packageName}`;
  const descriptionId = `pkg-dialog-desc-${packageName}`;

  return createPortal(
    <div
      className="pkg-dialog__backdrop"
      onClick={(e) => {
        // Click outside the card closes the dialog. We compare against
        // currentTarget so clicks inside the card itself don't bubble
        // up and dismiss.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="pkg-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <header className="pkg-dialog__header">
          <div className="pkg-dialog__heading">
            <h2 id={titleId} className="pkg-dialog__title">
              {displayName ?? packageName}
            </h2>
            <p id={descriptionId} className="pkg-dialog__sub">
              <code>{packageName}</code>
            </p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            className="pkg-dialog__close"
            onClick={onClose}
            aria-label="Close"
          >
            <Icon name="x" size={16} />
          </button>
        </header>

        <div className="pkg-dialog__body">
          <p className="pkg-dialog__registry">
            Registry:{" "}
            <a href={registryUrl} target="_blank" rel="noopener noreferrer">
              {registryUrl}
            </a>
          </p>

          {load.status === "loaded" && load.data.description && (
            <p className="pkg-dialog__description">
              {load.data.description}
            </p>
          )}

          {load.status === "loading" ? (
            <DialogSkeleton />
          ) : load.status === "error" ? (
            <p className="pkg-dialog__error">
              Couldn&apos;t load versions ({load.message}). Try again in a
              moment, or check the registry link above.
            </p>
          ) : load.status === "loaded" ? (
            <VersionList data={load.data} />
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}

function DialogSkeleton() {
  return (
    <ol className="pkg-dialog__versions" aria-busy="true" aria-live="polite">
      {[0, 1, 2].map((i) => (
        <li key={i} className="pkg-version pkg-version--skeleton">
          <div className="pkg-version__head">
            <span className="pkg-skeleton-line pkg-skeleton-line--short" />
            <span className="pkg-skeleton-line pkg-skeleton-line--tiny" />
          </div>
          <span className="pkg-skeleton-line" />
          <span className="pkg-skeleton-line pkg-skeleton-line--mid" />
        </li>
      ))}
    </ol>
  );
}

function VersionList({ data }: { data: PackageDetail }) {
  if (data.versions.length === 0) {
    return (
      <p className="pkg-dialog__empty">
        No versions indexed for this package yet.
      </p>
    );
  }

  return (
    <>
      <p className="pkg-dialog__count">
        Showing the most recent <strong>{data.versions.length}</strong> of{" "}
        <strong>{data.totalVersions}</strong> indexed versions.
      </p>
      <ol className="pkg-dialog__versions">
        {data.versions.map((v) => (
          <li key={v.version} className="pkg-version">
            <div className="pkg-version__head">
              <span className="pkg-version__num tabnums">{v.version}</span>
              <span className="pkg-version__meta">
                {v.publishedAt ? formatDate(v.publishedAt) : "Unknown date"}
                {v.isPrerelease ? (
                  <span className="pkg-version__pre">Prerelease</span>
                ) : null}
                {v.unityCompatibility ? (
                  <span className="pkg-version__compat">
                    Unity {v.unityCompatibility}
                  </span>
                ) : null}
              </span>
            </div>
            {v.changelog ? (
              <div className="pkg-version__changelog">
                {renderChangelog(v.changelog)}
              </div>
            ) : (
              <p className="pkg-version__no-notes">No release notes provided.</p>
            )}
          </li>
        ))}
      </ol>
    </>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}
