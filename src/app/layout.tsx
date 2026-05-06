import { Suspense, type ReactNode } from "react";
import "./styles.css";
import { LeftNav } from "./_components/LeftNav";
import { TopBar } from "./_components/TopBar";
import { NoFlashScript } from "./_components/NoFlashScript";

export const metadata = {
  title: "Unity Alerts",
  description: "Unity 6 release, package, and release-note intelligence dashboard."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <NoFlashScript />
      </head>
      <body>
        <div className="app-shell">
          <aside className="app-shell__nav" aria-label="Primary navigation">
            <Suspense fallback={<nav className="lnav" aria-label="Primary" />}>
              <LeftNav />
            </Suspense>
          </aside>
          <div className="app-shell__main">
            <TopBar />
            <main className="app-shell__content" id="main">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
