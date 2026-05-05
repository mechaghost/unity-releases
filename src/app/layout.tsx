import type { ReactNode } from "react";
import "./styles.css";

export const metadata = {
  title: "Unity Alerts",
  description: "Unity 6 release, package, and release-note tracking."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <a href="/" className="brand">
            Unity Alerts
          </a>
          <nav>
            <a href="/">Today</a>
            <a href="/releases">Editor Releases</a>
            <a href="/packages">Packages</a>
            <a href="/explorer">Release Notes</a>
            <a href="/upgrade">Upgrade Review</a>
            <a href="/watch">Feeds</a>
            <a href="/news">News</a>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
