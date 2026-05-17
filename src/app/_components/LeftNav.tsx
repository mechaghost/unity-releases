"use client";

import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./Icon";
import { ThemeToggle } from "./ThemeToggle";

type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  match: (pathname: string) => boolean;
};

type NavSection = {
  /** Optional separator label shown above the group (sr-only). Visually a thin <hr>. */
  separator?: boolean;
  items: NavItem[];
};

const NAV: NavSection[] = [
  // Primary: release-intelligence surfaces — the user's main tasks.
  {
    items: [
      {
        // Compare is the landing page - `/` re-exports the compare route, and
        // the active-state matcher catches both URLs so the nav highlight
        // tracks correctly whether you arrived via `/` or `/compare`.
        href: "/",
        label: "Upgrade Intelligence",
        icon: "git-compare",
        match: (pathname) => pathname === "/" || pathname === "/compare"
      },
      {
        href: "/releases",
        label: "Editor Releases",
        icon: "file-text",
        match: (pathname) => pathname === "/releases" || pathname.startsWith("/releases/")
      },
      {
        href: "/visualizer",
        label: "Release Visualizer",
        icon: "activity",
        match: (pathname) => pathname === "/visualizer"
      },
      {
        href: "/explorer",
        label: "Search Notes",
        icon: "search",
        match: (pathname) => pathname === "/explorer"
      },
      {
        href: "/issues",
        label: "Issue Explorer",
        icon: "alert-octagon",
        match: (pathname) => pathname === "/issues" || pathname.startsWith("/issues/")
      },
      {
        href: "/packages",
        label: "Packages",
        icon: "package",
        match: (pathname) => pathname === "/packages"
      }
    ]
  },
  // Secondary: ambient / reference content. Divider above creates a
  // visual break so the eye can land on the primary group first.
  {
    separator: true,
    items: [
      {
        href: "/news",
        label: "News",
        icon: "newspaper",
        match: (pathname) => pathname === "/news"
      },
      {
        href: "/resources",
        label: "Resources",
        icon: "file-text",
        match: (pathname) => pathname === "/resources"
      },
      {
        href: "/stats",
        label: "Stats",
        icon: "bar-chart",
        match: (pathname) => pathname === "/stats"
      },
      {
        href: "/faq",
        label: "FAQ",
        icon: "info",
        match: (pathname) => pathname === "/faq"
      }
    ]
  }
];

export function LeftNav() {
  const pathname = usePathname() ?? "/";

  return (
    <nav className="lnav" id="primary-nav" aria-label="Primary">
      <a href="/" className="lnav__brand">
        <span className="lnav__brand-name">Unity Releases</span>
        <span className="lnav__brand-tagline">Unity 6 release &amp; upgrade intel</span>
      </a>
      <div className="lnav__sections">
        {NAV.map((section, idx) => (
          <div className="lnav__section" key={idx}>
            {section.separator ? <hr className="lnav__divider" aria-hidden /> : null}
            {section.items.map((item) => {
              const active = item.match(pathname);
              return (
                <div className="lnav__group" key={item.href}>
                  <a
                    href={item.href}
                    className="lnav__item"
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon name={item.icon} size={20} className="lnav__item-icon" />
                    {item.label}
                  </a>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="lnav__footer">
        <ThemeToggle />
      </div>
    </nav>
  );
}
