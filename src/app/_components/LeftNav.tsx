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

const NAV: NavItem[] = [
  {
    href: "/",
    label: "Editor Releases",
    icon: "file-text",
    match: (pathname) => pathname === "/" || pathname === "/releases" || pathname.startsWith("/releases/")
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

export function LeftNav() {
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
      <div className="lnav__footer">
        <ThemeToggle />
      </div>
    </nav>
  );
}
