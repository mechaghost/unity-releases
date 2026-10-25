import { RELEASE_GUIDES, type ReleaseGuide } from "./release-guides";
import { guideFeatures } from "./release-features";

/** Support expiry does not remove features from the Unity 6 family catalog. */
export function unity6Features(now = new Date(), guides: readonly ReleaseGuide[] = RELEASE_GUIDES) {
  const today = now.toISOString().slice(0, 10);
  return guides.filter(guide => /^6\.\d+$/.test(guide.version) && guide.released <= today)
    .flatMap(guide => guideFeatures(guide).map(feature => ({ guide, feature })));
}

export function filterUnity6Features(
  entries: ReturnType<typeof unity6Features>,
  filters: { q: string; version: string; category: string }
) {
  const terms = filters.q.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return entries.filter(({ guide, feature }) => {
    if (filters.version && guide.version !== filters.version) return false;
    if (filters.category && feature.category !== filters.category) return false;
    const text = [feature.title, feature.benefit, feature.category, feature.limitation ?? "", ...feature.details.searchTerms].join(" ").toLocaleLowerCase();
    return terms.every(term => text.includes(term));
  });
}
