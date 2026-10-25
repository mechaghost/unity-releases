# Unity Releases site audit — October 24, 2026

The site is available, but it has broken outgoing links, incomplete history views, and import failures that can be hidden by successful health checks. Some live problems already have fixes on `main`; those fixes are not deployed.

The audit inventoried **21,112 distinct links**, requested **5,780 distinct site URLs** (including linked filters and package APIs), and found **107 broken linked destinations**: 43 internal and 64 external. All 1,689 live sitemap URLs responded successfully. Another 13,507 external destinations remain unverified because of blocking, rate limits, or a redirect/network failure.

This is an analysis report. Only audit files were added; no application changes or deployments were made.

## Evidence and limits

- Live target: https://unityreleases.com, checked October 24, 2026, America/Los_Angeles (October 25 UTC).
- Railway reports deployment `cdd5eca3-b201-4aee-b043-8887183eadf3` as `SUCCESS`, running `fa413e77c833a9c11e07da70e5bd682e810d5f57` from `release`. This was read directly through the Railway connector.
- Source review used local `main`, including the existing `6ea5421` version-link fix and `e300c13` past-release page. Other work continued in this shared checkout during the audit.
- Started with every URL in the live sitemap, added all static page routes, recursively checked same-site links without query parameters, then checked the query links found in those responses. Extracted HTTP(S) links from server-rendered anchors and all 197 package-history API responses, using the application's changelog renderer.
- See [coverage.json](coverage.json) for exact counts, [pages.csv](pages.csv) for every requested site URL, [links.csv](links.csv) for each distinct link and its result, and [broken-links.csv](broken-links.csv) for failures. Link rows include example referring pages. URLs are deduplicated without fragments; fragment targets were not validated.
- External sites returned bot blocks and rate limits. Further requests to those hosts were stopped once detected. These links are **unverified**, not assumed broken. HTTP 200 means reachable, not necessarily accurate or up to date; redirects ending at `/not-found` are classified as broken.
- Browser checks covered home navigation, a populated comparison, and a loaded package dialog. The slow-network dialog race is source-confirmed, not browser-reproduced. This was not an exhaustive mobile, keyboard, accessibility, visual-layout, or performance audit. Arbitrary combinations of filters, hidden hover links, and new links exposed only by additional query states are not exhaustively traversed.
- `npm test`: 855 passed, 6 skipped; 93 test files passed, 3 skipped. `npm run typecheck`: passed. No production fault injection or database-writing integration tests were run.

## Fix first

### 1. Replace obsolete Issue Tracker URL builders — high priority

**Confirmed live and still present in source.** There are two broken patterns:

- Generated searches such as `https://issuetracker.unity3d.com/issues?search=UUM-155199` redirect to `https://issuetracker.unity.com/api/v1.0/redirects/slug?search=UUM-155199` and return 404.
- ID links such as `https://issuetracker.unity3d.com/issues/uum-157935` redirect to `https://issuetracker.unity.com/not-found`, which returns 200 but displays “Page Not Found.” A status-only check misses these.

These links appear in release notes, comparisons, issue lists, issue details, and exported content. The crawl recorded 26 hard failures for the search pattern and 30 soft failures for old-host issue IDs in the initial page-link pass. More tracker links remain unverified because Unity rate-limited requests.

Source: `src/lib/release-notes/format.ts:149`, `src/app/_components/IssuePill.tsx:24`, `src/lib/compare-markdown.ts:36`, and the tracker guidance in `src/app/llms.txt/route.ts`. The test in `tests/release-note-format.test.ts:103` currently requires the obsolete search format.

**Fix:** centralize tracker URL generation, keep known source slugs, and replace obsolete fallbacks. The new host's root `/?search=ID` responds, but browser-confirm actual search results before adopting it. Do not treat a generic 200 app shell as proof that `/issues/ID` works. Test redirect destinations and page content as well as status.

### 2. Ship the existing guard against nonexistent release links — high priority

**Confirmed live; already fixed on `main`.** The crawl found 43 distinct linked `/releases/[version]` URLs returning 404. Examples:

| Link destination | Example referring page |
|---|---|
| `/releases/7000.0.0a13` | `/releases/7000.0.0a12`, `/explorer` |
| `/releases/6000.7.0b7` | `/releases/6000.7.0b6` |
| `/releases/6000.0.6f1` | `/releases/6000.0.85f1` |
| `/releases/2022.1.0f1` | See the full link inventory |

The deployed renderer turns version-shaped text into local links even when that version is not indexed. This includes future builds, old unsupported branches, and missing historical builds.

`6ea5421` already adds the indexed-version guard in `src/app/_components/NoteRow.tsx:20` and `:77`. `VersionPill.tsx:51` supplies the default URL when no explicit override is provided.

**Fix:** release the verified source through the project's normal Railway workflow, then recrawl the referring pages to ensure nonexistent versions are plain text. The 404 routes themselves need not become pages if those versions are outside the supported dataset. No deployment was performed during this audit.

### 3. Make import failures fail visibly — high priority

**Source-confirmed failure paths; not a claim that imports are failing now.**

- `src/jobs/poll-packages.ts:67-80` catches each package failure and exits successfully even if all packages fail. A safe mock returning HTTP 503 reproduced `error:1` with process exit code 0.
- `src/jobs/poll-news.ts:7-11` does not check HTTP status or RSS structure. `src/lib/parsers/rss.ts:24-28` turns a missing RSS channel into an empty list. An HTML “Service unavailable” response was safely reproduced as `[]`; the surrounding ingestion transaction can record success.
- `src/jobs/poll-legacy-lts.ts:46-49` accepts sitemap bodies without checking response status or structure, and `:93-103` suppresses per-release failures.

**Fix:** reject non-success responses and malformed feeds, record failed attempts, and exit nonzero when a run is incomplete. Tests should inject HTTP errors, HTML instead of RSS/XML, and mixed-success batches. Preserve already stored valid data when upstream fails.

### 4. Tighten freshness checks — medium priority

**Monitoring gap.** All six reported core sources were recently successful during this audit, and all 86 Product Updates sources reported healthy. However, `src/lib/db/repositories.ts:125-156`:

- marks core sources stale only after 720 hours (30 days), despite daily/twice-daily schedules;
- excludes sources with no recorded run;
- groups modern and legacy Editor imports together as `editor_release`, allowing one to hide failure of the other.

Package documentation imports are not included in this core freshness history. `src/jobs/health.ts` prints `status:ok` without checking the database or ingestion history.

**Fix:** maintain an expected job inventory, separate modern/legacy jobs, and set stale thresholds from each job's schedule. Distinguish web-process health from data freshness. Keep recent failures visible even when an older success is still within the freshness window.

## Page-by-page results

| Page or page family | Live result | Broken, old, or likely to break |
|---|---|---|
| `/` and `/whats-new` | Loads release guides | Live home still displays superseded guides among current cards. `main` already separates these. Data is labeled “Superseded,” so this is deployment lag rather than a false support claim. |
| `/whats-new/[slug]` | All crawled guide pages load | External discussion references can be blocked; they remain unverified. Static support/review dates need a scheduled content review when Unity changes support policy. No incorrect policy claim was established here. |
| `/whats-new/[slug]/[feature]` | All crawled feature pages load | Documentation and announcement URLs can move independently of the app. Preserve source URLs and test them periodically. |
| `/whats-new/past-releases` | 404 live | Present on `main` in `e300c13`, absent from the deployed revision. It was an explicit source-route probe, not a broken link found on the live home. |
| `/releases` | 200 | Default filter state can hide Beta/Alpha releases intentionally. Do not interpret filtered absence as failed ingestion. |
| `/releases/[version]` | Indexed pages load; 43 referenced destinations are 404 | Existing version-link fix is not deployed. Tracker fallback links are also broken. |
| `/compare` | Empty picker and populated comparison load | Sample: `6000.3.26f1` → `6000.3.27f1`. Tracker links remain broken. Broad filter combinations and all client interactions are not exhaustively tested. |
| `/compare.md` | 400 without required parameters is expected | A valid `from`/`to` export was checked separately. Obsolete tracker builders also affect exported links. |
| `/upgrade` | Redirects to `/compare` | Preserves supported query parameters; no separate rendered upgrade page. The destination has the comparison findings above. |
| `/explorer` | 200; reports 244,065 matches; 522 versions available in the filter | Only 100 rows are displayed and there are no next/previous controls. `offset` can be typed manually, but normal users cannot page through results. `src/app/explorer/page.tsx:242,298-306`. |
| `/issues` | 200 | Old-host ID links can land on Unity's 200 “not found” page. Derived status is a release-note interpretation, not an authoritative tracker status. |
| `/issues/[issueId]` | Crawled pages load | History is silently capped at 100; counts, earliest fix, and version scopes are derived from this subset. `/issues/UUM-123124` says 100 mentions while `/api/release-notes?issue=UUM-123124&limit=1000` returns 155. `src/app/issues/[issueId]/page.tsx:63-81,212`; default limit in `src/lib/search.ts:103`. |
| `/packages` | 200 normally; 197 packages | `/packages?q=a&q=b` returns 500. Next supplies a string array, but `src/app/packages/page.tsx:349-352` calls `.trim()` as if it were a string. Normalize repeated parameters. |
| Package history dialogs | All 197 data endpoints return 200; Memory Profiler opens in browser | Open → close before fetch completes → reopen leaves `load.status` at `loading`, and the effect refuses to fetch again. `PackageVersionDialog.tsx:82-116`. Reset cancelled loading state or retain the request. Dialogs also deliberately show only the newest 50 versions; there is no path to older stored history. Six additional 404 links were found inside changelogs: a removed GitHub profile, three KTX release tags, a Draco release tag, and an Android XR extension page. See the inventory for the exact package and URL. |
| `/news` | 200; recent entries visible | The linked `https://unity.com/blog/unity-plugin-for-codex` returns 404. Failed fetches can be mistaken for successful empty imports. Database failures appear as “No news indexed yet.” |
| `/resources` | 200; 525 entries, showing 200 | No paging controls for older entries. `poll-resources.ts:118-120` skips 404/410 resources without retiring stored URLs; entries removed from the upstream sitemap are not revisited. This is a future dead-link risk, not evidence every old resource is invalid. Database failures look like empty filter results. |
| `/discussions` | 200; recent staff posts visible | Unity blocks direct checks of discussion destinations, so their reachability remains unverified. Imported titles/dates alone do not prove the destination remains public. |
| `/github` | 200 | Checked links are listed in the inventory. Repository renames, removed releases, and pagination are long-term dependencies; no separate confirmed page failure found. |
| `/timeline` | 200 | Links and data depend on all importers. Recent activity from one feed should not be treated as proof every feed is current. |
| `/visualizer` | 200 | Charts depend on completeness of imported releases and derived issue status. No chart rendering failure established; mobile layout and chart interaction were not exhaustively tested. |
| `/stats` | 200 | Counts are not a replacement for per-source freshness checks. No confirmed live page failure found. |
| `/faq` | 200 | Source links checked where hosts allowed it. Keep source descriptions and tracked-version scope aligned with implementation. |
| `/updates` | 200 | Separate product health reports all 86 sources healthy. This is distinct from core import health. |
| `/updates/[family]` | Crawled families load | No confirmed internal failure; external source moves remain a dependency. |
| `/updates/products/[product]` | Crawled products load | Asset Transformer SDK links to `https://docs.unity.com/en-us/asset-transformer-sdk/2026.4/manual`, which returns 404. Its changelog ingestion can still be healthy while its documentation link is broken. |
| `/updates/products/[product]/[update]` | Crawled update pages load | Check source documentation and changelog links independently of ingestion success. |
| `/api/health` | 200, `status:ok` | Threshold and missing-job gaps described above. Healthy response is not proof of complete or accurate data. |
| `/api/updates/health` | 200, 86 sources healthy | All source health values were `ok` at check time. |
| Other public read APIs | Baseline endpoints load | Releases, packages, events, release-note search, updates, and all package version endpoints were checked. No write/analytics actions were submitted by the HTTP checks; normal browser visits can emit the site’s standard pageview beacon. |
| `/sitemap.xml`, `/robots.txt`, `/llms.txt` | Respond | All 1,689 live sitemap URLs were included in the audit. `llms.txt` still documents obsolete tracker URLs. Fragment anchors and search-engine indexing were not verified. |

## Other failure handling and old documentation

Database errors on News (`src/app/news/page.tsx:77`), Resources (`src/app/resources/page.tsx:150`), and Packages (`src/app/packages/page.tsx:368`) become successful empty pages. Show a temporary failure with retry guidance instead. Keep “no matches” for successful empty searches. This also makes monitoring more useful.

README still says `/` redirects to `/releases` and advertises `/packages/[name]`. Home now renders guides; package detail is a dialog backed by an API, not that route. Update these descriptions and remove obsolete links from operational guidance.

## Suggested repair order and acceptance checks

1. **Tracker links:** use one verified URL builder across pages, exports, and documentation. Confirm sample links reach real issue/search content in a browser, including persisted source URLs.
2. **Existing release-link fix:** ship verified `main`, then repeat the referring-page crawl. Ensure future and unindexed versions are not linked locally; verify the past-release archive after deployment.
3. **Package failures:** add repeated-parameter normalization and cancel/reopen recovery. Verify duplicate query values return a normal page and interrupted loading can recover without reload.
4. **Complete history:** separate full-history calculations from display pagination. The UUM-123124 count must match the full current query count (155 at audit time); add visible paging for search and resources.
5. **Import and health contracts:** test error HTTP, malformed feeds, never-run jobs, partial batch failures, and an independently failing modern Editor feed. These must not report successful fresh data.
6. **Link upkeep:** label or hide confirmed removed content without deleting historical evidence. Check HTTP failures and soft 404s; respect rate limits and retain an explicit unverified state.

`https://unity.com/download`, linked from Unity Hub pages, failed the automated fetch. A separate curl retry hit its 50-redirect limit in Unity login. This remains unverified for a normal browser session; it is not counted among the 107 confirmed broken destinations.

The CSV files are the detailed audit record. Their results are a point-in-time snapshot, not a guarantee that external content will remain reachable.
