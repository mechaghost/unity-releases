import { pageSocialMetadata } from "@/lib/site";

const FAQ_DESCRIPTION =
  "Where Unity Releases data comes from, how often it updates, what the impact lanes and risk levels mean, and the standard not-affiliated-with-Unity disclaimer.";

export const metadata = {
  title: "FAQ",
  description: FAQ_DESCRIPTION,
  alternates: { canonical: "/faq" },
  ...pageSocialMetadata({ title: "FAQ", description: FAQ_DESCRIPTION, path: "/faq" })
};

type QA = { id: string; question: React.ReactNode; answer: React.ReactNode };
type Section = { id: string; title: string; items: QA[] };

const SECTIONS: Section[] = [
  {
    id: "about",
    title: "About this site",
    items: [
      {
        id: "not-affiliated",
        question: "Is this an official Unity site?",
        answer: (
          <>
            <strong>No.</strong> Unity Releases is an independent project,
            not affiliated with, endorsed by, or sponsored by{" "}
            <a href="https://unity.com" target="_blank" rel="noopener noreferrer">
              Unity Technologies
            </a>
            . &ldquo;Unity&rdquo; and the Unity logo are trademarks of Unity
            Technologies. This site only ingests and surfaces information that
            Unity already publishes publicly. For anything authoritative -
            licensing, support, official roadmaps - go to{" "}
            <a href="https://unity.com" target="_blank" rel="noopener noreferrer">
              unity.com
            </a>
            .
          </>
        )
      },
      {
        id: "versions-tracked",
        question: "Which Unity versions are tracked?",
        answer: (
          <>
            <p>
              Unity 6 ({" "}<code>6000.x</code>) is the primary focus. The LTS
              minor lines (<code>6000.0</code>, <code>6000.3</code>) get pinned
              by default; <strong>Supported</strong>, <strong>Beta</strong>,
              and <strong>Alpha</strong> chips reveal the rest of the Unity 6
              stream.
            </p>
            <p>
              Legacy LTS lines are also indexed for upgrade planning:{" "}
              <code>2022.3</code>, <code>2021.3</code>, <code>2020.3</code>,
              and <code>2019.4</code>. They appear on{" "}
              <a href="/releases">Editor Releases</a> when their chip is
              ticked, and they can be diffed against each other or against
              Unity 6 — picking a 2022.3.x → 6000.x diff is fine if you're
              evaluating the jump. Lane contents on cross-major diffs mix
              release notes from two independent product lines, so expect
              noisier output than a within-major diff.
            </p>
            <p>
              Pre-2019 lines and non-LTS branches of legacy years (e.g.
              2022.1) are not indexed.
            </p>
          </>
        )
      }
    ]
  },
  {
    id: "data",
    title: "Data & ingestion",
    items: [
      {
        id: "sources",
        question: "Where does the data come from?",
        answer: (
          <>
            Six public Unity sources, all polled on a schedule:
            <ul>
              <li>
                <strong>Editor releases (Unity 6):</strong> the three landing
                pages at{" "}
                <code>unity.com/releases/editor/{"{latest,beta,alpha}"}</code>{" "}
                and the markdown release-notes file each one links to. We follow
                the redirect to the actual version page (e.g.{" "}
                <code>whats-new/6000.3.14f1</code>) and parse the release notes
                into individual line items - version, area, platform tags,
                impact, risk, issue IDs, package names.
              </li>
              <li>
                <strong>Legacy LTS editor releases:</strong> per-year sitemaps
                under <code>unity.com/releases/sitemap/{"{year}"}.xml</code>{" "}
                feed the 2019.4 / 2020.3 / 2021.3 / 2022.3 LTS lines. Same
                parser, same line-item shape as Unity 6, so a cross-major diff
                returns one homogeneous result set.
              </li>
              <li>
                <strong>Packages:</strong> for each tracked official package, we
                hit <code>packages.unity.com/{"<name>"}</code> (the npm-style
                registry endpoint) and ingest its full version history,
                dist-tags, and Unity-version compatibility ranges. The list of
                packages is hand-curated in{" "}
                <code>src/lib/ingest/unity-packages.ts</code> because Unity
                doesn&apos;t publish a registry-listing endpoint -{" "}
                <code>npm run check:packages</code> finds new ones in release
                notes that aren&apos;t in the list yet.
              </li>
              <li>
                <strong>Resources:</strong> <code>unity.com/resources</code> -
                whitepapers, e-books, case studies, and the on-demand video
                library. Indexed for the <a href="/resources">Resources</a>{" "}
                page; not classified into release-note lanes.
              </li>
              <li>
                <strong>News:</strong> the official Unity blog RSS feed at{" "}
                <code>unity.com/blog/rss</code>.
              </li>
              <li>
                <strong>Staff discussions:</strong> the Discourse JSON API at{" "}
                <code>discussions.unity.com</code> - we track posts from
                accounts in Unity&apos;s staff user group, keeping each
                post&apos;s edit history so you can see when a Unity answer
                changed. Surfaced on the{" "}
                <a href="/discussions">Staff Discussions</a> page.
              </li>
            </ul>
            Every fetch is recorded in <code>source_snapshots</code> with a
            SHA-256 of the body so re-runs don&apos;t double-count.
          </>
        )
      },
      {
        id: "cadence",
        question: "How often does the data refresh?",
        answer: (
          <>
            <p>
              Editor releases and packages are polled on a several-hour cadence;
              resources and news poll less frequently because the upstream
              changes far less often. The exact intervals are configured at the
              deploy layer (Railway crons) rather than in the app, so the
              authoritative answer is always the live{" "}
              <a href="/api/health">/api/health</a> endpoint - it reports each
              source&apos;s last-success timestamp and hours-since-success, with
              a <code>stale</code> flag that flips when nothing has succeeded
              for the better part of a month.
            </p>
            <p>
              Legacy LTS releases are bundled into the same{" "}
              <code>editor_release</code> ingestion bucket as Unity 6 - one
              health entry covers both.
            </p>
          </>
        )
      }
    ]
  },
  {
    id: "lanes-and-risk",
    title: "Impact lanes & risk",
    items: [
      {
        id: "lanes",
        question: "What do the impact lanes mean?",
        answer: (
          <>
            Every release-note row is classified by{" "}
            <code>src/lib/classification.ts</code> into one impact bucket:
            <ul>
              <li>
                <strong>Active known blockers</strong> - known issues with risk
                level <em>blocker</em>, i.e. things Unity itself flagged as
                shipping-stoppers.
              </li>
              <li>
                <strong>Other known issues</strong> - known issues that aren&apos;t
                blockers (caution / review level).
              </li>
              <li>
                <strong>Breaking changes</strong> - anything Unity calls a
                breaking change or that the parser detects as one (deny-listed
                terms in the body).
              </li>
              <li>
                <strong>API changes</strong> - public scripting API surface
                changed (signature, rename, removal, new namespace).
              </li>
              <li>
                <strong>Security &amp; install impact</strong> - security fixes
                and install/platform risks combined.
              </li>
              <li>
                <strong>Package updates</strong> - note pertains to a Unity
                package version bump.
              </li>
              <li>
                <strong>Features / Improvements / Fixes / Other changes</strong>{" "}
                - straightforward.
              </li>
            </ul>
            The classifier is regex- and keyword-driven, not perfect. If a row
            looks miscategorized, it usually means Unity used unfamiliar
            phrasing for that area.
          </>
        )
      },
      {
        id: "risk",
        question: "What do the risk levels mean?",
        answer: (
          <>
            A second axis on top of impact:
            <ul>
              <li>
                <strong>Blocker</strong> - Unity-flagged as a shipping-stopper,
                or the parser detected blocker keywords (crash, data loss,
                certification-blocking).
              </li>
              <li>
                <strong>Caution</strong> - meaningful regression, some platforms
                broken, install-time issue.
              </li>
              <li>
                <strong>Review</strong> - needs a human eyeball: API surface
                changed, package versioning shifted, build pipeline twitched.
              </li>
              <li>
                <strong>Info</strong> - the rest.
              </li>
            </ul>
            The risk axis is independent of the lane axis - a row in the Fixes
            lane can still be Caution if the underlying problem was bad.
          </>
        )
      }
    ]
  },
  {
    id: "build-score",
    title: "Build score & Upgrade score",
    items: [
      {
        id: "what-is-build-score",
        question: "What is the Build score?",
        answer: (
          <>
            <p>
              A 0–100 composite per Unity release that summarizes six
              normalized sub-metrics into one number. Higher is better; 100
              is the best position, 0 the worst. It appears on{" "}
              <a href="/releases">Editor Releases</a> (sortable column),{" "}
              <a href="/releases/6000.0.32f1">each release detail page</a>{" "}
              (header badge), and on{" "}
              <a href="/visualizer">Release Visualizer</a> (best/worst
              leaderboard).
            </p>
            <p>
              The six sub-metrics roll up into three groups: <strong>upgrade
              risk</strong> (50% — breaking surface, blocker rate, mobile
              issue rate), <strong>net cleanup</strong> (30% — fix density
              and the fixes/known-issues delta vs the prior patch), and{" "}
              <strong>live debt</strong> (20% — known-issue rate users live
              with after upgrading). Click <em>How this number is
              computed</em> on any badge for the full per-metric table.
            </p>
          </>
        )
      },
      {
        id: "score-cohort",
        question: "What does “cohort” mean on a Build score?",
        answer: (
          <>
            <p>
              Each release is scored against the population of releases in
              the same <strong>stream</strong> — LTS releases are
              percentile-ranked against other LTS releases, Beta against
              Beta, Alpha against Alpha. The cohort name and size show up
              under the badge (e.g. <code>cohort: LTS (72)</code>) so the
              comparison is visible.
            </p>
            <p>
              If a stream has too few peers (fewer than 8 releases) the
              score falls back to the global <code>ALL</code> cohort. This
              matters mostly for fresh streams; once a stream accumulates
              eight patches it scores against itself. The cohort baseline
              is recomputed per request from current data — no frozen
              snapshots yet, so an old release&apos;s score can shift
              slightly as new releases land.
            </p>
          </>
        )
      },
      {
        id: "score-math",
        question: "How is the score computed?",
        answer: (
          <>
            <p>
              For each sub-metric: compute the raw ratio per release
              (e.g. <code>breaking + api_change / total_notes</code>),
              winsorize at the cohort&apos;s 95th percentile (so a
              mega-release doesn&apos;t crush everyone else&apos;s scores),
              apply <code>log1p</code> to compress remaining skew, then
              convert to a percentile rank within the cohort. For
              metrics where higher raw is worse (breaking, blockers,
              known-issues), the percentile is flipped to{" "}
              <code>100 − percentile</code>. Sub-scores combine into the
              composite via weighted arithmetic mean.
            </p>
            <p>
              There&apos;s <strong>no blocker cap</strong> or other
              categorical override — Unity&apos;s blocker labelling is
              inconsistent enough that a hard cap would drift with their
              tagging discipline rather than actual release quality. The
              blocker rate already costs 15% of the composite directly.
            </p>
          </>
        )
      },
      {
        id: "score-confidence",
        question: "What does the “provisional” pill on a score mean?",
        answer: (
          <>
            <p>
              The score is confidence-weighted toward the cohort median
              for releases with sparse data. A release with fewer than 20
              parsed notes gets blended proportionally: a 10-note release
              is 50% raw + 50% median. Below 5 parsed notes the score
              isn&apos;t shown at all (it would just be noise).
            </p>
            <p>
              The pill goes away once the release has enough data. Users
              don&apos;t see a fake-precision &ldquo;87/100&rdquo; off
              three notes; they see &ldquo;— / 100, insufficient data&rdquo;
              instead, or a provisional badge with the confidence ratio in
              the hover.
            </p>
          </>
        )
      },
      {
        id: "what-is-upgrade-score",
        question:
          "What is the Upgrade score on Upgrade Intelligence (/compare)?",
        answer: (
          <>
            <p>
              The diff-window equivalent of the Build score. Where Build
              score answers &ldquo;how does this single release compare to
              its peers?&rdquo;, Upgrade score answers &ldquo;how does the
              aggregate of every patch between <code>from</code> and{" "}
              <code>to</code> compare to single-release peers?&rdquo;
            </p>
            <p>
              There is no organic cohort of past diffs to score against —
              two arbitrary diffs span different lengths, streams, and
              calendar windows. So the Upgrade score treats the diff as a
              <em> virtual aggregate release</em>: sum the counts across
              every release in the window, compute the same per-note
              rates, and score against the global single-release
              population. The expander on the card explains this caveat
              inline; the trajectory chart below the score recovers what
              the aggregate hides.
            </p>
            <p>
              The <strong>net-fix-delta</strong> sub-score has a special
              reinterpretation on diffs: bookend delta (<code>to.netFix −
              from.netFix</code> normalized by total notes), so the score
              reflects how the destination patch&apos;s net-fix position
              compares to the starting patch&apos;s.
            </p>
          </>
        )
      },
      {
        id: "score-trajectory",
        question:
          "What does the trajectory chart + “Lowest-scoring patches” list show?",
        answer: (
          <>
            <p>
              An aggregate Upgrade score number compresses 30 patches into
              one — useful at a glance, but it hides whether the branch
              was steadily improving, steadily degrading, or had a V-shape
              with a rough middle. The <strong>trajectory</strong>{" "}
              sparkline plots each individual patch&apos;s build score in
              chronological order so the shape of the upgrade is visible:
              a rising line = each patch scored better than the previous;
              a falling line = the branch destabilized across this
              upgrade.
            </p>
            <p>
              The <strong>lowest-scoring patches</strong> list calls out
              the bottom 3 individual scores in the window, each labelled
              with the group that dragged it down (upgrade risk, net
              cleanup, or live debt). It answers &ldquo;where specifically
              should my QA budget go?&rdquo; — if a particular patch in
              the middle is what dragged the aggregate down, it&apos;s the
              one to canary-test.
            </p>
          </>
        )
      }
    ]
  },
  {
    id: "pages",
    title: "Pages & views",
    items: [
      {
        id: "page-upgrade",
        question: "What is Upgrade Intelligence (the homepage)?",
        answer: (
          <>
            <p>
              The main diff view. Pick two Unity editor versions in the From /
              To dropdowns and the page lane-buckets every release-note line
              item shipped between them - blockers, breaking changes, known
              issues, security &amp; install impact, package updates, API
              changes, fixes, improvements, features, other changes. Each lane
              has its own row count, pagination, and (where useful) deduplication
              behaviour.
            </p>
            <p>
              Cross-major diffs work too - 2022.3.50f1 → 6000.3.14f1 is a
              legitimate question and we answer it. Lane contents on
              cross-major ranges interleave release notes from two product
              lines, so the row count is high and the noise is real, but the
              data is correct.
            </p>
          </>
        )
      },
      {
        id: "page-releases",
        question: "What does Editor Releases show?",
        answer: (
          <>
            Every indexed Unity editor release in a paginated table. The chip
            row at the top defaults to <code>6.3 LTS</code> +{" "}
            <code>6.0 LTS</code> - tick Supported / Beta / Alpha or the legacy
            LTS chips (2022.3 / 2021.3 / 2020.3 / 2019.4) to widen the list.
            Each row links to the per-release detail page; the external-link
            icon opens the official Unity release page in a new tab.
          </>
        )
      },
      {
        id: "page-release-detail",
        question: "What does /releases/[version] show?",
        answer: (
          <>
            The same lane-bucketed view as Upgrade Intelligence, but for a
            single release rather than a range. Useful when you want to read
            one release&apos;s notes end-to-end (e.g. &ldquo;what landed in
            6000.0.74f1?&rdquo;) without the noise of every version above and
            below it.
          </>
        )
      },
      {
        id: "page-visualizer",
        question: "What is the Release Visualizer (/visualizer)?",
        answer: (
          <>
            <p>
              A visual read on the corpus rather than a row-by-row list.
              Seven charts stacked vertically, each one answering a
              different question:
            </p>
            <ul>
              <li>
                <strong>Stability heat strip</strong> — one cell per Unity
                6+ release, colored by net-fix score (
                <code>fixes − known_issues</code>) with a mobile-blocker
                dot. Reads like a stock chart.
              </li>
              <li>
                <strong>Best &amp; worst Build scores</strong> — top-5 and
                bottom-5 releases by composite score.
              </li>
              <li>
                <strong>Known-issues per release, by branch</strong> — one
                line per minor_line; lets you see whether a branch is
                converging.
              </li>
              <li>
                <strong>Breaking-change heatmap by domain</strong> — rows
                are curated subsystems (Rendering, Scripting, Mobile, XR,
                …), columns are recent versions. Cells link into the
                lane-filtered release page.
              </li>
              <li>
                <strong>Issue lifespan — introduced → fixed</strong> —
                horizontal bars for the 30 longest-living UUM issues.
              </li>
              <li>
                <strong>Package drift between editor releases</strong> —
                chronological log showing only the curated packages whose
                version changed between consecutive editor releases.
                Empty entries indicate &ldquo;no curated package changes
                from prior editor.&rdquo;
              </li>
              <li>
                <strong>Patch cadence</strong> — dot plot per release
                stream over the last 18 months.
              </li>
            </ul>
            <p>
              The domain filter chips at the top pin every chart to one
              subsystem; the Top-10 facts panel on the side surfaces
              dynamic SQL-driven highlights (longest-open blocker,
              fastest fix turnaround, biggest breaking patch, etc.). The
              trust rail at the bottom names every formula and the last
              ingestion timestamps.
            </p>
          </>
        )
      },
      {
        id: "page-issues-index",
        question: "What is the Issue Explorer (/issues)?",
        answer: (
          <>
            <p>
              The landing page for everything UUM-id-shaped. Five
              sections, top to bottom:
            </p>
            <ul>
              <li>
                <strong>Stat cards</strong> — total tracked issues,
                currently open, fixed in the last 30 days, regressed
                (Unity shipped a fix and re-listed). Each card prints
                its own formula in muted text.
              </li>
              <li>
                <strong>Newest issues</strong> — top 10 by first
                Known-Issues mention date. What Unity has flagged most
                recently, regardless of whether a fix has shipped yet.
              </li>
              <li>
                <strong>Longest-open issues</strong> — top 10 by days-
                since-first-known-mention with no Fix mention (or whose
                latest Known is newer than the latest Fix). Sorted to
                surface the bugs Unity hasn&apos;t closed out.
              </li>
              <li>
                <strong>Issues by domain × status heatmap</strong> — 13
                curated subsystems × {"{open, fixed}"}, intensity = count.
                Answers &ldquo;where do unresolved issues cluster?&rdquo;
                in one glance.
              </li>
              <li>
                <strong>Most-mentioned issues</strong> — top 10 by
                distinct-release mention count. Surfaces UUM ids Unity
                kept re-listing across patches (regression treadmills
                and long-running known issues).
              </li>
            </ul>
            <p>
              Every issue id and version pill is hover-rich and links
              into the per-issue detail page (<a href="/issues/UUM-22444">
              /issues/[issueId]</a>) for the full mention history.
            </p>
          </>
        )
      },
      {
        id: "page-explorer",
        question: "What is Search Notes (/explorer)?",
        answer: (
          <>
            Free-form faceted search across every indexed release-note row.
            Filter by full-text query, version, minor line, stream, section,
            area, platform, impact, risk, package, or issue ID. Returns
            grouped-by-version results. This is the right page when you have a
            specific symptom or term in mind and don&apos;t care which release
            window it falls into.
          </>
        )
      },
      {
        id: "page-packages",
        question: "What does Packages show?",
        answer: (
          <>
            Sortable table of every tracked official Unity package (Input
            System, Addressables, URP, HDRP, Cinemachine, Burst, and the rest
            of the curated allowlist). Each row links to the package detail
            page, which lists every indexed version with publish date and
            Unity-version compatibility range.
          </>
        )
      },
      {
        id: "page-resources",
        question: "What does Resources show?",
        answer: (
          <>
            Mirror of <code>unity.com/resources</code> - whitepapers, e-books,
            case studies, video sessions. The chip row at the top filters by
            resource type. Secondary to release intelligence; included because
            the resources index is otherwise easy to lose track of and some of
            the documents are useful for upgrade planning.
          </>
        )
      },
      {
        id: "page-issues",
        question: "What does /issues/[issueId] show?",
        answer: (
          <>
            <p>
              Every release-note that mentions a given Unity issue ID (e.g.{" "}
              <a href="/issues/UUM-113215">/issues/UUM-113215</a>) along with
              the derived status chip (Open / Fixed / Regressed). When the
              issue has mentions across multiple Unity majors, a chip row lets
              you scope the table by major - picking <em>Unity 2022 LTS</em>{" "}
              hides 6000.x mentions and re-derives the status from just the
              2022.3 entries. That&apos;s how a user on 2022.3 sees
              &ldquo;known issue&rdquo; while a user on Unity 6 sees
              &ldquo;fixed&rdquo; for the same underlying ID.
            </p>
            <p>
              The Open on Unity Issue Tracker link goes to Unity&apos;s own
              tracker, which is the source of truth - the status chip is just
              what the locally indexed release notes imply.
            </p>
          </>
        )
      },
      {
        id: "page-news",
        question: "What does News show?",
        answer: (
          <>
            Mirror of <code>unity.com/blog/rss</code>. Secondary to release
            intelligence and not classified into lanes - mostly here so a
            search across the site can find a relevant blog post about
            something the release notes don&apos;t fully explain.
          </>
        )
      },
      {
        id: "page-discussions",
        question: "What does Staff Discussions show?",
        answer: (
          <>
            <p>
              Posts written by Unity staff on{" "}
              <code>discussions.unity.com</code> - the official Discourse
              forum. Only accounts in Unity&apos;s <code>unity_staff</code>{" "}
              group are tracked, so it&apos;s a low-noise view of what Unity
              employees are actually saying, without the surrounding community
              threads.
            </p>
            <p>
              By default the page shows <strong>staff-started topics</strong>{" "}
              (the first post of a thread) - product announcements, beta
              programmes, and release posts. Tick{" "}
              <strong>Include replies</strong> to also surface staff replies
              left inside other people&apos;s threads. You can further filter by
              search, category, and author, and sort by recent activity,
              newest, most replies, or recently edited.
            </p>
            <p>
              Each post&apos;s edit history is kept, so a post that staff later
              changed is flagged <strong>Edited</strong>. Titles link straight
              to the thread on Unity&apos;s forum.
            </p>
          </>
        )
      }
    ]
  },
  {
    id: "scope",
    title: "Cross-scope behaviour",
    items: [
      {
        id: "issue-status-by-view",
        question:
          "Why does the same issue look 'open' on one page and 'fixed' on another?",
        answer: (
          <>
            <p>
              Issue-status chips are scoped to the major lines visible in the
              current view. The same underlying issue can correctly read
              differently across pages:
            </p>
            <ul>
              <li>
                On <a href="/">Upgrade Intelligence</a>, the status reflects
                only the majors covered by your <code>from</code> →{" "}
                <code>to</code> range. A 2019.4.40f1 → 2022.3.50f1 diff won&apos;t
                tag an issue as <em>fixed in 6000.3.0b1</em>, because the user
                can&apos;t reach the Unity 6 fix without a separate major
                upgrade.
              </li>
              <li>
                On <a href="/explorer">Search Notes</a>, the status reflects
                whichever majors are present in the current result set. Filter
                to <code>minorLine=2022.3</code> and a 6000.x fix likewise gets
                dropped from the derivation.
              </li>
              <li>
                On <a href="/issues/UUM-113215">/issues/[issueId]</a>, the
                default is &ldquo;All majors&rdquo; (the global status). Pick a
                major chip to re-scope.
              </li>
              <li>
                On a single-release page (<code>/releases/[version]</code>),
                the status is global. You&apos;re looking at one specific
                release; the chip just tells you whether Unity has shipped a
                fix anywhere in the indexed history.
              </li>
            </ul>
            <p>
              The behaviour is intentional - a 6000.3 fix that won&apos;t
              backport to 2019/2020/2021/2022 LTS isn&apos;t a fix for a user
              on legacy LTS, and it would be misleading to display it as one.
            </p>
          </>
        )
      },
      {
        id: "package-boundary",
        question:
          "Why does the package lane sometimes show what looks like a downgrade?",
        answer: (
          <>
            Package-lane &ldquo;From&rdquo; / &ldquo;To&rdquo; values are
            constrained to package versions declared compatible with the
            corresponding editor minor line (via the registry&apos;s{" "}
            <code>unity</code> field). On a cross-major diff like 2022.3 →
            6000.3 that means each boundary picks the latest package version
            its editor side actually supports - which is occasionally a
            lower-numbered version on one side than the other because Unity
            maintains separate package branches per LTS line (cinemachine 2.x
            for 2022, 3.x for Unity 6, both still getting maintenance patches).
            It looks like a downgrade in version numbers but represents a
            forward move along distinct package families.
          </>
        )
      }
    ]
  },
  {
    id: "filters",
    title: "Filters & views",
    items: [
      {
        id: "regressions",
        question: "What does “Regressions only” in the filter mean?",
        answer: (
          <>
            Filters the visible rows down to issues whose ID first appears in
            the current range (<code>/compare</code>) or in this exact release
            (<code>/releases/[version]</code>). Carry-forward issues - known
            problems that existed before this window - get hidden. The boundary
            comes from the earliest <code>release_date</code> in scope; the SQL
            asks &ldquo;does this issue ID appear in any older release?&rdquo;
            and drops it if so.
          </>
        )
      },
      {
        id: "manifest",
        question: "What does “Affects my team” do?",
        answer: (
          <>
            Set your project&apos;s package list once via the sidebar (paste
            your <code>manifest.json</code> or just a comma-separated list).
            Toggling &ldquo;Affects my team&rdquo; intersects every visible
            row&apos;s <code>package_names</code> with your list, so HDRP notes
            vanish if you don&apos;t use HDRP. The list lives in a per-browser
            cookie, never sent anywhere except in the SQL <code>WHERE</code>{" "}
            clause.
          </>
        )
      },
      {
        id: "presets",
        question: "What are persona presets and saved presets?",
        answer: (
          <>
            <p>
              <strong>Persona presets</strong> (Director / Balanced / Indie)
              are three preconfigured filter combos. Picking one stamps a
              sensible starting filter set; you can then adjust freely from
              there. Tracked in a per-view cookie so it sticks across
              sessions.
            </p>
            <p>
              <strong>Saved presets</strong> are user-named filter combos -
              think &ldquo;Switch cert prep&rdquo; or &ldquo;URP only&rdquo;.
              Save the current filter state under a name; clicking the chip
              re-applies it later. Capped at 10 per view, stored in a
              per-browser cookie. Nothing leaves your machine.
            </p>
          </>
        )
      },
      {
        id: "release-button",
        question:
          "The Editor Releases page filters default to 6.3 LTS and 6.0 LTS - how do I see beta or alpha?",
        answer: (
          <>
            The pill row at the top has Supported, Beta, and Alpha checkboxes.
            Tick whichever streams you want - the URL updates to{" "}
            <code>?stream=…</code> so you can paste the filtered view to a
            teammate.
          </>
        )
      },
      {
        id: "urls",
        question: "Can I share a filtered view as a link?",
        answer: (
          <>
            Yes - every filter is encoded in the URL. The whole URL is
            shareable, bookmarkable, and round-trips back into the drawer
            state.
          </>
        )
      }
    ]
  },
  {
    id: "llms",
    title: "Use with an LLM",
    items: [
      {
        id: "llm-endpoint",
        question: "How do I point Claude / ChatGPT / Gemini at this site?",
        answer: (
          <>
            <p>
              Hand the LLM a URL of the form{" "}
              <code>https://unityreleases.com/compare.md?from=&lt;from&gt;&amp;to=&lt;to&gt;</code>
              {" "}- for example{" "}
              <a href="/compare.md?from=6000.0.50f1&to=6000.0.74f1">
                /compare.md?from=6000.0.50f1&amp;to=6000.0.74f1
              </a>
              . The endpoint returns the full upgrade diff as
              {" "}<code>text/markdown</code>, bucketed into the same lanes you
              see on screen, with issue-tracker links and status suffixes on
              every issue ID. Every per-release bullet carries the release date
              inline -{" "}
              <code>
                - **6000.0.74f1** (2026-04-29) Fixed editor crash on launch
              </code>{" "}
              - so the LLM has chronology without a second lookup. Any tool
              that can fetch a URL - Claude&apos;s WebFetch, ChatGPT browsing,{" "}
              <code>curl</code>, an MCP server - can ingest it directly. No
              auth, no rate-limit games.
            </p>
            <p>
              Optional: append <code>&amp;stream=beta</code> (repeatable) to
              widen the in-between releases beyond LTS. Cross-major diffs
              (2022.3.x → 6000.x) are supported. See{" "}
              <a href="/llms.txt">/llms.txt</a> for the full LLM-facing
              manifest of this site.
            </p>
          </>
        )
      },
      {
        id: "llm-button",
        question: "What does the Markdown export button download?",
        answer: (
          <>
            The same body the <code>/compare.md</code> endpoint serves -
            a complete, lane-bucketed diff between the two versions, not
            just the rows currently visible on the page. Filenames follow
            the pattern <code>unity-&lt;from&gt;-to-&lt;to&gt;-upgrade.md</code>
            so they sort sensibly when you keep a folder of them.
          </>
        )
      }
    ]
  },
  {
    id: "contact",
    title: "Help & contact",
    items: [
      {
        id: "bug",
        question: "Found a bug or missing data?",
        answer: (
          <>
            Reach out at{" "}
            <a href="mailto:elbert@mechaghost.com">elbert@mechaghost.com</a>.
          </>
        )
      }
    ]
  }
];

export default function FaqPage() {
  return (
    <>
      <section className="page-header">
        <h1>FAQ</h1>
        <p>How Unity Releases gets its data, how the views are wired together, and what they mean.</p>
      </section>

      <nav className="faq-toc" aria-label="On this page">
        {SECTIONS.map((section) => (
          <a key={section.id} href={`#${section.id}`} className="faq-toc__link">
            {section.title}
          </a>
        ))}
      </nav>

      <div className="faq">
        {SECTIONS.map((section) => (
          <section key={section.id} id={section.id} className="faq-section">
            <header className="faq-section__header">
              <h2 className="faq-section__title">
                <a href={`#${section.id}`}>{section.title}</a>
              </h2>
              <span className="faq-section__count tabnums">{section.items.length}</span>
            </header>
            <div className="faq-section__body">
              {section.items.map((qa) => (
                <article key={qa.id} id={qa.id} className="faq-item">
                  <h3 className="faq-item__question">
                    <a href={`#${qa.id}`}>{qa.question}</a>
                  </h3>
                  <div className="faq-item__answer">{qa.answer}</div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
