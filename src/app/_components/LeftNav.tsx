"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Icon, type IconName } from "./Icon";
import { ThemeToggle } from "./ThemeToggle";

type SubItem = {
  href: string;
  label: string;
  featured?: boolean;
  match: (pathname: string, search: URLSearchParams) => boolean;
};

type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  match: (pathname: string) => boolean;
  showSubsOn?: (pathname: string) => boolean;
  subItems?: SubItem[];
};

const NAV: NavItem[] = [
  {
    href: "/",
    label: "Dashboard",
    icon: "home",
    match: (pathname) => pathname === "/"
  },
  {
    href: "/releases",
    label: "Editor Releases",
    icon: "rocket",
    match: (pathname) =>
      pathname === "/releases" ||
      pathname.startsWith("/releases/") ||
      pathname === "/compare",
    showSubsOn: (pathname) =>
      pathname === "/releases" ||
      pathname.startsWith("/releases/") ||
      pathname === "/compare",
    subItems: [
      {
        href: "/releases",
        label: "All releases",
        match: (p, s) => p === "/releases" && !s.get("stream")
      },
      {
        href: "/compare",
        label: "Compare versions",
        featured: true,
        match: (p) => p === "/compare"
      },
      {
        href: "/releases?stream=lts",
        label: "LTS",
        match: (p, s) => p === "/releases" && s.get("stream") === "lts"
      },
      {
        href: "/releases?stream=beta",
        label: "Beta",
        match: (p, s) => p === "/releases" && s.get("stream") === "beta"
      },
      {
        href: "/releases?stream=alpha",
        label: "Alpha",
        match: (p, s) => p === "/releases" && s.get("stream") === "alpha"
      }
    ]
  },
  {
    href: "/packages",
    label: "Packages",
    icon: "package",
    match: (pathname) => pathname === "/packages" || pathname.startsWith("/packages/"),
    showSubsOn: (pathname) => pathname === "/packages" || pathname.startsWith("/packages/"),
    subItems: [
      {
        href: "/packages",
        label: "All packages",
        match: (p, s) => p === "/packages" && !s.get("sort")
      },
      {
        href: "/packages?sort=updated",
        label: "Recently updated",
        match: (p, s) => p === "/packages" && s.get("sort") === "updated"
      }
    ]
  },
  {
    href: "/news",
    label: "News",
    icon: "newspaper",
    match: (pathname) => pathname === "/news"
  }
];

export function LeftNav() {
  const pathname = usePathname() ?? "/";
  const search = useSearchParams();
  const params = new URLSearchParams(search?.toString() ?? "");

  return (
    <nav className="lnav" id="primary-nav" aria-label="Primary">
      <a href="/" className="lnav__brand">
        <span className="lnav__brand-mark" aria-hidden="true">
          U
        </span>
        Unity Alerts
      </a>
      <div className="lnav__sections">
        {NAV.map((item) => {
          const active = item.match(pathname);
          const hasSubs = Boolean(item.subItems?.length);
          const showSubs = hasSubs && (item.showSubsOn?.(pathname) ?? active);
          const itemActive = active && !showSubs;
          return (
            <div className="lnav__group" key={item.href}>
              <a
                href={item.href}
                className="lnav__item"
                aria-current={itemActive ? "page" : undefined}
              >
                <Icon name={item.icon} size={20} className="lnav__item-icon" />
                {item.label}
              </a>
              {showSubs ? (
                <div className="lnav__sub">
                  {item.subItems!.map((sub) => (
                    <a
                      key={sub.href}
                      href={sub.href}
                      className={`lnav__sub-item${sub.featured ? " lnav__sub-item--featured" : ""}`}
                      aria-current={sub.match(pathname, params) ? "page" : undefined}
                    >
                      {sub.label}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="lnav__footer">
        <ThemeToggle />
      </div>
    </nav>
  );
}
