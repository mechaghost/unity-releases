# Plain-language release guides

The /whats-new overview and /whats-new/unity-6-x guides explain release families, not individual patches. The existing homepage and technical tools remain available. All seven launched Unity 6 families through 6.6 have reviewed launch summaries.

## Editorial updates

Edit src/lib/release-guides.ts. Keep releases newest first. For each new guide:

- Verify the official launch announcement, date, support type, and support policy. Do not publish a guide based on a roadmap or beta announcement as a released version.
- Write four short, original highlights: reader benefit plus a practical consideration. Link the source announcement containing those claims. Keep total paraphrased source content concise.
- Distinguish optional services, beta/experimental features, hardware requirements, and separate pricing. Do not imply that a feature appeared here for the first time merely because a launch post mentions it.
- Review support separately from launch content. Set reviewed to the actual check date. Update the overview review text and sitemap timestamp if the editorial review changes.
- Do not automatically turn patch notes or AI drafts into published guides. Later patch fixes belong in the existing technical tools.

## Support rules

LTS and Update describe release type. Supported now, Superseded, and Standard support ended describe maintenance. Never infer support from a recent patch timestamp or label an old Update as currently supported.

Sources checked October 24, 2026: Unity's release support page specifies standard support through October 2026 for 6.0 and December 2027 for 6.3, plus one year for Enterprise/Industry. Store month precision as published. A month deadline expires on the first day of the next month (UTC); the UI makes no exact-day promise. Extensions are conditional on subscription, not standard support.

An Update is superseded when a later released family in the reviewed catalog exists. If the newest Update has not been reviewed in over 30 days, show Check current support instead of retaining a positive claim. Pages render per request so deadlines do not freeze at build time. Review this catalog whenever a new family launches, even if its full editorial guide is not yet ready; remove stale claims before publishing highlights. Previews remain accessible through Editor Releases.

## Verification

Run npm test and npm run typecheck. Run npm run test:e2e with the local Postgres test database available; the guide suite covers all routes, 404s, selected navigation, keyboard disclosures, 320px overflow, and light/dark accessibility. Review actual desktop and mobile screenshots, including the overview. Check print preview when changing guide layout. The sitemap includes reviewed guide URLs even if the database is unavailable.

## Feature images

Every feature has its own local WebP in `public/images/release-guides`. The manifest `src/lib/release-guide-images.json` records the original image URL, source article (or the guide announcement by default), alt text, and actual dimensions. Images are from Unity announcements and versioned documentation, not generated artwork. Rights remain with their respective owners; each image links to its source. Demeo is a contextual Android XR example from Unity's developer story, not a screenshot proving a 6.2-specific rendering change. The two 6.0 demo images are video preview stills; the 6.6 2D lighting and 6.2 Mesh LOD illustrations are stills from Unity's animated demonstration.

Keep each visible feature to a benefit-led heading and one sentence. Put requirements in the collapsed consideration. Prefer a real demonstration or screenshot that matches the exact feature; never substitute a release logo. Do not claim an illustration proves measured performance. Preserve the full image (contain, not crop) and allow readers to enlarge it. Optimize to at most 1200 by 800 without upscaling; keep each below 300 KB. Lazy-load below the opening row. Verify all 28 images decode and load in desktop and mobile browsers, and review their actual appearance.
