import { Suspense, type ReactNode } from "react";
import "./styles.css";
import { LeftNav } from "./_components/LeftNav";
import { MobileNavToggle } from "./_components/MobileNavToggle";
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
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        <div className="app-shell">
          <MobileNavToggle />
          <aside className="app-shell__nav" aria-label="Primary navigation">
            <Suspense fallback={<nav className="lnav" id="primary-nav" aria-label="Primary" />}>
              <LeftNav />
            </Suspense>
          </aside>
          <main className="app-shell__content" id="main" tabIndex={-1}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
