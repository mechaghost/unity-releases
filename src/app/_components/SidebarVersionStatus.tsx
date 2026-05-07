"use client";

import { VersionPill } from "./VersionPill";

type Props = {
  userVersion: string | null;
  userStream: string | null;
};

export function SidebarVersionStatus({ userVersion, userStream }: Props) {
  function open() {
    document.dispatchEvent(new CustomEvent("unity-releases:open-version-dialog"));
  }

  return (
    <div className="sidebar-version">
      <span className="sidebar-version__label">Your Unity version</span>
      {userVersion ? (
        <div className="sidebar-version__row">
          <VersionPill version={userVersion} stream={userStream} href={null} />
          <button type="button" className="btn btn--tertiary btn--small" onClick={open}>
            Change
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn--secondary btn--small sidebar-version__cta" onClick={open}>
          Pick your version
        </button>
      )}
    </div>
  );
}
