/**
 * The "Which Unity versions are tracked?" FAQ answer, rendered from the
 * database rather than a hand-written list.
 *
 * The previous static copy named `6000.0` and `6000.3` as the LTS lines and
 * had already gone stale - Unity announced `6000.7` and nothing prompted an
 * edit. Reading the real minor lines means the answer follows ingestion,
 * including across a generation boundary: Unity 7 lines appear under their own
 * heading as soon as they're ingested.
 *
 * Async server component, so the surrounding FAQ tree stays a plain static
 * array. A DB failure degrades to generation-neutral prose instead of a 500 -
 * the FAQ carries the not-affiliated disclaimer and must always render.
 */

import { getTrackedVersionLines } from "@/lib/db/repositories";
import { groupTrackedLines, type TrackedGeneration } from "@/lib/tracked-versions";

async function safeTrackedGenerations(): Promise<TrackedGeneration[]> {
  try {
    return groupTrackedLines(await getTrackedVersionLines());
  } catch {
    return [];
  }
}

function LineList({ lines }: { lines: TrackedGeneration["lines"] }) {
  return (
    <>
      {lines.map((line, index) => (
        <span key={line.minorLine}>
          {index > 0 ? ", " : ""}
          <code>{line.minorLine}</code>
        </span>
      ))}
    </>
  );
}

export async function TrackedVersionsAnswer() {
  const generations = await safeTrackedGenerations();
  const modern = generations.filter((g) => g.isModern);
  const legacy = generations.filter((g) => !g.isModern);

  if (modern.length === 0) {
    return (
      <>
        <p>
          Unity 6 and newer (<code>6000.x</code> and up) is the primary focus.
          LTS minor lines get pinned by default; <strong>Supported</strong>,{" "}
          <strong>Beta</strong>, and <strong>Alpha</strong> chips reveal the
          rest.
        </p>
        <p>
          Legacy LTS lines are also indexed for upgrade planning. Pre-2019 lines
          and non-LTS branches of legacy years (e.g. 2022.1) are not indexed.
        </p>
      </>
    );
  }

  return (
    <>
      <p>
        Unity 6 and newer (<code>6000.x</code> and up) is the primary focus.
        This list is generated from what is actually in the database, so it
        follows Unity rather than a hard-coded list.
      </p>

      {modern.map((generation) => {
        const lts = generation.lines.filter((line) => line.isLts);
        const supported = generation.lines.filter(
          (line) => !line.isLts && line.stream === "Update/Supported"
        );
        const prerelease = generation.lines.filter(
          (line) => !line.isLts && line.stream !== "Update/Supported"
        );
        return (
          <p key={generation.major}>
            <strong>{generation.label}</strong>
            {lts.length > 0 ? (
              <>
                {" "}— LTS: <LineList lines={lts} />
              </>
            ) : null}
            {supported.length > 0 ? (
              <>
                {lts.length > 0 ? "; " : " — "}Supported:{" "}
                <LineList lines={supported} />
              </>
            ) : null}
            {prerelease.length > 0 ? (
              <>
                {lts.length > 0 || supported.length > 0 ? "; " : " — "}
                pre-release only: <LineList lines={prerelease} />
              </>
            ) : null}
            .
          </p>
        );
      })}

      <p>
        LTS lines get pinned by default; the <strong>Supported</strong>,{" "}
        <strong>Beta</strong>, and <strong>Alpha</strong> chips reveal the rest.
      </p>

      {legacy.length > 0 ? (
        <p>
          Legacy LTS lines are also indexed for upgrade planning:{" "}
          {legacy.map((generation, index) => (
            <span key={generation.major}>
              {index > 0 ? ", " : ""}
              <LineList lines={generation.lines} />
            </span>
          ))}
          . They appear on <a href="/releases">Editor Releases</a> when their
          chip is ticked, and they can be diffed against each other or against
          Unity 6 — picking a 2022.3.x → 6000.x diff is fine if you&apos;re
          evaluating the jump. Lane contents on cross-major diffs mix release
          notes from two independent product lines, so expect noisier output
          than a within-major diff.
        </p>
      ) : null}

      <p>
        Pre-2019 lines and non-LTS branches of legacy years (e.g. 2022.1) are
        not indexed.
      </p>
    </>
  );
}
