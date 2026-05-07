export const metadata = {
  title: "FAQ — Unity Releases",
  description:
    "Where Unity Releases data comes from, how often it updates, what the impact lanes and risk levels mean, and the standard not-affiliated-with-Unity disclaimer."
};

export default function FaqPage() {
  return (
    <>
      <section className="page-header">
        <h1>FAQ</h1>
        <p>How Unity Releases gets its data, how the views are wired together, and what they mean.</p>
      </section>

      <article className="faq">
        <Question id="not-affiliated">Is this an official Unity site?</Question>
        <Answer>
          <strong>No.</strong> Unity Releases is an independent project,
          not affiliated with, endorsed by, or sponsored by{" "}
          <a href="https://unity.com" target="_blank" rel="noopener noreferrer">
            Unity Technologies
          </a>
          . &ldquo;Unity&rdquo; and the Unity logo are trademarks of Unity
          Technologies. This site only ingests and surfaces information that
          Unity already publishes publicly. For anything authoritative —
          licensing, support, official roadmaps — go to{" "}
          <a href="https://unity.com" target="_blank" rel="noopener noreferrer">
            unity.com
          </a>
          .
        </Answer>

        <Question id="sources">Where does the data come from?</Question>
        <Answer>
          Three public Unity sources, all polled on a schedule:
          <ul>
            <li>
              <strong>Editor releases:</strong> the three landing pages at{" "}
              <code>unity.com/releases/editor/{"{latest,beta,alpha}"}</code>{" "}
              and the markdown release-notes file each one links to. We follow
              the redirect to the actual version page (e.g. <code>whats-new/6000.3.14f1</code>)
              and parse the release notes into individual line items —
              version, area, platform tags, impact, risk, issue IDs, package
              names.
            </li>
            <li>
              <strong>Packages:</strong> for each tracked official package, we
              hit <code>packages.unity.com/{"<name>"}</code> (the npm-style
              registry endpoint) and ingest its full version history,
              dist-tags, and Unity-version compatibility ranges. The list of
              packages is hand-curated in{" "}
              <code>src/lib/ingest/unity-packages.ts</code> because Unity
              doesn&apos;t publish a registry-listing endpoint —{" "}
              <code>npm run check:packages</code> finds new ones in release
              notes that aren&apos;t in the list yet.
            </li>
            <li>
              <strong>News:</strong> the official Unity blog RSS feed at{" "}
              <code>unity.com/blog/rss</code>.
            </li>
          </ul>
          Every fetch is recorded in <code>source_snapshots</code> with a
          SHA-256 of the body so re-runs don&apos;t double-count.
        </Answer>

        <Question id="cadence">How often does the data refresh?</Question>
        <Answer>
          <ul>
            <li>Editor releases — every 12 hours.</li>
            <li>Packages — every 12 hours.</li>
            <li>Blog news — daily at 5 AM UTC.</li>
          </ul>
          So on any given day the editor and package data is at most ~12 hours
          stale. Health and last-success timestamps per source are at{" "}
          <a href="/api/health">/api/health</a>.
        </Answer>

        <Question id="lanes">What do the impact lanes mean?</Question>
        <Answer>
          Every release-note row is classified by{" "}
          <code>src/lib/classification.ts</code> into one impact bucket:
          <ul>
            <li>
              <strong>Active known blockers</strong> — known issues with risk
              level <em>blocker</em>, i.e. things Unity itself flagged as
              shipping-stoppers.
            </li>
            <li>
              <strong>Other known issues</strong> — known issues that aren&apos;t
              blockers (caution / review level).
            </li>
            <li>
              <strong>Breaking changes</strong> — anything Unity calls a
              breaking change or that the parser detects as one (deny-listed
              terms in the body).
            </li>
            <li>
              <strong>API changes</strong> — public scripting API surface
              changed (signature, rename, removal, new namespace).
            </li>
            <li>
              <strong>Security &amp; install impact</strong> — security fixes
              and install/platform risks combined.
            </li>
            <li>
              <strong>Package updates</strong> — note pertains to a Unity
              package version bump.
            </li>
            <li>
              <strong>Features / Improvements / Fixes / Other changes</strong>{" "}
              — straightforward.
            </li>
          </ul>
          The classifier is regex- and keyword-driven, not perfect. If a row
          looks miscategorized, it usually means Unity used unfamiliar phrasing
          for that area.
        </Answer>

        <Question id="risk">What do the risk levels mean?</Question>
        <Answer>
          A second axis on top of impact:
          <ul>
            <li>
              <strong>Blocker</strong> — Unity-flagged as a shipping-stopper,
              or the parser detected blocker keywords (crash, data loss,
              certification-blocking).
            </li>
            <li>
              <strong>Caution</strong> — meaningful regression, some
              platforms broken, install-time issue.
            </li>
            <li>
              <strong>Review</strong> — needs a human eyeball: API surface
              changed, package versioning shifted, build pipeline twitched.
            </li>
            <li>
              <strong>Info</strong> — the rest.
            </li>
          </ul>
          The risk axis is independent of the lane axis — a row in the Fixes
          lane can still be Caution if the underlying problem was bad.
        </Answer>

        <Question id="regressions">
          What does &ldquo;Regressions only&rdquo; in the filter mean?
        </Question>
        <Answer>
          Filters the visible rows down to issues whose ID first appears in
          the current range (<code>/compare</code>) or in this exact release
          (<code>/releases/[version]</code>). Carry-forward issues — known
          problems that existed before this window — get hidden. The boundary
          comes from the earliest <code>release_date</code> in scope; the SQL
          asks &ldquo;does this issue ID appear in any older release?&rdquo;
          and drops it if so.
        </Answer>

        <Question id="manifest">
          What does &ldquo;Affects my team&rdquo; do?
        </Question>
        <Answer>
          Set your project&apos;s package list once via the sidebar (paste
          your <code>manifest.json</code> or just a comma-separated list).
          Toggling &ldquo;Affects my team&rdquo; intersects every visible
          row&apos;s <code>package_names</code> with your list, so HDRP
          notes vanish if you don&apos;t use HDRP. The list lives in a
          per-browser cookie, never sent anywhere except in the SQL
          <code>WHERE</code> clause.
        </Answer>

        <Question id="presets">
          What are persona presets and saved presets?
        </Question>
        <Answer>
          <p>
            <strong>Persona presets</strong> (Director / Balanced / Indie) are
            three preconfigured filter combos. Picking one stamps a sensible
            starting filter set; you can then adjust freely from there.
            Tracked in a per-view cookie so it sticks across sessions.
          </p>
          <p>
            <strong>Saved presets</strong> are user-named filter combos —
            think &ldquo;Switch cert prep&rdquo; or &ldquo;URP only&rdquo;.
            Save the current filter state under a name; clicking the chip
            re-applies it later. Capped at 10 per view, stored in a
            per-browser cookie. Nothing leaves your machine.
          </p>
        </Answer>

        <Question id="versions-tracked">
          Which Unity versions are tracked?
        </Question>
        <Answer>
          Unity 6 only — the <code>6000.x</code> stream. Pre-Unity-6
          versions (the 2019/2020/2021/2022/2023 LTS lines) are out of
          scope.
        </Answer>

        <Question id="release-button">
          The Editor Releases page filters default to 6.3 LTS and 6.0 LTS —
          how do I see beta or alpha?
        </Question>
        <Answer>
          The pill row at the top has Supported, Beta, and Alpha checkboxes.
          Tick whichever streams you want — the URL updates to{" "}
          <code>?stream=…</code> so you can paste the filtered view to a
          teammate.
        </Answer>

        <Question id="urls">
          Can I share a filtered view as a link?
        </Question>
        <Answer>
          Yes — every filter is encoded in the URL. The whole URL is
          shareable, bookmarkable, and round-trips back into the drawer
          state.
        </Answer>

        <Question id="bug">Found a bug or missing data?</Question>
        <Answer>
          Open an issue on the GitHub repo:{" "}
          <a
            href="https://github.com/mechaghost/unity-releases"
            target="_blank"
            rel="noopener noreferrer"
          >
            github.com/mechaghost/unity-releases
          </a>
          .
        </Answer>
      </article>
    </>
  );
}

function Question({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="faq__question">
      <a href={`#${id}`} aria-label={`Link to ${typeof children === "string" ? children : "question"}`}>
        {children}
      </a>
    </h2>
  );
}

function Answer({ children }: { children: React.ReactNode }) {
  return <div className="faq__answer">{children}</div>;
}
