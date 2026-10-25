# Site consistency audit — October 24, 2026

Reviewed the shared navigation, lists, cards, filters, badges, dates, dialogs, charts, release guides, and product-update pages. This pass keeps the existing visual design and fixes differences that change how people read or use the site.

## Fixes

- Unknown release streams no longer display a Supported marker. Packages without an indexed version show Unknown rather than Stable, and do not match the Stable or Prerelease filters.
- Publication dates use the same UTC calendar day and date format in server pages and client dialogs. The homepage's last-updated timestamp still uses the visitor's timezone.
- Clearing the last release-stream checkbox now keeps an empty selection. Selecting another stream restores results; sorting links preserve the selection.
- Automatic filter responses no longer overwrite newer edits in the open drawer. Search, issue ID, preset, sub-range, and manifest controls have accessible names.
- Issue badges have a visible, keyboard-accessible history action next to the existing Unity tracker link. Essential navigation no longer depends on opening a hover card.
- Theme switching works when browser storage is blocked. Domain filter buttons have a single keyboard stop.
- Mobile filter pills wrap into rows consistently on releases, packages, resources, and activity pages.
- GitHub, discussion, and product-update pages clamp out-of-range pagination to real results. Failed GitHub, discussion, and activity queries show a retryable error instead of claiming there are no records.
- The visualizer identifies which charts use the domain filter, distinguishes calculated scores from raw counts, and reports partial loading failures.
- FAQ and machine-readable page descriptions match the current release defaults and visualizer scope.
- GitHub card headings follow the page heading correctly. Product-update introduction and GitHub empty-state copy describe useful next steps without implementation details.

## Coverage

Source review covered every page family and shared interaction components. The initial browser sweep visited 20 routes at 1440px, 390px, and 320px in both light and dark themes: 120 checks. It found no page-wide overflow or contrast failures; the GitHub heading-order finding was fixed. Desktop and mobile screenshot sheets were reviewed for spacing, density, hierarchy, filter layout, and badge consistency.

The committed browser audit covers 24 representative routes, including release/issue details, a populated comparison, guides, and product detail/history pages. It checks both themes for accessible presentation, a single page heading, JavaScript errors, and page-wide overflow. Other browser tests cover navigation, dialogs, filter persistence, keyboard focus, pagination, exports, guide links/images, and error/retry states.

## Verification results

- Unit suite: 1,027 passed; 6 optional checks skipped.
- Browser suite: 231 distinct checks passed across the full run and corrected targeted rerun; 3 viewport-specific skips. The last targeted run passed all 54 checks.
- The 24-route desktop/mobile matrix passed in light and dark themes with no axe violations, page-wide overflow, or JavaScript errors.
- Type checking and the production build used by the browser suite passed. Final mobile Resources, Packages, and release-detail screenshots were inspected.

## Evidence boundaries

This is a local implementation audit, not a production deployment. The initial local data snapshot lacks the resources `unavailable_at` column and `core_job_runs` table, so resources and ingestion freshness showed their error states there. Populated versions of those pages are checked against the current schema in the isolated browser-test database. No production database or release branch was changed.

Browser checks use Chromium desktop and phone emulation. They do not establish physical-device, Safari, or screen-reader acceptance. Chrome touch successfully opened existing badge explanations and tracker links; Radix emits a passive-event warning on touch. Hover-card footer links are supplementary: their destinations are available through visible links outside the cards.

## Repeatable checks

- `npm test`
- `npm run typecheck`
- `npm run test:e2e`
- Focused visual matrix: `npm run test:e2e -- tests/e2e/site-visual-audit.spec.ts`

Local screenshots and raw logs are in `.artifacts/site-audit/`; they are not committed.
