import { parseUnityVersion } from "./parsers/version";
import { RELEASE_GUIDES, guideHref } from "./release-guides";
import { featureHref, guideFeatures } from "./release-features";

/** Compact link data passed from server pages to the package dialog. */
export type PackageFeatureLink = { title: string; href: string; version: string };

export function editorReleaseGuideLink(version: string, now = new Date()) {
  let parsed;
  try {
    parsed = parseUnityVersion(version);
  } catch {
    return undefined;
  }
  if (parsed.major !== 6000) return undefined;
  const guide = RELEASE_GUIDES.find(item => item.version === `6.${parsed.minor}`);
  if (!guide || guide.released > now.toISOString().slice(0, 10)) return undefined;
  return { href: guideHref(guide), label: `Unity ${guide.version} feature guide` };
}

/** Editorial feature associations, not package-version compatibility claims. */
export function packageFeatureLinks(packageName: string, now = new Date()): PackageFeatureLink[] {
  const today = now.toISOString().slice(0, 10);
  return RELEASE_GUIDES.filter(guide => guide.released <= today).flatMap(guide =>
    guideFeatures(guide)
      .filter(feature => feature.details.packageId === packageName)
      .map(feature => ({ title: feature.title, href: featureHref(guide, feature), version: guide.version }))
  );
}
