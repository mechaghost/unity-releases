"use client";

import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./Icon";
import { ThemeToggle } from "./ThemeToggle";

type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  match: (pathname: string) => boolean;
  productUpdatesOnly?: boolean;
};

type NavSection = {
  label: string;
  priority: "primary" | "secondary";
  items: NavItem[];
};

function isEditorToolingPath(pathname: string) {
  return (
    pathname === "/updates/editor-tooling" ||
    pathname === "/updates/products/unity-hub" ||
    pathname.startsWith("/updates/products/unity-hub/") ||
    pathname === "/updates/products/unity-cli" ||
    pathname.startsWith("/updates/products/unity-cli/")
  );
}

const NAV: NavSection[] = [
  {
    label: "Engine & Editor",
    priority: "primary",
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
      },
      {
        href: "/updates/editor-tooling",
        label: "Editor Tooling Updates",
        icon: "terminal",
        match: isEditorToolingPath,
        productUpdatesOnly: true
      }
    ]
  },
  {
    label: "Unity Products",
    priority: "secondary",
    items: [
      {
        href: "/updates",
        label: "Product Updates",
        icon: "layers",
        match: (pathname) =>
          pathname === "/updates" ||
          (pathname.startsWith("/updates/") && !isEditorToolingPath(pathname)),
        productUpdatesOnly: true
      }
    ]
  },
  {
    label: "Community & Reference",
    priority: "secondary",
    items: [
      {
        href: "/github",
        label: "Unity GitHub",
        icon: "github",
        match: (pathname) => pathname === "/github"
      },
      {
        href: "/discussions",
        label: "Staff Discussions",
        icon: "message-square",
        match: (pathname) => pathname === "/discussions"
      },
      {
        href: "/timeline",
        label: "Activity Feed",
        icon: "clock",
        match: (pathname) => pathname === "/timeline"
      },
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

export function LeftNav({
  productUpdatesEnabled
}: {
  productUpdatesEnabled: boolean;
}) {
  const pathname = usePathname() ?? "/";

  return (
    <nav className="lnav" id="primary-nav" aria-label="Primary">
      <a href="/" className="lnav__brand">
        <span className="lnav__brand-name">Unity Releases</span>
        {/* Generation-neutral: naming a single Unity generation here would
            need a manual edit the day the next one ships. */}
        <span className="lnav__brand-tagline">Unity release &amp; upgrade intel</span>
      </a>
      <div className="lnav__sections">
        {NAV.map((section) => {
          const visibleItems = section.items.filter(
            (item) => !item.productUpdatesOnly || productUpdatesEnabled
          );
          if (visibleItems.length === 0) return null;
          return (
            <section
              className="lnav__section"
              data-priority={section.priority}
              aria-labelledby={`lnav-${section.label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
              key={section.label}
            >
              <h2
                className="lnav__section-label"
                id={`lnav-${section.label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
              >
                {section.label}
              </h2>
              {visibleItems.map((item) => {
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
            </section>
          );
        })}
      </div>
      <div className="lnav__footer">
        <ThemeToggle />
      </div>
    </nav>
  );
}
