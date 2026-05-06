import type { AnchorHTMLAttributes, ReactNode } from "react";
import { Icon } from "./Icon";

type ExternalLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  children: ReactNode;
  showIcon?: boolean;
  className?: string;
};

const EXTERNAL_HOSTS = [
  "unity.com",
  "unity3d.com",
  "issuetracker.unity3d.com",
  "storage.googleapis.com",
  "docs.unity3d.com",
  "github.com"
];

export function isUnityExternalHref(href: string): boolean {
  if (!href) return false;
  if (href.startsWith("/")) return false;
  try {
    const url = new URL(href);
    return EXTERNAL_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch {
    return /^https?:\/\//.test(href);
  }
}

export function ExternalLink({ href, children, showIcon = true, className, ...rest }: ExternalLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={["link-external", className].filter(Boolean).join(" ")}
      {...rest}
    >
      <span>{children}</span>
      {showIcon ? <Icon name="external-link" size={12} /> : null}
    </a>
  );
}
