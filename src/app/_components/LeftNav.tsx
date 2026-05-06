"use client";

import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./Icon";
import { SidebarStreamFilter } from "./SidebarStreamFilter";
import { SidebarUserPackages } from "./SidebarUserPackages";
import { SidebarVersionStatus } from "./SidebarVersionStatus";
import { ThemeToggle } from "./ThemeToggle";
import type { StreamName } from "@/lib/stream-filter";

type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  match: (pathname: string) => boolean;
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
    match: (pathname) => pathname === "/releases" || pathname.startsWith("/releases/")
  },
  {
    href: "/packages",
    label: "Packages",
    icon: "package",
    match: (pathname) => pathname === "/packages"
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
  userPackages: string[];
};

export function LeftNav({ userVersion, userStream, streamFilter, userPackages }: LeftNavProps) {
  const pathname = usePathname() ?? "/";

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
      <SidebarStreamFilter selected={streamFilter} />
      <SidebarUserPackages packages={userPackages} />
      <SidebarVersionStatus userVersion={userVersion} userStream={userStream} />
      <div className="lnav__footer">
        <ThemeToggle />
      </div>
    </nav>
  );
}
