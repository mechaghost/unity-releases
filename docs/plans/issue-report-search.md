# Search linked Unity bug reports

Status: implementation plan; no application or production changes made.
Date: 2026-11-02.

## Goal and acceptance example

Find release notes using the symptoms described in their linked Unity Issue
Tracker reports. Keep Unity's release-note wording and release classifications
unchanged. Give people and API clients enough source context to understand a match.

The customer example is UUM-145761 in 6000.3.23f1. The note says “Remove assertions
from ToFileDescriptor.” The linked report adds Linux, fd, file descriptor, files,
NamedPipeServerStream, Docker, and batchmode. The current live API finds the note
for `ToFileDescriptor`, but not for `linux`, `fd`, `descriptors`, or `files`.

Sources inspected during investigation:

- [Unity release](https://unity.com/releases/editor/whats-new/6000.3.23f1)
- [Unity report](https://issuetracker.unity.com/api/v1.0/redirects/guid/UUM-145761)

The report lists 6000.3.23f1 as fixed. It describes an assertion failure while open
file descriptors remained below the limit; do not describe it as proof that all
file-descriptor exhaustion is fixed.

Acceptance: with version 6000.3.23f1 selected, searches for `linux`, `fd`,
`descriptors`, `files`, `linux file descriptors`, and `NamedPipeServerStream`
return this note with the report title, source link, and supporting text. The old
`ToFileDescriptor` and issue-ID searches still work. These are separate queries;
this change does not introduce slash-separated OR syntax.

## Scope

First delivery includes public report titles and descriptions, background
collection, release-note search, result context, the release-notes API, and a
resumable backfill. Start with issue IDs referenced by supported releases; seed
the customer's exact example even if the current supported-release selection
changes. Expand to historical releases after the initial checks pass.

Do not add embeddings, AI summaries, comments, attachments, authenticated reports,
or searches of all Unity bugs. Do not infer fix status, platforms, risk, or scores
from report text. Report context reflects the latest successful fetch, not the
report as it existed on the release date. Missing reports do not hide release notes.

`/issues` uses a separate substring query in `src/lib/issues.ts`. Extending that
search is a follow-up, explicitly outside this delivery. The release explorer,
release detail, compare filters, and `/api/release-notes` share release-note query
builders and must behave consistently in this delivery. External search engines
and Claude's choice of tools are outside our control.

## Existing code to preserve

- `src/lib/db/schema.sql`: the trigger builds `search_vector` from release fields,
  issue IDs, package names, and the note body. It does not fetch reports.
- `src/lib/search.ts`: shared predicates, pagination, counts, and optional rank
  sorting. Default sorting is newest first; keep that default.
- `src/lib/db/repositories.ts`: `upsertReleaseBundle` deletes and recreates note
  rows when a release changes. Report records must not depend on these row IDs.
- `src/lib/issue-tracker-links.ts`: handles old and new tracker hosts and links.
  Source URLs can be slugs, redirect routes, or search fallbacks.
- `src/lib/ingest/fetch.ts`: bounded HTTP retries. It currently follows redirects
  automatically; report fetching needs validation of every redirect destination.
- `src/jobs/poll-all.ts`, `src/lib/ingest/job-health.ts`: job supervision and health.
- `src/app/_components/NoteRow.tsx` and page adapters: shared note presentation.

## 1. Store report content separately

Add an `issue_reports` table keyed by normalized issue ID, independent of note-row
foreign keys. Keep source URL, final canonical URL, plain-text title, plain-text
description, content hash, parser version, source snapshot reference, last attempt,
last successful fetch, next eligible attempt, failure count, and last outcome.
Distinguish ready, unavailable, and retryable failure states. Track successful
content separately from the latest failed attempt so transient errors retain the
last good data. Reuse source snapshots and ingestion run records for traceability.

Add a nullable `enriched_search_vector` to release-note rows and its GIN index.
NULL means not built; a built empty vector is a different state. Track the vector
format version so a later indexing change can identify rows needing repair.
Preserve the existing `search_vector` for fallback and rollback. Build the new
vector from existing searchable fields plus reports linked through `issue_ids`:
original metadata weight A, note body and report titles weight B, descriptions
weight C. Missing or unavailable reports contribute no text. Normalize whitespace
and decode entities; do not change the original `body` or its hash.

A server-only `ISSUE_REPORT_SEARCH_ENABLED` flag selects enriched search and
extra result fields. Off means existing search behavior. For unfinished rows use
`enriched_search_vector IS NULL AND search_vector @@ query` as an indexed fallback
alongside the enriched-vector match; ranking uses the same chosen vector. Verify
both branches with query plans. Every note remains searchable throughout backfill,
including historical notes whose reports have not been collected. Do not expose
the flag as a client query parameter.

Before adding columns, deploy explicit projections that preserve the existing API
fields: both query builders currently use `SELECT *`, so schema-first rollout
would expose new columns even with the flag off. Snapshot the existing response
contract and test it against the expanded schema. Internal vectors and fetch state
must not appear as new API fields. Populate existing vectors in resumable batches,
not an unbounded table rewrite in the ordinary schema migration.

Build the GIN index with a dedicated nontransactional maintenance command. The
normal schema runner uses the application pool and its eight-second statement
timeout. Give the maintenance connection an explicit finite timeout appropriate
to the measured table size and a short lock timeout. Check `pg_index.indisvalid`
after `CREATE INDEX CONCURRENTLY`; detect and safely remove/rebuild an invalid
index on rerun. Keep this operation outside the normal schema batch. Test interrupted
index creation and reruns rather than relying on `IF NOT EXISTS`.

Refresh affected vectors when report content changes or is withdrawn. New and
re-imported note rows must build from the current report cache. Serialize report
writes and release re-imports for their shared issue IDs using transaction-scoped
advisory locks acquired in sorted order before changing report/note rows. For
release re-import, acquire a per-release lock first, read old membership, then lock
the union of old and incoming issue IDs before any note/report writes. Report
workers and repair jobs take issue locks before row locks and never request release
locks afterward. Audit all writers, including `refresh-core-projections.ts`,
`reclassify-notes.ts`, normal import, and vector repair; document the shared lock
namespace/order in one helper. A repair that touches several issues takes the full
sorted set for that batch. Fresh reads after waiting must see the committed report
state. Keep network work outside those transactions. Test overlapping imports and
refreshes with real database connections; retain a bounded repair command to rebuild vectors
from current source records if a job was interrupted or the indexing logic changes.

## 2. Fetch only referenced public reports

Add `src/lib/parsers/issue-report.ts`, a tracker fetch helper, and
`src/jobs/poll-issue-reports.ts` (`npm run ingest:issue-reports`). Inspect live old
and new tracker pages before choosing selectors or structured fields. Check in
small fixtures that cover both formats and the customer example. Parse the issue
record, not arbitrary page-wide text. Exclude navigation, consent text, comments,
related issues, scripts, and embedded instructions from the indexed content.

Use known source links from issue mentions. Validate issue IDs and all URLs. Allow
HTTPS on `issuetracker.unity.com` and `issuetracker.unity3d.com` only, no credentials,
nonstandard ports, or arbitrary hosts. Validate each redirect before following it,
with a maximum of five hops. Preserve legacy-slug redirects; do not rewrite their
host blindly. For ID-only links, verify a supported redirect or structured lookup
before implementing it. Never treat a search-results page as the issue itself.
Require the returned issue ID to agree with the requested ID, or leave it
unresolved. Never attach a guessed or nearby search result.

Start with one concurrent request, at least one second between requests, 20-second
attempt timeout, one retry for transient failures, a 2 MiB decoded response limit,
and an eight-minute/100-issue budget per run. Count retry and redirect requests
against the rate budget. Honor Retry-After; persist a host-wide cooldown when the
server asks for a pause. Stop the batch on throttling or a repeated parser failure
that suggests the site changed. Do not use browser automation or paid scraping
services in the scheduled production job.

A successful empty description is valid if identity and title are verified. An
empty or generic page is not success. Network errors and 5xx keep last-good
content. A stale slug returning 404 does not prove removal: retry through the saved
canonical URL or a verified issue-ID resolver. Only identity-based confirmation
of a removed/private report withdraws content from search/display and records a
reason. Ambiguous route or access failures retain last-good content and retry. Use
fixtures to distinguish a genuine unavailable page from a bot challenge or login page. Keep internal fetch evidence
separate from public API responses.

## 3. Queue, refresh, and job health

Select distinct referenced issue IDs, never fetch once per release mention.
Separate genuinely new references from historical backfill. Reserve at least half
of each run for due retries/refreshes, oldest-due first; unused capacity can serve
new references and backfill. Backfill cannot starve refreshes. Weekly refresh is a
target, conditional on measured capacity; inventory the eligible report count and
expected retry load before setting the production cadence. Retry transient failures
with bounded exponential delays (up to 24 hours), and unavailable reports monthly. Include explicit IDs and version
selection for debugging/backfill. Store progress in the database so restarts resume.
Prevent overlapping cron/manual workers using a database advisory lock on a
dedicated connection; release it on shutdown. The per-issue write locks above also
coordinate with release ingestion.

Add the bounded job after editor/backfill data is available and before discussions
in `poll-all.ts`. It must not prevent later jobs from running. Use an independent
server-only `ISSUE_REPORT_COLLECTION_ENABLED` flag for scheduling. Match that setting between the web health service and cron service so
a disabled rollout is not reported as a broken core job. Connect enabled job status
to the existing job-health system. Successful per-issue writes survive failure
elsewhere in the batch. Unavailable reports are counted outcomes; transport/parser
failures fail the job summary even when other items succeeded. A budget-limited run
is successful when it saved progress and reports the remaining backlog.

Record requested, fetched, unchanged, unavailable, failed, and pending counts,
age of the oldest pending item, coverage by release line, duration, and bytes.
Measure the unique-issue count before promising a backfill duration or cost. At
100 issues twice daily, the nominal ceiling is 200/day before retries and refreshes;
use explicit bounded manual runs to accelerate initial coverage, respecting the
same shared cooldown and worker lock. Before expanding scope, show enough measured
capacity for refreshes plus expected new/retry work. Alert when the oldest due
refresh is more than 48 hours overdue; show this separately from scheduled-job
success. Test fairness with a continuously nonempty backfill/new-reference queue.
Do not promise prompt withdrawal detection beyond the actual refresh cadence.

## 4. Search behavior and returned context

Use the combined vector for the complete `websearch_to_tsquery` expression. Do not
implement `note matches OR report matches` independently: a query can have one
word in the note and another in the report. Preserve phrases, exclusions, OR,
facets, counts, stable pagination, and notes without issue IDs. Index each note
once even if several reports or versions reference an issue. Do not create a
quoted-phrase match by placing separate fields next to each other: the note, each
report title, and each report description are distinct phrase boundaries. Before
finalizing the vector format, prove a boundary strategy in real Postgres tests for
short and stopword-containing phrases, large descriptions, and multiple reports.
Ordinary AND terms may span fields; quoted phrases must occur within a field.
If positional gaps alone cannot satisfy accepted query sizes without position
saturation, use source-aware phrase verification before counting/pagination. This
is a required design/test gate, not a claim that plain vector concatenation works.
Include negated quoted phrases and mixed OR expressions: a false cross-field
phrase must not discard a row during candidate selection before final verification.
The candidate query must be broad enough to preserve every valid final match.

Keep newest-first and all existing sorts. `order=rank` uses the enriched vector
weights and stable tie breakers. Weighting is a preference, not a guarantee that
every title match precedes every repeated description match; test realistic long
reports and tune if needed. Keep the explorer's current newest-first version
grouping, so rank is an API/query option rather than a new UI relevance sort. Add
`id ASC` to the range builder, which currently lacks the final tie breaker, and
test compare pagination with tied dates/source-order values.
Apply the same predicate to count and range queries used by compare pages.

After selecting a page, load linked report context in one batched query, with no
per-row network/database fetches and no joins that multiply result rows. Return
an additive `issueReports` array with issue ID, title, canonical URL, last successful
fetch timestamp, and a short plain-text excerpt (maximum 400 characters per report).
Do not leak raw snapshots, retry state, or full descriptions through `SELECT *`.
Choose a query-relevant excerpt where possible; label it as report context rather
than claiming every excerpt independently satisfied a multi-field search.

Create a shared `LinkedIssueReports` presentation component used by `NoteRow`
and compare's custom `DedupedIssueRow` and `ByPackageLaneBody` renderers. Preserve
report context through explorer/release adapters, `src/lib/compare-lanes.ts`,
`src/lib/compare-markdown.ts` (including `toDedupeRow`), and
`src/lib/compare-export.ts`. Deduplicated groups must retain the relevant linked
reports across their member rows, with each source attached to its issue ID.

Show a compact “Linked bug report” title and source link,
with an excerpt in search results. Escape all report text. Support keyboard access
and long technical titles on mobile. For a note with several reports, display the
first two and an accessible disclosure for the rest; preserve all links. Add
source context to affected copy/export actions and `/compare.md` so copied results
remain useful. Preserve the existing full-range export scope, which deliberately
excludes view filters; do not silently make exports reflect only the visible page.
Update API/help text and `llms.txt` to describe the added search coverage accurately.
Do not promise external search-engine indexing of filtered result pages.

## 5. Verification before enabling

- Parser fixtures: old/new layouts, exact issue identity, HTML entities, backticks,
  technical tokens, blank description, wrong ID, generic/search/error/challenge
  pages, comments excluded, removed/private reports, and response/redirect limits.
- Fetch/job tests: retries, Retry-After, persistent cooldown, duplicate IDs, worker
  overlap, cancellation, saved partial progress, deadlines, and health outcomes.
- Real Postgres contracts: customer queries, mixed note/report terms, singular and
  plural words, phrase/OR/exclusion behavior and field boundaries, no-report and unfinished-vector
  fallback, multiple reports,
  stable counts/pagination, rank ordering, cache refresh and removal, re-import,
  concurrent refresh/import, interrupted repair, and flag-off behavior.
- Query plans on representative data: record before/after p50 and p95 for common,
  rare, and broad queries, including counts and compare ranges. Initial gate: no
  query exceeds the existing eight-second DB timeout; investigate any p95 increase
  over 20%. Record index size and backfill write load before choosing batch sizes.
- UI/API acceptance: run the customer searches with a version filter, inspect the
  returned report context, verify no unrelated note claims the match, and check
  desktop/mobile results, all three compare lane types, `/compare.md`, copy/export,
  unavailable reports, and flag-off rendering. Confirm schema-only rollout keeps
  the API response unchanged after the compatibility deployment.
- Run focused tests, the full unit suite, `npm run typecheck`, relevant database
  contracts, `npm run build`, and browser checks for the changed result surfaces.

## 6. Rollout and rollback

1. Inventory issue counts, source-link formats, and currently supported release
   lines using existing release data/support rules; record the exact initial scope.
2. Deploy explicit API/query projections first, with response-contract tests. Then
   apply additive schema changes with reads and collection disabled. Check migration
   reruns and bounded vector/index preparation; confirm the compatible app works.
3. Deploy collection/search code disabled to every web/cron writer. Drain running
   old jobs before enabling collection; do not overlap old uncoordinated writers
   with the collector. Audit repair/manual commands as well. Enable bounded
   collection and seed UUM-145761; verify identity, fields, and linked note vectors.
4. Finish collection for the initial supported-release scope. Report unavailable
   reports separately from pending/failed ones; do not claim complete coverage
   while pending or failed items remain. Separately check all note-vector readiness,
   index validity, and original-vector fallback for unfinished rows. Simulate an
   interrupted backfill and confirm historical/no-report queries still work.
   Measure quality, performance, and steady-state refresh capacity.
5. Enable enriched search and context, verify the customer searches through the
   public API/UI, and monitor latency, job failures, backlog, and search coverage.
6. Expand historical coverage in bounded batches after initial checks pass.

Deployment is a separate authorized step, not part of writing this plan. Follow
`ship-release` and repo instructions when release work is requested: commit verified
implementation on main, update/push release without force, wait for Railway
SUCCESS, and check `/`, `/stats`, `/releases`, and `/api/health` for HTTP 200 plus
the feature's API/UI acceptance queries. Fix visible release failures in-session.

Rollback: turn off enriched search and collection independently, leaving additive
schema and cached data in place. The original vector remains usable without a
rebuild. Verify flag-off API shape, old sorting/results, and all four health routes.
A parser failure requires repair/re-fetch before re-enabling; it must not erase
valid release notes or modify status/risk calculations.

## Implementation checklist

- [ ] Inventory and parser fixtures; establish failure/identity rules.
- [ ] Add report storage, additive vectors, repair job, and concurrent-write tests.
- [ ] Add bounded collector, durable retries/cooldown, supervision, and health.
- [ ] Update shared search predicates/ranking and additive API context.
- [ ] Update shared UI, copy/export context, and search documentation.
- [ ] Pass functional, concurrency, performance, and browser acceptance checks.
- [ ] Commit verified implementation on main; deploy only when requested.
- [ ] Backfill and enable following the measured rollout gates.

## Plan review

Three independent reviewers inspected this plan against the current code. Their
findings were incorporated; implementation tests have not run because this task
only produces a plan. All three reviewers rechecked the revised plan and found no
remaining blocker to committing it. The search reviewer also requested explicit
negated-phrase/OR candidate-selection tests; those are now included.

| Review | Accepted finding | Plan change |
| --- | --- | --- |
| Data/search | Schema-first rollout exposes columns through `SELECT *`. | Compatibility projection deployment comes before schema expansion; response-contract tests cover flag-off behavior. |
| Data/operations | Unfinished vectors can hide historical notes. | Explicit NULL state, indexed original-vector fallback, and independent readiness checks. |
| Data | Old jobs bypass the new write locks. | Upgrade/drain all writers before collection; cover repair/reclassification and define lock order. |
| Data | A broken legacy slug can look like a removed report. | Confirm removal through canonical/identity resolution before withdrawing content. |
| Operations | Backfill can starve refreshes; weekly capacity is unproven. | Reserve due-work capacity, measure throughput, alert on overdue work, and gate historical expansion. |
| Operations | Index creation can time out or leave an invalid index. | Separate maintenance command, deliberate timeouts, index-validity checks, and restart tests. |
| Search/UI | Custom compare rows and markdown drop context. | Name each adapter/renderer, share report presentation, preserve export scope. |
| Search | Range pagination has no final tie breaker. | Add `id ASC` and tied-row tests. |
| Search | Concatenated fields can invent phrase matches. | Require field-boundary verification before settling the index format. |

Implementation decisions still requiring measured evidence: tracker parsing and
identity routes, initial supported-line selection, safe phrase-boundary handling,
index-build timeout/batch sizes, and sustainable refresh cadence. Each is assigned
to an implementation acceptance gate above; none is established by this review.
