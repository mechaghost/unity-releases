import { Suspense, type ReactNode } from "react";
import "./styles.css";
import { LeftNav } from "./_components/LeftNav";
import { MobileNavToggle } from "./_components/MobileNavToggle";
import { NoFlashScript } from "./_components/NoFlashScript";
import { UserVersionDialog, type DialogRelease } from "./_components/UserVersionDialog";
import { listReleases } from "@/lib/db/repositories";
import { getUserVersion } from "@/lib/user-version";

export const metadata = {
  title: "Unity Alerts",
  description: "Unity 6 release, package, and release-note intelligence dashboard."
};

type ReleaseRow = { version: string; stream: string | null };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [userVersion, releases] = await Promise.all([getUserVersion(), safeReleases()]);
  const userStream = releases.find((r) => r.version === userVersion)?.stream ?? null;
  const dialogVersions: DialogRelease[] = releases.map((r) => ({
    version: r.version,
    stream: r.stream
  }));

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <NoFlashScript />
      </head>
      <body>
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        <div className="app-shell">
          <MobileNavToggle />
          <aside className="app-shell__nav" aria-label="Primary navigation">
            <Suspense fallback={<nav className="lnav" id="primary-nav" aria-label="Primary" />}>
              <LeftNav userVersion={userVersion} userStream={userStream} />
            </Suspense>
          </aside>
          <main className="app-shell__content" id="main" tabIndex={-1}>
            {children}
          </main>
        </div>
        <UserVersionDialog
          versions={dialogVersions}
          currentVersion={userVersion}
          autoOpen={!userVersion}
        />
      </body>
    </html>
  );
}

async function safeReleases(): Promise<ReleaseRow[]> {
  try {
    return (await listReleases(500)) as ReleaseRow[];
  } catch {
    return [];
  }
}
