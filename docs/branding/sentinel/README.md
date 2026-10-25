# Sentinel identity proposal

Selected direction: **Original refined**, row 01 of [selection-reference.png](selection-reference.png).

## Design set

- [Identity board](identity.png): logo arrangements, black-on-white marks on light, blue and dark surfaces, favicon and app-icon concepts, colors and typography.
- [Desktop proposal](desktop.png): release browser in light and dark themes.
- [Mobile and sharing proposal](mobile-social.png): mobile release browser, social card and browser icon.

Generated with the built-in image generation tool. Original prompts are in [prompts.json](prompts.json); the current board edits are in [prompts-v2.json](prompts-v2.json). These PNGs are design proposals, not production logo exports or screenshots of an implemented site. Dates, counts, stream assignments and release descriptions are illustrative.

## Identity

Keep the chosen owl's angular ears, flat crown, pointed chin, slanted eye sockets, vertical pupils and diamond beak. Use one canonical vector master when implementing; generated repetitions have small differences and must not become separate production marks.

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

## Production handoff

Reconstruct and approve one SVG master from the selected row before exporting variants. Produce black-on-white, white-tile, horizontal and stacked marks from it; do not produce inverse owl marks. Export and inspect actual 16/32/48px favicons, 180px Apple touch icon, 192/512px app icons and 1200×630 sharing image. Dimensions printed inside the boards are proposed export sizes, not delivered standalone assets.

Use at least one quarter of the mark height for clearspace; the generated identity board's full-height clearspace label is too generous for navigation. Inspect small-icon eye and beak legibility at actual size.

Implementation should reuse LeftNav, MobileNavToggle, ThemeToggle and existing CSS tokens. Keep explicit dark-theme and OS-preference token blocks in sync. Check contrast, keyboard focus, mobile overflow and desktop/mobile browser rendering before production use.

No application code or deployed site was changed for this design proposal.

