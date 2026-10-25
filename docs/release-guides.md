# Plain-language release guides

The /whats-new overview and /whats-new/unity-6-x guides explain release families, not individual patches. The existing homepage and technical tools remain available. All seven launched Unity 6 families through 6.6 have reviewed launch summaries.

## Editorial updates

Edit src/lib/release-guides.ts. Keep releases newest first. For each new guide:

- Verify the official launch announcement, date, support type, and support policy. Do not publish a guide based on a roadmap or beta announcement as a released version.
- Write as many short, original highlights as the release supports; there is no fixed card count. Cover distinct features with a reader benefit and a relevant image. Link the source announcement containing those claims. Keep total paraphrased source content concise.
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

Every feature has its own local WebP in `public/images/release-guides`. The manifest `src/lib/release-guide-images.json` records the original image URL, source article (or the guide announcement by default), alt text, and actual dimensions. Images are from Unity announcements and versioned documentation, not generated artwork. Rights remain with their respective owners; source articles are available from feature detail pages. Demeo is a contextual Android XR example from Unity's developer story, not a screenshot proving a 6.2-specific rendering change. The two 6.0 demo images are video preview stills; the 6.6 2D lighting and 6.2 Mesh LOD illustrations are stills from Unity's animated demonstration.

Keep each visible feature to a benefit-led heading and one sentence. Keep casual cards to the benefit. Put specific setup steps, requirements, and limitations on the feature detail page. Omit generic advice and Notes dropdowns. Prefer a real demonstration or screenshot that matches the exact feature; never substitute a release logo. Do not claim an illustration proves measured performance. Preserve the full image (contain, not crop) and allow readers to enlarge it on the detail page. Optimize to at most 1200 by 800 without upscaling; keep each below 300 KB. Lazy-load below the opening row. Verify every feature image decode and load in desktop and mobile browsers, and review their actual appearance.

## Minimal layout

The overview starts with the page title and one chronological release grid. Guides start with a breadcrumb, title, support badges, then feature images. Do not add slogans, category eyebrows, introductory sections, jump buttons, or a support panel ahead of the cards. Put support explanations and dates below the cards in disclosures. Overview images open the guide; individual feature cards open their detail pages. Use specific feature names and one useful sentence, without catchphrases. Browser tests require first cards within 180px on the overview and 260px on guides, including 320px screens.

The current catalog has 61 illustrated features: 16 for 6.6, 11 for 6.5, 5 for 6.4, 8 for 6.3, 7 for 6.2, 6 for 6.1, and 8 for 6.0. These are editorial launch highlights, not an exhaustive list of API changes. Counts follow the available content, not a quota. Megacity illustrates ECS; it is not a new 6.4 demo. Animated source images are presented as stills.

## Feature detail pages

Each card opens `/whats-new/[release-slug]/[feature-slug]`. Content lives in `src/lib/release-feature-details.ts`; routing, related features, and tool links live in `src/lib/release-features.ts`. Keep explicit feature slugs stable when titles change. The existing version-index keys join images, highlights, and detail records: append new features, and never reorder those records independently. There is no card-count limit.

The detail page serves readers who want to use a feature: exact Unity terminology, what changed, concrete setup steps, specific requirements, official links, and relevant searches elsewhere on the site. Requirements are optional. Do not fill an empty section with generic advice. The launch release stays visible alongside its current support status; preview-at-launch badges describe historical availability.

Official links use normal same-tab navigation. Full-card links contain no nested controls. Image provenance remains in the image manifest; source articles appear in the detail references rather than as repeated Image source links. Detail images may be enlarged.

Search links use a technical feature term, not its casual heading. Release-note searches include `minorLine=6000.x`; issue searches span versions and must not be presented as confirmed feature defects. Package searches use the actual package ID. Staff discussions and resource searches can have no matches. Do not invent exact patch versions for the comparison tool.

Verification covers every published feature route and canonical, all images, strict 404s, keyboard/card navigation, release-note filters, sitemap fallback without the database, 320px reflow, and light/dark accessibility. Review screenshots of the release cards and detail pages on desktop and mobile.

## Research and review decisions

The card/detail split follows the [Scottish Government card guidance](https://designsystem.gov.scot/components/card) and [Parliament card pattern](https://designsystem.parliament.uk/components/cards/): concise navigation cards lead to full information. A single named anchor avoids conflicting actions inside the card. [W3C link-purpose guidance](https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html) supports naming each card from its feature heading. Native anchors also keep feature URLs discoverable under [Google's crawlable-link guidance](https://developers.google.com/search/docs/crawling-indexing/links-crawlable).

The pre-implementation swarm reviewed editorial content, UX/accessibility, and architecture/site integration. Resulting decisions: stable shareable routes, official action link near the title, bounded detail image, no source links on cards, context-aware searches rather than generic tool promotions, and independent content/sitemap checks. Feature claims and setup guidance are checked against the official Unity references stored in each detail record.

### October 24, 2026 verification

All 61 feature detail records were reviewed against official Unity material. Of 85 distinct resource links, 79 returned HTTP 200 directly; six Unity Discussions pages blocked the HTTP crawler and were checked through browser retrieval. Broken launch-index links were replaced with working documentation. Current package documentation is labelled when it can describe later versions.

Review fixes included accurate renderer/platform requirements, Android build settings, Mesh LOD limits, and removing an incorrect package association. Browser review caught and fixed inconsistent portrait-image heights. Integration tests caught and fixed the release-note filter losing its visible selection when that line had no indexed entries.

The full unit suite passed (810 tests; six optional tests skipped). Ten desktop/mobile browser checks passed, including all feature routes, card image/body/keyboard navigation, 320px reflow, light/dark accessibility, images, and release-note filter handoff. TypeScript and the production build passed. This verifies the site UI and source links, not execution of Unity features in the Editor or on physical devices.

## Homepage and shared navigation

The homepage `/` renders the release overview. `/whats-new` remains a working alias with `/` as its canonical URL; guide and feature URLs stay unchanged. The sitemap lists the homepage once. Legacy homepage bookmarks carrying comparison parameters redirect to `/compare`, preserving repeated filters and other query values. Ordinary visits and campaign parameters stay on the overview.

Navigation puts What’s New under Discover and the comparison, release, issue, and package tools under Developer tools. Compare versions has its own `/compare` destination. Brand links return to the release overview. Site descriptions and sharing artwork cover features, releases, and upgrades.

Guide pages use the shared heading, button, spacing, color, border, and focus tokens. Overview cards and feature cards each have one full-card link; image frames preserve the full image. Technical tools retain their compact tables and filters. Page introductions explain the purpose in one sentence.

Technical release pages link to the matching published major-release guide. Package dialogs receive compact, server-selected feature links for exact package IDs; these are editorial associations, not package-version compatibility claims. Unrelated packages show no feature section.

Verification includes the homepage and alias canonical, old comparison bookmarks, one active navigation item, desktop/mobile card interactions, release-to-guide and package-to-feature round trips, 320px layout, and settled light/dark accessibility. The package-versioning check and read-only production package/API checks also passed; no deployment is part of this change.

## Unity 6 feature catalog

`/whats-new/unity-6-features` combines the existing feature cards for every published Unity 6 guide, including superseded releases. The overview links to it with “Browse all Unity 6 features.” Each card names the version that introduced the highlight and links to the existing feature detail page.

Search (`q`), version (`version`) and category (`category`) are GET parameters, so filtered views can be bookmarked and shared. Search matches all entered words across titles, benefits, categories, requirements and editorial search terms. Unknown filter options fall back to all versions/categories. The count, empty state and clear-filters link reflect the combined filters. All matching cards render together; images below the first row load lazily.

This is a catalog of selected launch highlights, not every release-note change or a promise that older Editor versions include later features. Future releases and non-Unity-6 guides are excluded. Existing per-release guides and the past-release archive stay available. The canonical and sitemap include the unfiltered catalog URL.
