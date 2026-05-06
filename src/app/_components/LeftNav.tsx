"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Icon, type IconName } from "./Icon";
import { SidebarStreamFilter } from "./SidebarStreamFilter";
import { SidebarVersionStatus } from "./SidebarVersionStatus";
import { ThemeToggle } from "./ThemeToggle";
import type { StreamName } from "@/lib/stream-filter";

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
    // Promoted to a top-level entry — this is the product's killer
    // feature and the team review unanimously called out that hiding
    // it under a sub-nav was the wrong call.
    href: "/compare",
    label: "Compare versions",
    icon: "git-compare",
    match: (pathname) => pathname === "/compare"
  },
  {
    href: "/releases",
    label: "Editor Releases",
    icon: "rocket",
    match: (pathname) => pathname === "/releases" || pathname.startsWith("/releases/"),
    showSubsOn: (pathname) => pathname === "/releases" || pathname.startsWith("/releases/"),
    subItems: [
      {
        href: "/releases",
        label: "All releases",
        match: (p, s) => p === "/releases" && !s.get("stream")
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

type LeftNavProps = {
  userVersion: string | null;
  userStream: string | null;
  streamFilter: StreamName[];
};

export function LeftNav({ userVersion, userStream, streamFilter }: LeftNavProps) {
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
      <SidebarStreamFilter selected={streamFilter} />
      <SidebarVersionStatus userVersion={userVersion} userStream={userStream} />
      <div className="lnav__footer">
        <ThemeToggle />
      </div>
    </nav>
  );
}
