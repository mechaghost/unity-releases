---
name: ship-release
description: >-
  Ship a change to production on the unity-releases repo and verify it live.
  Use when deploying, promoting main to the release branch, running
  scripts/release.sh, or confirming a deploy landed. Covers pre-flight checks,
  the Railway release/boot flow, detecting the new build, and the required
  post-deploy endpoint probe.
---

# Shipping a change to production (unity-releases)

Railway serves the **web** service from the `release` branch and runs ingestion
from a **cron** service. `main` is the working branch; `release` is the deploy
gate. Production site: `https://unityreleases.com`.

## 1. Pre-flight (always, before shipping)

```bash
npm run typecheck
npm test
DATABASE_URL='postgres://u:u@localhost:5432/none' npm run build
```

The dummy `DATABASE_URL` is fine — pages are `force-dynamic`, so the build does
not connect to a DB. All three must pass.

## 2. Land on `main`, then promote to `release`

Commit the change to `main` (directly, or via a squash-merged PR — match the
current task's branch instructions). Then:

```bash
scripts/release.sh            # fast-forward release -> main; Railway redeploys
scripts/release.sh --force    # only if release diverged (e.g. a re-trigger commit)
```

Schema is **auto-applied on every deploy** — `railway.json`'s start command is
`scripts/boot.sh`, which runs `npm run db:migrate` (idempotent
`CREATE … IF NOT EXISTS`) before booting. So additive schema needs **no manual
migrate**. The app degrades gracefully when a new table is still empty.

## 3. Wait for the new build, then verify (HARD REQUIREMENT)

The previous build keeps serving until the new one is up (~80–120s). **Do not
assume it's live** — detect it with a marker unique to your change:

- a new CSS class in the `/_next/static/css/<hash>.css` bundle,
- a new field in an API response (`/api/packages/<name>/versions`),
- or new visible text on the page.

Poll for the marker (background `for` loop, ~20s interval), then probe — this is
required by CLAUDE.md, never skip it:

```bash
for p in / /stats /releases /api/health; do
  echo "$p -> $(curl -s -o /dev/null -w '%{http_code}' -m 20 https://unityreleases.com$p)"
done
# /api/health must be overall "ok" with no stale sources
```

Also probe the specific page/endpoint you changed. Any 5xx → diagnose and fix in
the same session (common causes: Edge runtime pulling Node-only deps; a server-
only module imported into a client component; an un-migrated schema change —
though boot.sh covers additive ones).

## 4. If a deploy seems stuck

If the marker hasn't appeared after ~5 min (vs. the usual ~2), the deploy was
likely **missed/queued**, not failed. Re-trigger with a no-op commit to
`release`:

```bash
git checkout -q --detach origin/release
git commit --allow-empty -m "chore: re-trigger Railway deploy"
git push origin HEAD:release
git checkout -q -   # back to your branch
```

Re-sync later with `scripts/release.sh --force`. If it still won't deploy after a
re-trigger, the build is genuinely failing — that needs the Railway deploy log
(not visible from this environment; ask the user).

## 5. Data vs. code

A new table or cron job ships with the deploy but **populates on the next
twice-daily cron** (`npm run ingest:all`, 00:00 + 12:00 UTC), not at deploy time.
Tell the user when a feature's data only appears after the cron runs.
