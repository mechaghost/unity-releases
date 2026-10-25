# Sentinel identity

Selected direction: **Original refined**, row 01 of [selection-reference.png](selection-reference.png).

## Design set

- [Identity board](identity.png): logo arrangements, black-on-white marks on light, blue and dark surfaces, favicon and app-icon concepts, colors and typography.
- [Desktop proposal](desktop.png): release browser in light and dark themes.
- [Mobile and sharing proposal](mobile-social.png): mobile release browser, social card and browser icon.

Generated with the built-in image generation tool. Original prompts are in [prompts.json](prompts.json); the current board edits are in [prompts-v2.json](prompts-v2.json). These PNGs are design proposals, not production logo exports or screenshots of an implemented site. Dates, counts, stream assignments and release descriptions are illustrative.

## Identity

Keep the chosen owl's angular ears, flat crown, pointed chin, slanted eye sockets, vertical pupils and diamond beak. The implementation uses one canonical vector master; generated repetitions in the concept boards have small differences and are not separate production marks.

Always use a black owl with white eye areas, black pupils and a white diamond beak. On blue or dark surfaces, place the black owl on a white rounded-square tile. Never invert the face colors. The wordmark may be white on dark backgrounds. The selection reference is historical; its inverse examples are superseded by this rule.

Use Inter for the wordmark and UI, with the existing JetBrains Mono/system monospace stack for versions. Verify font loading during implementation rather than assuming the existing CSS font names load font files.

Suggested short brand line: **Know what changed.**

| Role | Color |
| --- | --- |
| Ink | #111318 |
| Cobalt action | #2455F5 |
| Paper | #F7F8FC |
| Secondary text | #596174 |
| Night background | #11151E |
| Dark panel | #1B2230 |
| Dark links | #A8B9FF |

Use blue for primary actions, links and active selection. Keep fixes, warnings and breaking changes separately labeled with the site's semantic colors. Do not copy the inconsistent stream colors in the generated mobile board.

## Site application

- Place a compact owl and stacked wordmark in the existing left navigation.
- Keep all current routes and navigation groups; the mockups shorten the list for presentation.
- Retain the existing home page and release-browser behaviors. These proposals show the releases route, not a replacement home page.
- Use compact tables on desktop and readable entries on mobile.
- Mobile header: owl, wordmark and menu control. Avoid a persistent desktop sidebar.
- Use black-on-white tile icons, with cobalt only around the tile, and a quiet sharing card with the owl, name, short brand line and domain.
- Preserve independent-project disclosure.

## Production assets

The canonical geometry is in `src/lib/sentinel.ts`. `SentinelMark` uses it for the navigation, favicon, Apple icon and sharing card. The tile is always white; fills never follow the theme.

Run `npm run brand:generate` to rebuild the downloadable SVG and 16/32/48/180/192/512px PNGs in `public/brand`. The 1200×630 sharing image is served at `/opengraph-image`; `/icon` and `/apple-icon` provide Next metadata icons. `/manifest.webmanifest` references the 192/512px PNGs.

The navigation provides stacked desktop and compact horizontal mobile wordmarks. Both use locally hosted Inter; version strings use locally hosted JetBrains Mono. Font licenses and source details are in `src/app/fonts`.

Use at least one quarter of the mark height for clearspace; the generated identity board's full-height clearspace label is too generous for navigation. Inspect small-icon eye and beak legibility at actual size.

The implementation reuses LeftNav, MobileNavToggle, ThemeToggle and existing CSS tokens. Existing routes, data and table/card behavior are retained. The mockups are directional, not literal replacements for live release data or controls.

Verification: unit suite, production build, desktop/mobile browser checks, matching owl-face pixels between light/dark themes, mobile drawer focus/Escape, icon endpoints, navigation contrast, and horizontal overflow. See `tests/e2e/sentinel-brand.spec.ts` and `tests/lib/dark-token-parity.test.ts`.

Implemented in the repository. Deployment is separate.


## Implemented previews

Actual local production-build captures using the local database:

- [Desktop light](implemented/desktop-light.png) and [desktop dark](implemented/desktop-dark.png).
- [Mobile light](implemented/mobile-light.png) and [mobile dark](implemented/mobile-dark.png).
- [Rendered sharing card](implemented/social.png).

Verified on 2026-10-24: 855 unit tests passed (6 skipped), typecheck, production build, and 4 desktop/mobile branding browser tests. Contrast and accessible-name checks passed on home, releases, compare and packages in both themes. These are local browser checks, not production deployment evidence.
