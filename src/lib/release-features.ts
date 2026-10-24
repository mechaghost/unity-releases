import { FEATURE_DETAILS, type FeatureDetails } from "./release-feature-details";
import { RELEASE_GUIDES, guideHref, type GuideHighlight, type ReleaseGuide } from "./release-guides";

export type ReleaseFeature = GuideHighlight & { id: string; details: FeatureDetails };

export function guideFeatures(guide: ReleaseGuide): ReleaseFeature[] {
  return guide.highlights.map((item, index) => {
    const id = `${guide.version}-${index}`;
    const details = FEATURE_DETAILS[id];
    if (!details) throw new Error(`Missing feature details: ${id}`);
    return { ...item, id, details };
  });
}

export function featureHref(guide: ReleaseGuide, feature: ReleaseFeature) {
  return `${guideHref(guide)}/${feature.details.slug}`;
}

export function findGuideFeature(guide: ReleaseGuide, slug: string) {
  return guideFeatures(guide).find(feature => feature.details.slug === slug);
}

export function featureTools(guide: ReleaseGuide, feature: ReleaseFeature) {
  const term = feature.details.searchTerms[0];
  const query = new URLSearchParams({ q: term });
  const notes = new URLSearchParams({ q: term, minorLine: `6000.${guide.version.split(".")[1]}` });
  return [
    { label: `Search Unity ${guide.version} release notes`, href: `/explorer?${notes}`, description: `Changes and fixes mentioning ${term}.` },
    { label: "Search reported issues", href: `/issues?${query}`, description: `Matches for ${term} across Unity versions.` },
    ...(feature.details.packageId
      ? [{ label: "Check package versions", href: `/packages?${new URLSearchParams({ q: feature.details.packageId })}`, description: feature.details.packageId }]
      : [{ label: "Search guides and resources", href: `/resources?${query}`, description: `Tutorials and references matching ${term}.` }]),
    { label: "Search Unity discussions", href: `/discussions?${query}`, description: `Unity staff topics mentioning ${term}.` }
  ];
}

export function relatedFeatures(guide: ReleaseGuide, feature: ReleaseFeature) {
  const terms = new Set(feature.details.searchTerms.map(term => term.toLowerCase()));
  return RELEASE_GUIDES.flatMap(release => guideFeatures(release).map(item => ({ guide: release, feature: item })))
    .filter(item => item.feature.id !== feature.id)
    .map(item => ({ ...item, score: item.feature.details.searchTerms.reduce((n, term) => n + (terms.has(term.toLowerCase()) ? 2 : 0), 0)
      + (feature.details.packageId && item.feature.details.packageId === feature.details.packageId ? 1 : 0) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || Number(b.guide.version === guide.version) - Number(a.guide.version === guide.version))
    .slice(0, 4);
}
