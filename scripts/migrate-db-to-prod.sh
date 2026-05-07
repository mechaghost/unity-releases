#!/usr/bin/env bash
#
# One-shot migration of the local Postgres dev database into a target
# (typically a fresh Railway Postgres instance).
#
# Why a script: Unity Releases is a read-mostly app. The dev DB built
# from `npm run ingest:*` is canonical and large enough that re-running
# all ingest jobs against an empty Railway DB would take much longer
# than just shipping a snapshot.
#
# Usage:
#   scripts/migrate-db-to-prod.sh "$RAILWAY_DATABASE_URL"
#
# Or with a flag:
#   scripts/migrate-db-to-prod.sh --target "$RAILWAY_DATABASE_URL"
#
# Optional flags:
#   --dry-run                 only print what would be dumped, don't apply
#   --container <name>        local docker container name (default: unity-alerts-postgres)
#   --source-db <name>        local DB name (default: unity_alerts)
#   --source-user <name>      local DB user (default: unity)
#
# Requirements:
#   - Local postgres running in docker (the dev container)
#   - psql installed on the host (brew install libpq, or Postgres.app)
#   - The target URL points to an EMPTY database — the dump uses
#     --clean --if-exists, so any existing tables under the same names
#     will be dropped first.

set -euo pipefail

CONTAINER="unity-alerts-postgres"
SRC_DB="unity_alerts"
SRC_USER="unity"
TARGET_URL=""
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)      TARGET_URL="$2"; shift 2 ;;
    --container)   CONTAINER="$2"; shift 2 ;;
    --source-db)   SRC_DB="$2"; shift 2 ;;
    --source-user) SRC_USER="$2"; shift 2 ;;
    --dry-run)     DRY_RUN=1; shift ;;
    -h|--help)
      sed -n '2,30p' "$0"; exit 0 ;;
    *)
      if [[ -z "$TARGET_URL" ]]; then
        TARGET_URL="$1"
      else
        echo "unknown arg: $1" >&2; exit 1
      fi
      shift ;;
  esac
done

if [[ -z "$TARGET_URL" ]]; then
  echo "usage: $0 [--target] <RAILWAY_DATABASE_URL>" >&2
  exit 1
fi

if [[ "$DRY_RUN" -ne 1 ]]; then
  if ! command -v psql >/dev/null 2>&1; then
    echo "error: psql not on PATH. Install with: brew install libpq && brew link --force libpq" >&2
    exit 1
  fi
  if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
    echo "error: docker container '$CONTAINER' is not running. Start it first:" >&2
    echo "  docker start $CONTAINER" >&2
    exit 1
  fi
fi

# Mask the password in user-facing output, but leave the URL itself in
# the connection so psql can use it.
masked_target() {
  echo "$TARGET_URL" | sed -E 's#(://[^:]+:)[^@]+#\1*****#'
}

echo "Source: docker:$CONTAINER → $SRC_DB (user $SRC_USER)"
echo "Target: $(masked_target)"
echo

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "[dry-run] Would run:"
  echo "  docker exec $CONTAINER pg_dump -U $SRC_USER $SRC_DB \\"
  echo "    --clean --if-exists --no-owner --no-privileges \\"
  echo "    | psql \"$(masked_target)\""
  exit 0
fi

read -r -p "This will DROP and replace existing tables on the target. Continue? [y/N] " confirm
if [[ "${confirm,,}" != "y" && "${confirm,,}" != "yes" ]]; then
  echo "aborted"
  exit 1
fi

echo
echo "Streaming dump → psql…"
docker exec "$CONTAINER" pg_dump \
  -U "$SRC_USER" "$SRC_DB" \
  --clean --if-exists --no-owner --no-privileges \
  | psql "$TARGET_URL" -v ON_ERROR_STOP=1 -X --quiet

echo
echo "Verifying target row counts…"
psql "$TARGET_URL" -X -t -c "
  SELECT 'unity_releases:    ' || COUNT(*) FROM unity_releases UNION ALL
  SELECT 'release_note_items:' || COUNT(*) FROM release_note_items UNION ALL
  SELECT 'packages:          ' || COUNT(*) FROM packages UNION ALL
  SELECT 'package_versions:  ' || COUNT(*) FROM package_versions UNION ALL
  SELECT 'blog_posts:        ' || COUNT(*) FROM blog_posts UNION ALL
  SELECT 'content_events:    ' || COUNT(*) FROM content_events;
" | sed 's/^/  /'

echo
echo "✓ Migration complete."
