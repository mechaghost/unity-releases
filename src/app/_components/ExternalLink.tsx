import type { AnchorHTMLAttributes, ReactNode } from "react";
import { resolveExternalLink } from "@/lib/external-links";

type ExternalLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  children: ReactNode;
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

export function ExternalLink({ href, children, className, ...rest }: ExternalLinkProps) {
  const resolved = resolveExternalLink(href);
  const isButton = className?.split(/\s+/).includes("btn") ?? false;
  if (!resolved.href) {
    return (
      <span className={className} title={`${resolved.reason} Original URL: ${href}`}>
        {children} <span className="muted">(Source unavailable)</span>
      </span>
    );
  }
  return (
    <a
      href={resolved.href}
      target="_blank"
      rel="noopener noreferrer"
      className={[isButton ? null : "link-external", className].filter(Boolean).join(" ")}
      {...rest}
    >
      {isButton ? children : <span>{children}</span>}
    </a>
  );
}
