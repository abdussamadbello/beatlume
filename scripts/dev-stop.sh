#!/usr/bin/env bash
# Stops BeatLume dev processes. Invoked from `make dev-stop` so pkill patterns are not
# substrings of the same shell's argv (which would self-match under pkill -f).
set -euo pipefail
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

echo "Stopping Celery, then backend :${BACKEND_PORT} and frontend :${FRONTEND_PORT}..."

pkill -f 'celery -A app.tasks.celery_app worker' 2>/dev/null || true
pkill -f 'celery -A app.tasks.celery_app beat' 2>/dev/null || true

if command -v lsof >/dev/null 2>&1; then
  lsof -ti:"${BACKEND_PORT}" | xargs -r kill 2>/dev/null || true
  lsof -ti:"${FRONTEND_PORT}" | xargs -r kill 2>/dev/null || true
elif command -v fuser >/dev/null 2>&1; then
  fuser -k "${BACKEND_PORT}"/tcp 2>/dev/null || true
  fuser -k "${FRONTEND_PORT}"/tcp 2>/dev/null || true
else
  echo "Warning: neither lsof nor fuser found; Celery stopped but ports may still be in use." >&2
fi

echo "Done."
