"use client";

import React, { useTransition, type FormEvent } from "react";
import { clearUserPackagesAction, setUserPackagesAction } from "../_actions/user-packages";

type Props = {
  packages: string[];
};

/**
 * Sidebar control for the user's manifest-aware filter. Shows the count
 * of packages tracked, expands into a textarea where the user can paste
 * a `Packages/manifest.json` (or just a list of names) to set the filter.
 */
export function SidebarUserPackages({ packages }: Props) {
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    event.preventDefault();
    startTransition(async () => {
      await setUserPackagesAction(new FormData(form));
    });
  }

  function handleClear() {
    startTransition(async () => {
      await clearUserPackagesAction();
    });
  }

  return (
    <details className="sidebar-packages" data-pending={pending ? "true" : undefined}>
      <summary className="sidebar-packages__summary">
        <span className="sidebar-packages__label">My packages</span>
        <span className="sidebar-packages__count tabnums">
          {packageSummary(packages.length)}
        </span>
      </summary>
      <form className="sidebar-packages__form" onSubmit={handleSubmit}>
        <textarea
          name="manifest"
          rows={5}
          placeholder={`Paste your manifest.json or list package names…\n\ncom.unity.inputsystem\ncom.unity.cinemachine`}
          defaultValue={packages.join("\n")}
          spellCheck={false}
        />
        <div className="sidebar-packages__actions">
          <button type="submit" className="btn btn--primary btn--small" disabled={pending}>
            Save
          </button>
          {packages.length > 0 ? (
            <button type="button" className="btn btn--tertiary btn--small" onClick={handleClear}>
              Clear
            </button>
          ) : null}
        </div>
        <p className="sidebar-packages__hint muted">
          When set, the package lane on diffs and the Packages list show only your tracked
          packages.
        </p>
      </form>
    </details>
  );
}

function packageSummary(count: number) {
  if (count === 0) return "All packages";
  return `${count.toLocaleString()} tracked`;
}
