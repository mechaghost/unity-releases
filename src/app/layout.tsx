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
            <a href="/explorer">Explorer</a>
            <a href="/upgrade">Upgrade Impact</a>
            <a href="/watch">Watch RSS</a>
            <a href="/api/health">Health</a>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
