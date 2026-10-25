"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import { makeInert, trapTabFocus } from "@/lib/focus";
import { renderChangelog } from "@/lib/changelog-markdown";
import { editorPrereleaseLabel } from "@/lib/version-compare";
import { PackageFeatureLinks } from "./PackageFeatureLinks";
import type { PackageFeatureLink } from "@/lib/release-guide-links";

type VersionEntry = {
  version: string;
  publishedAt: string | null;
  isPrerelease: boolean;
  unityCompatibility: string | null;
  /** Exact editor build this version first shipped with, reconciled from
   *  editor release notes. More precise than unityCompatibility's minor
   *  line; null when the package version isn't named in any editor's notes. */
  bundledInEditor: string | null;
  changelog: string | null;
};

type PackageDetail = {
  name: string;
  displayName: string | null;
  description: string | null;
  sourceUrl: string | null;
  totalVersions: number;
  page: number;
  pages: number;
  pageSize: number;
  /** Unity 6.4+ unified versioning: the Editor-aligned version (e.g. 6.4.0)
   *  that the registry version list below doesn't carry. Null otherwise. */
  unified: { unityMinor: string; version: string } | null;
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
  featureLinks?: PackageFeatureLink[];
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
  registryUrl,
  featureLinks = []
}: Props) {
  const [load, setLoad] = useState<LoadState>({ status: "idle" });
  const [mounted, setMounted] = useState(false);
  const [requestedPage, setRequestedPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => setRequestedPage(1), [packageName]);

  // Each open/page/retry owns its request. Aborting a closed dialog cannot
  // leave a loading flag that blocks the next open, or overwrite a newer page.
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoad({ status: "loading" });

    fetch(`/api/packages/${encodeURIComponent(packageName)}/versions?page=${requestedPage}`, {
      signal: controller.signal
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Status ${res.status}`);
        return (await res.json()) as PackageDetail;
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setLoad({ status: "loaded", data });
      })
      .catch((err: Error) => {
        if (controller.signal.aborted) return;
        setLoad({ status: "error", message: err.message || "Request failed" });
      });

    return () => controller.abort();
  }, [open, packageName, requestedPage, attempt]);

  // Focus management: capture the previously focused element when we open,
  // move focus inside, restore it on close. ESC closes; body scroll locks.
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const restoreBackground = makeInert(Array.from(document.querySelectorAll<HTMLElement>(".app-shell, .skip-link")));

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
        trapTabFocus(e, [root]);
      }
    }
    document.addEventListener("keydown", onKey);

    return () => {
      window.cancelAnimationFrame(id);
      document.body.style.overflow = previousOverflow;
      restoreBackground();
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

          <PackageFeatureLinks links={featureLinks} />

          {load.status === "loading" ? (
            <DialogSkeleton />
          ) : load.status === "error" ? (
            <div className="pkg-dialog__error" role="alert">
              <p>Couldn&apos;t load versions ({load.message}).</p>
              <button type="button" className="btn btn--secondary" onClick={() => setAttempt(value => value + 1)}>Try again</button>
            </div>
          ) : load.status === "loaded" ? (
            <>
              <VersionList data={load.data} />
              {load.data.pages > 1 && <nav className="lane__pagination" aria-label="Package history pages">
                {load.data.page > 1 && <button type="button" className="lane__pagination-btn" onClick={() => setRequestedPage(load.data.page - 1)}>Previous versions</button>}
                <span>Page {load.data.page} of {load.data.pages}</span>
                {load.data.page < load.data.pages && <button type="button" className="lane__pagination-btn" onClick={() => setRequestedPage(load.data.page + 1)}>Older versions</button>}
              </nav>}
            </>
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
      {data.unified ? (
        <div className="pkg-dialog__unified">
          <strong>
            Unity {data.unified.unityMinor} ships this package as {data.unified.version}.
          </strong>{" "}
          Unity renumbered it to match the Editor in {data.unified.unityMinor}, and that
          build lives only in the Unity docs. The versions below are the package
          registry&apos;s older line, which continues for earlier Unity 6 — so{" "}
          {data.unified.version} won&apos;t appear in the list.
        </div>
      ) : null}
      <p className="pkg-dialog__count">
        Showing <strong>{(data.page - 1) * data.pageSize + 1}–{(data.page - 1) * data.pageSize + data.versions.length}</strong> of{" "}
        <strong>{data.totalVersions}</strong> indexed versions.
      </p>
      <ol className="pkg-dialog__versions">
        {data.versions.map((v) => {
          const editorPre = editorPrereleaseLabel(v.bundledInEditor);
          return (
          <li key={v.version} className="pkg-version">
            <div className="pkg-version__head">
              <span className="pkg-version__num tabnums">{v.version}</span>
              <span className="pkg-version__meta">
                {v.publishedAt ? formatDate(v.publishedAt) : "Unknown date"}
                {v.isPrerelease ? (
                  <span className="pkg-version__pre">Prerelease</span>
                ) : null}
                {v.bundledInEditor ? (
                  <span
                    className="pkg-version__compat"
                    title={
                      editorPre
                        ? `First shipped with Unity ${v.bundledInEditor} — a ${editorPre}, not yet in a stable release`
                        : `First shipped with Unity ${v.bundledInEditor}`
                    }
                  >
                    Unity {v.bundledInEditor}
                    {editorPre ? (
                      <span className="pkg-version__compat-pre"> {editorPre}</span>
                    ) : null}
                  </span>
                ) : v.unityCompatibility ? (
                  <span
                    className="pkg-version__compat"
                    title={`Minimum Unity version declared by the package: ${v.unityCompatibility}`}
                  >
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
          );
        })}
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
