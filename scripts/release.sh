#!/usr/bin/env bash
#
# Promote the current main tip to the release branch so Railway picks it up.
#
# main is the working branch; release is the deploy gate. This script
# does NOT touch your local checkout — it just fetches and pushes
# refs by name, so it's safe to run from any branch (or from a worktree).
#
# Usage:
#   scripts/release.sh                     # fast-forward release to main
#   scripts/release.sh --force             # allow non-fast-forward (rare)
#   scripts/release.sh --dry-run           # show the resolved ref + diff only
#
# Exit codes:
#   0 — release updated (or already up-to-date)
#   1 — push rejected (release diverged from main; use --force after auditing)
#   2 — usage / environment error

set -euo pipefail

REMOTE="origin"
SOURCE_BRANCH="main"
TARGET_BRANCH="release"
FORCE=0
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --force)   FORCE=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help)
      sed -n '2,18p' "$0"; exit 0 ;;
    *)
      echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

echo "Fetching $REMOTE/$SOURCE_BRANCH and $REMOTE/$TARGET_BRANCH…"
git fetch "$REMOTE" "$SOURCE_BRANCH" "$TARGET_BRANCH" 2>&1 | sed 's/^/  /'

SOURCE_SHA=$(git rev-parse "$REMOTE/$SOURCE_BRANCH")
TARGET_SHA=$(git rev-parse "$REMOTE/$TARGET_BRANCH" 2>/dev/null || echo "(none)")

echo
echo "Source ($REMOTE/$SOURCE_BRANCH): $SOURCE_SHA"
echo "Target ($REMOTE/$TARGET_BRANCH): $TARGET_SHA"

if [[ "$SOURCE_SHA" == "$TARGET_SHA" ]]; then
  echo
  echo "✓ release is already at $SOURCE_SHA — nothing to push."
  exit 0
fi

if [[ "$TARGET_SHA" != "(none)" ]]; then
  echo
  echo "Commits release will gain:"
  git log --oneline "$REMOTE/$TARGET_BRANCH..$REMOTE/$SOURCE_BRANCH" | sed 's/^/  /'
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo
  echo "[dry-run] Would run:"
  if [[ "$FORCE" -eq 1 ]]; then
    echo "  git push --force-with-lease=$TARGET_BRANCH:$TARGET_SHA $REMOTE $SOURCE_SHA:refs/heads/$TARGET_BRANCH"
  else
    echo "  git push $REMOTE $SOURCE_SHA:refs/heads/$TARGET_BRANCH"
  fi
  exit 0
fi

PUSH_ARGS=("$REMOTE" "$SOURCE_SHA:refs/heads/$TARGET_BRANCH")
if [[ "$FORCE" -eq 1 ]]; then
  # Lease ensures we only force-push if the remote is exactly where we
  # last saw it — guards against silently overwriting an unexpected commit.
  PUSH_ARGS=(--force-with-lease="$TARGET_BRANCH:$TARGET_SHA" "${PUSH_ARGS[@]}")
fi

echo
echo "Pushing…"
if ! git push "${PUSH_ARGS[@]}" 2>&1 | sed 's/^/  /'; then
  echo
  echo "✗ Push rejected. release likely diverged from main." >&2
  echo "  Audit with:  git log --oneline $REMOTE/$SOURCE_BRANCH..$REMOTE/$TARGET_BRANCH" >&2
  echo "  Then re-run: scripts/release.sh --force" >&2
  exit 1
fi

echo
echo "✓ release is now at $SOURCE_SHA. Railway will redeploy."
