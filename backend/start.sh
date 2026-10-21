#!/usr/bin/env bash
# Starts the engine on 127.0.0.1:8001 (not reachable from outside the container), then the API on $PORT.
# If either one stops, the container stops too, so the host restarts the whole thing.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)" # backend/

# A private key between the two, made fresh at each start unless one is set
export ML_TOKEN="${ML_TOKEN:-$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')}"
export ML_URL="http://127.0.0.1:8001"

# `exec` so $! is the program itself, not a subshell around it (otherwise a stop signal would miss it)
(cd "$HERE/ml" && exec .venv/bin/uvicorn app.service:app --host 127.0.0.1 --port 8001 --workers 1 --log-level warning) &
ML=$!
(cd "$HERE/api" && exec node src/index.ts) &
API=$!

# The host stops the container with SIGTERM: pass it on so the API closes its database connections cleanly
trap 'kill -TERM "$API" "$ML" 2>/dev/null; wait' TERM INT
wait -n "$API" "$ML"
code=$?
kill -TERM "$API" "$ML" 2>/dev/null
wait
exit "$code"
