import { Suspense, type ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import "./styles.css";
import { LeftNav } from "./_components/LeftNav";
import { MobileNavToggle } from "./_components/MobileNavToggle";
import { NoFlashScript } from "./_components/NoFlashScript";
import { UserVersionDialog, type DialogRelease } from "./_components/UserVersionDialog";
import { listReleases } from "@/lib/db/repositories";
import { getUserVersion } from "@/lib/user-version";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
  siteUrl
} from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${SITE_NAME} - ${SITE_TAGLINE}`,
    template: `%s - ${SITE_NAME}`
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "Unity 6",
    "Unity release notes",
    "Unity editor releases",
    "Unity upgrade guide",
    "Unity blockers",
    "Unity breaking changes",
    "Unity packages",
    "Unity LTS",
    "Unity beta",
    "Unity changelog diff"
  ],
  authors: [{ name: "Mechaghost" }],
  creator: "Mechaghost",
  publisher: "Mechaghost",
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1
    }
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} - ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    url: "/",
    locale: "en_US"
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} - ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION
  },
  category: "technology"
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFEFC" },
    { media: "(prefers-color-scheme: dark)", color: "#121719" }
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1
};

type ReleaseRow = { version: string; stream: string | null };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [userVersion, releases] = await Promise.all([
    getUserVersion(),
    safeReleases()
  ]);
  // The dialog still shows every indexed version so Compare can use any
  // project baseline, including prerelease versions.
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
              <LeftNav />
            </Suspense>
          </aside>
          <main className="app-shell__content" id="main" tabIndex={-1}>
            {children}
          </main>
        </div>
        <UserVersionDialog
          versions={dialogVersions}
          currentVersion={userVersion}
          autoOpen={false}
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
