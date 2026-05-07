# Unity Alerts — Design Spec

A release-first dashboard. The visual reference is Linear / Vercel / Railway / GitHub Releases / Stripe — contained surfaces with hairline dividers, dense rows, sticky filter bars, sidebar nav on desktop and a top bar with drawer on mobile. No floating cards on a bare background. No "goofy".

This spec works inside the existing token system in `src/app/styles.css`. No new tokens are required.

---

## 1. Visual language

### Surface hierarchy

Three surfaces, used consistently:

| Token            | Where it goes                                                                                |
| ---------------- | -------------------------------------------------------------------------------------------- |
| `--surface-sunken`  | The page background behind everything (`body`, `.app-shell`). Acts as the canvas.         |
| `--surface-base`    | Contained content surfaces: list/table containers, sidebar, top bar, lanes, cards.        |
| `--surface-overlay` | Hover/active state for rows and chips, popovers, drawers, dialogs, the active tab pill.   |

Rule: a content surface is always one solid block of `--surface-base` sitting on the `--surface-sunken` canvas. Never put `--surface-base` rows directly on `--surface-sunken` with no container — that's the "floating cards" failure mode.

### Border treatment

- Container outline: `1px solid var(--border-subtle)`.
- Row dividers inside a container: `1px solid var(--border-subtle)` on the bottom edge of every row except the last.
- Heavier `--border-default` only on inputs, action buttons, and the active state of pills/tabs.
- `--border-strong` is reserved for focus rings and selected segmented-control states.
- Never use a shadow to separate a list from the page; the container border is the separator.

### Density

- Standard list row height (one-line): **44px** including padding.
- Standard list row height (two-line, mobile): **56px** minimum (already in CSS).
- Internal row padding: **`var(--space-3)` vertical, `var(--space-4)` horizontal** on desktop; **`var(--space-2)` vertical, `var(--space-3)` horizontal** on mobile.
- Page-header to content gap: `var(--space-5)`.
- Filter bar to list gap: `var(--space-4)`.
- Section to section gap: `var(--space-6)`.

### Typography assignments

| Element                                  | Token                                                | Weight                  | Color                |
| ---------------------------------------- | ---------------------------------------------------- | ----------------------- | -------------------- |
| Page H1                                  | `--text-2xl` / `--leading-2xl`                       | `--weight-semibold`     | `--text-primary`     |
| Page subtitle / count line               | `--text-sm`                                          | `--weight-regular`      | `--text-muted`       |
| Section H2                               | `--text-lg`                                          | `--weight-semibold`     | `--text-primary`     |
| List/table column header                 | `--text-xs`                                          | `--weight-medium`       | `--text-muted`       |
| List row primary text (version, title)  | `--text-base`                                        | `--weight-medium`       | `--text-primary`     |
| List row meta (date, stream label)       | `--text-sm`                                          | `--weight-regular`      | `--text-muted`       |
| Mobile row meta (compressed)             | `--text-xs`                                          | `--weight-regular`      | `--text-muted`       |
| Sidebar nav item                         | `--text-base`                                        | `--weight-regular`      | `--text-secondary`   |
| Sidebar nav item (active)                | `--text-base`                                        | `--weight-medium`       | `--text-primary`     |
| Pill / chip / button label               | `--text-sm`                                          | `--weight-medium`       | contextual           |

Column headers are **NOT** uppercase letterspaced — that ages the design and makes pages look like 2014 enterprise software. Use sentence case at `--weight-medium` in `--text-muted`. (Current `THead` styling already does this — keep it that way.)

Mono (`--font-mono`) is reserved for version strings (`6000.0.74f1`) and issue IDs (`UUM-12345`).

---

## 2. Layout grid & breakpoints

### Single primary breakpoint: **1024px**

Above 1024px → desktop layout (sidebar visible, content centered). At or below 1024px → mobile layout (top bar visible, sidebar becomes a drawer). This is the only breakpoint that changes the global shell. Keep it.

### Desktop (>1024px)

- Sidebar: `240px` fixed width, `--surface-base`, sticky to viewport, full height, `border-right: 1px solid var(--border-subtle)`.
- Content column: max-width **1200px** (was 1280, narrow slightly so dense rows don't stretch into ultrawide dead space). Centered with `margin: 0 auto`.
- Content padding: `var(--space-8)` top/bottom, `var(--space-6)` left/right.
- The page background is `--surface-sunken` — always. The contained surfaces (list, lanes, cards) carry `--surface-base`.

### Mobile (≤1024px)

- Top bar: **52px** tall, fixed to top, full width, `--surface-base`, hairline bottom border. Z-index above content.
- Content padding: `var(--space-4)` left/right, `var(--space-4)` top (additive over the 52px bar offset), `var(--space-8)` bottom.
- Drawer: `280px` wide, max `85vw`, slides in from the left with `transform: translateX(0)`. Backdrop `rgba(0,0,0,0.45)`.
- The content area gets a top offset of `52px + var(--space-3)` to clear the fixed bar (already in CSS).

### Secondary breakpoint: **640px** (justify only)

Use only for compressing the compare picker, the upgrade lanes grid, and packages filters into single-column layouts. Do **not** introduce a 768px breakpoint for the releases list — the 1024 swap already covers it; smaller widths just reuse the mobile list.

---

## 3. Navigation

### Desktop sidebar (`.lnav`)

Structure top-to-bottom:

1. **Brand row.** 56px tall. Left-aligned: 24×24 accent square mark with "U", then the wordmark "Unity Releases" at `--text-md` / `--weight-bold`. Hairline bottom border. Clickable, returns to `/`.
2. **Nav sections.** `var(--space-3)` top padding, `var(--space-2)` horizontal padding, `var(--space-1)` between items.
3. **Footer.** Pinned to bottom. Currently holds `ThemeToggle`. Add a thin top border (`--border-subtle`).

Nav item:

- Height `32px`, horizontal padding `var(--space-3)`, gap `var(--space-2)` between icon and label, `--radius-md` corners.
- Default: `--text-secondary` text, transparent background.
- Hover: `--surface-sunken` background, `--text-primary` text. (Keep current rule.)
- Active (`aria-current="page"`): `--accent-soft` background, `--text-primary` text, `--weight-medium`, plus the existing `box-shadow: inset 3px 0 0 var(--accent)` accent rail.
- Icon: 20×20, `currentColor`.

The items are exactly the four already defined: Editor Releases, Compare versions, Packages, News. No sub-nav is shown unless we ship one explicitly.

### Mobile top bar (`.mobile-topbar`)

Layout (left to right, all vertically centered): hamburger button → brand mark + wordmark.

- The hamburger is **part of the bar**, not a floating square. It is enclosed by the bar's surface and bottom border. Size 36×36, `--radius-md`, `--border-default` outline, transparent background, `--text-primary` icon.
- The brand inline next to the hamburger gives the user immediate context — they see where they are. Brand mark 24×24 accent square + "Unity Releases" at `--text-sm` / `--weight-semibold`.
- Optional right side (future): page-context action slot (e.g. compare button on `/releases`). Spec for now: leave empty, but reserve the right side via `justify-content: space-between` on a flex container so we can drop in actions later without re-layout.

### Drawer behavior

When the hamburger is tapped, the sidebar (`.app-shell__nav`) translates into view from the left. The drawer renders the full `LeftNav` including its own brand row.

**Yes, render the brand inside the drawer.** Two reasons:

1. The drawer overlays content but does NOT cover the top bar at the same z-index in all states; the brand inside the drawer reinforces "this is the app's primary nav" rather than looking like a generic side panel.
2. Linear, Vercel, and Railway all repeat the brand at the top of their mobile drawer for consistency with the desktop sidebar — it's a familiar, expected pattern.

The drawer adds a backdrop scrim (already present); tapping the scrim or pressing Escape closes it (already present). Body scroll is locked while open (already present).

---

## 4. The `/releases` page

This is the page the user is angry about. Be exact.

### Page header

Stacked, left-aligned, no flexbox tricks:

```
H1: Editor Releases
P:  70 Unity 6 releases tracked from official Unity sources.
```

- H1 uses the typography from §1.
- The count line is `--text-sm` `--text-muted`. It updates with the filter (already correct).
- Gap between H1 and subtitle: `var(--space-1)`.
- Gap between header block and filter row: `var(--space-5)`.
- No badges, no buttons in the header for this page.

### Stream filter row

Horizontal pill row, sits directly under the header.

- Container: `display: flex; flex-wrap: wrap; gap: var(--space-2);`. No border, no background — the pills themselves are the visual element.
- Each option is a **pill-shaped checkbox** (`--radius-pill`), height **32px**, horizontal padding `var(--space-3)`, label `--text-sm` `--weight-medium`.
- Unchecked state: `--surface-base` background, `--border-default` 1px border, `--text-secondary` label, no checkmark icon visible.
- Checked state: `--accent-soft` background, `--accent` 1px border, `--accent-soft-fg` label, small inline checkmark icon (12px) on the left at `--accent`.
- Hover: border becomes `--border-strong`; checked-hover keeps the accent border.
- The native checkbox stays visually hidden (`opacity: 0; position: absolute;`) but remains keyboard-focusable. Focus state: `--border-focus` ring on the label.
- Order: LTS, Supported, Beta, Alpha. Default selected: LTS only.
- Gap between filter row and list: `var(--space-4)`.

The current implementation places a real native `<input type="checkbox">` *inside* the pill and shows it. **Stop doing that.** A checked checkbox visually duplicated by a pill's checked styling reads as a form, not a filter. The pill IS the affordance; hide the input and let the pill background carry the state.

### The list — desktop (>1024px)

A **contained table** that reads as a list. NOT a card grid. NOT a sparse 4-column layout with single-word values floating in dead space.

Container:

- `--surface-base` background.
- `1px solid var(--border-subtle)` border.
- `--radius-lg` corners.
- `overflow: hidden` so row dividers meet the rounded edge cleanly.
- Max width: **none** — let it span the content column up to the 1200px max. Drop the current 880px cap (the table looked sparse precisely because it was constrained too tight while also having too few columns; we are widening the row by giving it more content and a sensible max).

Header row (`thead`):

- Sticky to top of container (`position: sticky; top: 0; background: --surface-base;`) with bottom hairline.
- Height `40px`, padding `var(--space-3) var(--space-4)`.
- Column labels: `--text-xs` `--weight-medium` `--text-muted`. Sentence case ("Version", "Stream", "Latest patch", "Released", "Notes"). NOT uppercase tracking-wide.

Data row:

- Height `48px`, padding `var(--space-3) var(--space-4)`.
- Hover: `--surface-overlay` background, cursor pointer if the whole row links to detail.
- The full row is the link target to `/releases/[version]` (wrap row content in an `<a>` or use a row-level click handler with keyboard support). Action icons (external link) live in the last cell and stop event propagation so they remain independently clickable.
- Bottom border `1px solid var(--border-subtle)` on every row except the last.

Columns (left to right):

| Column         | Width  | Content                                                                                  |
| -------------- | ------ | ---------------------------------------------------------------------------------------- |
| Version        | 180px  | `<VersionPill>` with the version string in mono.                                         |
| Stream         | 140px  | A small inline stream chip (LTS / Supported / Beta / Alpha) at `--text-sm`.              |
| Released       | 140px  | Absolute date (e.g. `Apr 29, 2026`) at `--text-sm` `--text-muted`. `tabular-nums`.       |
| Released (rel) | 100px  | Relative date (`12 days ago`) at `--text-xs` `--text-muted`. Hide below ~1100px.         |
| Notes status   | flex   | Inline label like `Parsed · 142 entries` or `Not yet parsed` at `--text-sm` `--text-muted`. |
| Actions        | 80px   | Two icon buttons aligned right.                                                          |

This gives us six meaningful columns instead of four sparse ones. The row finally feels like a real product row, not three short labels.

If the eng team finds "Notes status" data unavailable cheaply at list time, they may swap it for the latest-known-issue count or omit it; the column slot stays so the row still has visual weight. Don't ship the four-column sparse version.

### The list — mobile (≤1024px)

The user explicitly wants a LIST, not floating cards. The current implementation already converts the table to a contained list — keep that approach but make the surface and rhythm correct.

Container:

- `--surface-base` background.
- `1px solid var(--border-subtle)` border.
- `--radius-lg` corners.
- Sits with `var(--space-4)` horizontal page padding around it. **Not full-bleed.**

Row:

- Two-line layout, min-height **64px**.
- Padding `var(--space-3) var(--space-4)`.
- Grid: `grid-template-columns: minmax(0, 1fr) auto; column-gap: var(--space-3); row-gap: var(--space-1);`
- Top line, left: `<VersionPill>` (mono). Top line, right (same row): action icons.
- Bottom line, left: stream chip + " · " + relative date (e.g. `LTS · 12 days ago`), `--text-xs` `--text-muted`. Span both grid rows is unnecessary — actions stay vertically centered with `align-self: center; grid-row: 1 / span 2;`.
- Bottom border `1px solid var(--border-subtle)`, no border on the last row.
- Row hover/active: `--surface-overlay` background.

The row's primary tap target is the entire row (links to detail). Action icons sit on the right edge.

### Action affordances

Two icons per row, both icon-only with `aria-label`:

1. `file-text` icon → internal link to parsed notes (`/releases/[version]`). Tooltip "Parsed notes".
2. `external-link` icon → official Unity release page in a new tab. Tooltip "Unity page".

Spec:

- 32×32 button, `--radius-md`, `1px solid var(--border-subtle)`, `--surface-base` background, `--text-secondary` icon.
- Hover: `--border-default` border, `--surface-overlay` background, `--text-primary` icon.
- Always visible at every breakpoint. Do **not** hover-reveal — touch users can't hover, and these are the only per-row actions.
- 4px gap between the two icon buttons.
- On mobile, the row already links to the detail page, so the `file-text` icon is technically redundant for tap users — keep it anyway for parity with desktop and for keyboard users who'd otherwise need to find the row link.

### Empty state

When the filter matches zero releases:

- Inside the same contained list surface (don't drop it on the bare canvas).
- Centered, padding `var(--space-8) var(--space-4)`.
- Small icon (`inbox` or `file-text`), 24px, `--text-muted`.
- Heading "No releases match this filter." at `--text-base` `--weight-medium` `--text-primary`.
- Body "Try a different stream combination." at `--text-sm` `--text-muted`.
- Optional secondary action: a button "Reset to LTS" that links to `/releases` (no query).

---

## 5. Other pages — quick guidance

- **`/releases/[version]`** — Page header with the `<VersionPill>` + stream chip + release date inline. Below it, the existing release-note workbench (search input, quick tabs, filter chips, group/order controls) sits in a sticky filter bar (`--surface-base`, hairline bottom). Results render inside a `--surface-base` container with hairline-divided rows; show the issue chips inline at row level. Same density rules as the releases list.
- **`/packages`** — Same pattern as `/releases`: page header, optional category filter pill row, then a contained list. Columns: package, latest version, latest version date, brief description, action icons. Mobile collapses to two-line rows.
- **`/packages/[name]`** — Header with `<PackagePill>` + summary, then a contained version-history list with version, date, type-of-change badge, link icon. Same recipe as the releases list.
- **`/compare`** — Top section is the version picker (two `<VersionPill>` selectors + a Go button) inside a `--surface-base` panel with hairline border. Below, render the upgrade lanes (`.lane`) as the existing card stack but enforce consistent `--space-4` gap and ensure each lane's header sticks within the lane while its body scrolls the page normally.
- **`/upgrade`** — Same lane primitive as `/compare`, grouped into the existing categories (active known issues, fixes gained, etc.). Each lane body is a list, not free text.
- **`/explorer`** — Sticky filter bar at the top (search input + facet pills with explicit labels), then a contained, grouped list. Use the same row pattern as `/releases` for consistency.
- **`/news`** — Contained list of news items, two-line rows: title (primary) + source/date (meta). Same surface and divider treatment.
- **`/issues/[issueId]`** — Reuse the lane primitive: a header lane with the issue summary, then lanes for affected versions, status, and links.

In every case: page header → optional filter/sticky bar → one or more `--surface-base` containers with hairline-divided rows. Never bare items on `--surface-sunken`.

---

## 6. Component recipe summary

### List surface

- Container: `background: var(--surface-base); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); overflow: hidden;`
- Sticky header row: `position: sticky; top: 0; background: var(--surface-base); border-bottom: 1px solid var(--border-subtle); height: 40px; padding: 0 var(--space-4);`
- Data row: `min-height: 48px; padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--border-subtle);` last child has no bottom border.
- Hover row: `background: var(--surface-overlay);`
- Mobile row: two-line grid as defined above, 64px min-height, padding `var(--space-3) var(--space-4)`.

### Filter pill row

- Wrapper: `display: flex; flex-wrap: wrap; gap: var(--space-2);` no background, no border.
- Pill (label wrapping a hidden input): `height: 32px; padding: 0 var(--space-3); border-radius: var(--radius-pill); border: 1px solid var(--border-default); background: var(--surface-base); color: var(--text-secondary); font-size: var(--text-sm); font-weight: var(--weight-medium); display: inline-flex; align-items: center; gap: var(--space-1);`
- Checked: `background: var(--accent-soft); border-color: var(--accent); color: var(--accent-soft-fg);` plus a 12px check icon.
- Hidden checkbox: `position: absolute; opacity: 0; pointer-events: none;` (still keyboard-focusable via the label).

### Top app bar (mobile)

- `position: fixed; top: 0; left: 0; right: 0; height: 52px; background: var(--surface-base); border-bottom: 1px solid var(--border-subtle); z-index: 60;`
- Inner: `display: flex; align-items: center; gap: var(--space-3); padding: 0 var(--space-3);`
- Hamburger 36×36 with `--border-default` outline, `--radius-md`. Brand inline immediately to its right.

### Sidebar (desktop)

- `width: 240px; background: var(--surface-base); border-right: 1px solid var(--border-subtle); position: sticky; top: 0; height: 100vh;`
- Brand row 56px with `border-bottom: 1px solid var(--border-subtle)`.
- Items 32px tall, `--radius-md`, active state per §3.

---

## 7. What NOT to do

- **No** floating bordered rows or cards sitting directly on the page background. Everything is inside a contained `--surface-base` surface.
- **No** sparse 4-column desktop tables where each cell holds one short string. If the desktop row doesn't have at least 5 meaningful pieces of information, redesign the columns.
- **No** uppercase letterspaced column labels. Sentence case at `--text-xs` `--weight-medium` `--text-muted`.
- **No** native checkbox visible inside a pill filter. The pill IS the affordance; hide the checkbox.
- **No** floating hamburger button with no surrounding bar. The hamburger lives inside a top bar that always shows the brand next to it.
- **No** single-line mobile rows that ellipsis the date or the version. Use two lines so primary identity (version) and meta (date, stream) both have room.
- **No** hover-only action affordances for primary per-row actions. Touch users can't hover.
- **No** `box-shadow` to separate a list from the page. Use the container border. Shadows are for elevated overlays only.
- **No** new design tokens. If a value isn't expressible with existing tokens, raise it before inventing one.
- **No** horizontal scroll for the releases table on desktop. The column set is fixed-width and fits inside the 1200px content column.
- **No** secondary breakpoint for the global shell. The 1024px swap is the only one for nav/layout; smaller breakpoints only adjust internal grids.
- **No** changing the page background between `--surface-sunken` and `--surface-base`. The canvas is always sunken; surfaces float (with borders, not shadows) on top.
- **No** rendering the brand only in the top bar and not in the drawer. The drawer mirrors the desktop sidebar exactly.
