#!/usr/bin/env sh
#
# Web-service boot wrapper for Railway.
#
# Apply additive, idempotent migrations before serving the new code. A failed
# migration must fail deployment rather than expose partially working pages.
# Railway keeps the previous healthy deployment while this candidate fails.
#
set -u

echo "[boot] applying database schema (idempotent)…"
if npm run db:migrate; then
  echo "[boot] schema applied"
else
  echo "[boot] ERROR: db:migrate failed; refusing to start incompatible code" >&2
  exit 1
fi

# exec the Next.js binary directly (not via `npm run start`) so Node
# becomes PID 1 and receives Railway's SIGTERM itself — it then drains
# connections and exits 0. Going through npm leaves npm as PID 1, which
# doesn't forward the signal cleanly and logs noisy "npm error signal
# SIGTERM / command failed" lines on every shutdown.
exec node_modules/.bin/next start
