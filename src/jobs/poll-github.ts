import type { PoolClient } from "pg";
import { getPool } from "../lib/db/client";
import {
  createIngestionRun,
  finishIngestionRun,
  upsertGithubRepo,
  upsertGithubEvent,
  updateRepoLatestCommit
} from "../lib/db/repositories";
import {
  GITHUB_ORG,
  githubGetAll,
  parseRepo,
  parseEvent,
  fetchLatestCommit
} from "../lib/ingest/github";

/**
 * Ingest the Unity-Technologies public GitHub org: every repo (metadata,
 * stars, topics) and the recent public activity feed (releases, pushes,
 * new repos). Uses GITHUB_TOKEN when set (5000 req/hr) or unauthenticated
 * (60 req/hr) otherwise. Runs inside the mega-cron.
 *
 * The ingestion_runs row is committed up-front and finished in a separate
 * transaction so a failed run (e.g. rate-limited) still surfaces in
 * /api/health rather than vanishing on rollback.
 */

// Unity-Technologies has well over 500 public repos (incl. archived +
// forks), so cap high enough to ingest the whole org, not just the first
// few pages. ~1000 repos at 100/page = 10 requests, trivial with a token.
const MAX_REPO_PAGES = Number(process.env.GITHUB_MAX_REPO_PAGES ?? 12);
const MAX_EVENT_PAGES = Number(process.env.GITHUB_MAX_EVENT_PAGES ?? 3);
// How many of the most-recently-pushed repos to fetch a latest commit for
// (one extra API call each). Covers the first few pages of the default view.
const MAX_COMMIT_REPOS = Number(process.env.GITHUB_MAX_COMMIT_REPOS ?? 90);

async function inTx<T>(handler: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await handler(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.warn("[github] GITHUB_TOKEN not set — using the unauthenticated GitHub API (60 req/hr, shared IP).");
  }

  const runId = await inTx((c) => createIngestionRun(c, "github", "poll-github"));
  const summary = {
    reposSeen: 0,
    reposInserted: 0,
    reposUpdated: 0,
    commitsFetched: 0,
    eventsSeen: 0,
    eventsInserted: 0,
    rateRemaining: null as number | null
  };

  try {
    // Repositories — the dataset behind New / Popular / Notable / index.
    const repos = await githubGetAll(`/orgs/${GITHUB_ORG}/repos`, { token, maxPages: MAX_REPO_PAGES });
    summary.rateRemaining = repos.rate.remaining;
    const parsedRepos = repos.items
      .map(parseRepo)
      .filter((r) => r.githubRepoId);
    await inTx(async (client) => {
      for (const parsed of parsedRepos) {
        summary.reposSeen += 1;
        const outcome = await upsertGithubRepo(client, parsed, runId, null);
        if (outcome === "inserted") summary.reposInserted += 1;
        else summary.reposUpdated += 1;
      }
    });

    // Latest commit per repo for the most-recently-pushed ones (the org
    // events feed doesn't carry commit messages). Bounded so it stays a
    // small number of extra calls; the default card view shows these.
    const recent = [...parsedRepos]
      .filter((r) => r.repoPushedAt && !r.isFork)
      .sort((a, b) => (b.repoPushedAt ?? "").localeCompare(a.repoPushedAt ?? ""))
      .slice(0, MAX_COMMIT_REPOS);
    for (const r of recent) {
      const commit = await fetchLatestCommit(r.fullName, token);
      if (commit) {
        await inTx((client) => updateRepoLatestCommit(client, r.githubRepoId, commit));
        summary.commitsFetched += 1;
      }
    }

    // Public activity feed — the "latest updates" section.
    const events = await githubGetAll(`/orgs/${GITHUB_ORG}/events`, { token, maxPages: MAX_EVENT_PAGES });
    summary.rateRemaining = events.rate.remaining ?? summary.rateRemaining;
    await inTx(async (client) => {
      for (const raw of events.items) {
        const ev = parseEvent(raw);
        if (!ev) continue;
        summary.eventsSeen += 1;
        if (await upsertGithubEvent(client, ev, runId)) summary.eventsInserted += 1;
      }
    });

    await inTx((c) =>
      finishIngestionRun(c, runId, "success", {
        sourceCount: 2,
        recordsCreated: summary.reposInserted + summary.eventsInserted,
        recordsUpdated: summary.reposUpdated
      })
    );
    console.log("[github] done", JSON.stringify(summary));
  } catch (error) {
    await inTx((c) =>
      finishIngestionRun(c, runId, "failed", {
        errorMessage: error instanceof Error ? error.message : "Unknown error"
      })
    ).catch(() => undefined);
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
