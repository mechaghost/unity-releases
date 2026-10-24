import type { PackageFeatureLink } from "@/lib/release-guide-links";

export function PackageFeatureLinks({ links }: { links: PackageFeatureLink[] }) {
  if (links.length === 0) return null;
  return <details className="guide-support">
    <summary>Feature guides ({links.length})</summary>
    <ul>{links.map(link => <li key={link.href}>
      <a href={link.href}>{link.title} — Unity {link.version}</a>
    </li>)}</ul>
  </details>;
}
