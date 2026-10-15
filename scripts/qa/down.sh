#!/usr/bin/env bash
# Stop the QA stack started by scripts/qa/up.sh (emulators + vite on :5199).
# Emulator data is in memory only, so stopping discards every seeded shop.
set -uo pipefail

STATE="${QA_STATE_DIR:-/tmp/qa}"
mkdir -p "$STATE/run"

exec 9>"$STATE/up.lock"
flock -w 120 9 || { echo "down.sh: could not take $STATE/up.lock" >&2; exit 1; }

stop() { # name
  local name="$1" pidfile="$STATE/run/$1.pid" pid i
  [[ -f "$pidfile" ]] || { echo "[qa] $name: not started by up.sh (no pidfile)"; return 0; }
  pid="$(cat "$pidfile")"
  if ! kill -0 "$pid" 2>/dev/null; then
    echo "[qa] $name: already stopped"
    rm -f "$pidfile"
    return 0
  fi
  # up.sh starts each server with setsid, so its pid is also its process group:
  # signalling the group reaches the emulator's Java child and esbuild too.
  # SIGINT first — firebase-tools shuts its emulators down cleanly on it.
  kill -INT -- "-$pid" 2>/dev/null || kill -INT "$pid" 2>/dev/null
  for ((i = 0; i < 40; i++)); do
    kill -0 "$pid" 2>/dev/null || break
    sleep 0.25
  done
  if kill -0 "$pid" 2>/dev/null; then
    kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null
    sleep 1
    kill -KILL -- "-$pid" 2>/dev/null || true
  fi
  rm -f "$pidfile"
  echo "[qa] $name: stopped"
}

stop vite
stop emulators
