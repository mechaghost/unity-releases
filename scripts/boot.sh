#!/usr/bin/env sh
#
# Web-service boot wrapper for Railway.
#
# THROWAWAY: this exists only to apply the database schema on deploy so
# the `discourse_*` tables (and any future additive schema) land in prod
# without a manual `railway run npm run db:migrate`. The migration is
# idempotent (schema.sql is all `CREATE ... IF NOT EXISTS`), so running it
# on every boot is safe. Once you're confident prod is migrated you can
# revert railway.json's startCommand back to "npm run start" and delete
# this file — nothing else depends on it.
#
# Fails open: a transient DB hiccup during migrate must not crash-loop the
# web service (restartPolicy is ON_FAILURE). The app already degrades to an
# empty state when tables are missing, and the next restart retries this.

set -u

echo "[boot] applying database schema (idempotent)…"
if npm run db:migrate; then
  echo "[boot] schema applied"
else
  echo "[boot] WARN: db:migrate failed; starting server anyway" >&2
fi

# exec the Next.js binary directly (not via `npm run start`) so Node
# becomes PID 1 and receives Railway's SIGTERM itself — it then drains
# connections and exits 0. Going through npm leaves npm as PID 1, which
# doesn't forward the signal cleanly and logs noisy "npm error signal
# SIGTERM / command failed" lines on every shutdown.
exec node_modules/.bin/next start
