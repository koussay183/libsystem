#!/usr/bin/env bash
# Start the local QA stack, idempotently:
#   · Firebase emulators — Auth on 127.0.0.1:9099, Firestore on 127.0.0.1:8080,
#     project "demo-mektebti", the repo's own firestore.rules;
#   · a Vite dev server on http://127.0.0.1:5199 wired to those emulators
#     (VITE_USE_EMULATORS=1 + dummy VITE_FIREBASE_* for demo-mektebti).
#
# Anything already running and healthy is left alone, so this is safe to call
# from every test. Concurrent callers are serialised with flock. Nothing here
# can reach production: "demo-" project ids have no backend, and the app only
# honours VITE_USE_EMULATORS in a dev server (see src/lib/firebase.ts).
#
#   bash scripts/qa/up.sh            # start what is missing, print status
#   bash scripts/qa/down.sh          # stop what up.sh started
#
# State lives in $QA_STATE_DIR (default /tmp/qa): logs/, run/*.pid, up.lock.
set -euo pipefail

QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$QA_DIR/../.." && pwd)"
STATE="${QA_STATE_DIR:-/tmp/qa}"
PROJECT_ID="demo-mektebti"
AUTH_PORT=9099
FS_PORT=8080
VITE_PORT=5199

mkdir -p "$STATE/logs" "$STATE/run"

# One caller at a time. The fd is closed for every child below (9>&-) so a
# long-lived server never inherits the lock.
exec 9>"$STATE/up.lock"
if ! flock -w 600 9; then
  echo "up.sh: timed out waiting for another up.sh to finish (lock $STATE/up.lock)" >&2
  exit 1
fi

say() { printf '[qa] %s\n' "$*"; }

port_open() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }

auth_ok() { curl -fsS --max-time 2 "http://127.0.0.1:$AUTH_PORT/" 2>/dev/null | grep -q authEmulator; }
fs_ok() { curl -fsS --max-time 2 "http://127.0.0.1:$FS_PORT/" 2>/dev/null | grep -q Ok; }
# The dev server is only "ours" if the module it serves carries the emulator
# flag and the demo project id — a plain `npm run dev` on the same port is not.
vite_ok() {
  local mod
  mod="$(curl -fsS --max-time 10 "http://127.0.0.1:$VITE_PORT/src/lib/firebase.ts" 2>/dev/null)" || return 1
  grep -Eq '"VITE_USE_EMULATORS": *"1"' <<<"$mod" && grep -Eq "\"VITE_FIREBASE_PROJECT_ID\": *\"$PROJECT_ID\"" <<<"$mod"
}

wait_for() { # name, check-fn, seconds, logfile
  local name="$1" check="$2" secs="$3" log="$4" i
  for ((i = 0; i < secs * 2; i++)); do
    if "$check"; then return 0; fi
    sleep 0.5
  done
  say "$name did not come up within ${secs}s — last lines of $log:" >&2
  tail -n 40 "$log" >&2 || true
  return 1
}

# ---------------------------------------------------------------------------
# Dependencies
# ---------------------------------------------------------------------------

if [[ ! -x "$QA_DIR/node_modules/.bin/firebase" || ! -d "$QA_DIR/node_modules/firebase-admin" ]]; then
  say "installing harness dependencies in scripts/qa (firebase-tools, firebase-admin, playwright-core)…"
  (cd "$QA_DIR" && npm install --no-audit --no-fund) 9>&-
fi
if [[ ! -x "$ROOT/node_modules/.bin/vite" ]]; then
  say "installing app dependencies at the repo root…"
  (cd "$ROOT" && npm install --no-audit --no-fund) 9>&-
fi
if ! command -v java >/dev/null 2>&1; then
  echo "up.sh: java is required by the Firestore emulator (Java 11+, 21 recommended)" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Emulators
# ---------------------------------------------------------------------------

if auth_ok && fs_ok; then
  say "emulators already running (auth :$AUTH_PORT, firestore :$FS_PORT)"
else
  for p in "$AUTH_PORT" "$FS_PORT" 4400 4500; do
    if port_open "$p"; then
      echo "up.sh: port $p is in use by something that is not a healthy emulator pair." >&2
      echo "       Run 'bash scripts/qa/down.sh', or free the port, then retry." >&2
      exit 1
    fi
  done
  say "starting Firebase emulators (auth, firestore) for $PROJECT_ID…"
  # cwd = $STATE so firestore-debug.log and friends never land in the repo.
  (
    cd "$STATE"
    exec setsid nohup "$QA_DIR/node_modules/.bin/firebase" emulators:start \
      --only auth,firestore \
      --project "$PROJECT_ID" \
      --config "$ROOT/firebase.json" \
      --non-interactive \
      >"$STATE/logs/emulators.log" 2>&1 </dev/null 9>&-
  ) &
  echo $! >"$STATE/run/emulators.pid"
  wait_for "auth emulator" auth_ok 120 "$STATE/logs/emulators.log"
  wait_for "firestore emulator" fs_ok 120 "$STATE/logs/emulators.log"
  say "emulators up (pid $(cat "$STATE/run/emulators.pid"), log $STATE/logs/emulators.log)"
fi

# ---------------------------------------------------------------------------
# Vite dev server wired to the emulators
# ---------------------------------------------------------------------------

if vite_ok; then
  say "vite already running on http://127.0.0.1:$VITE_PORT (emulator mode)"
else
  if port_open "$VITE_PORT"; then
    echo "up.sh: port $VITE_PORT is in use by something that is not the emulator-wired dev server." >&2
    echo "       Run 'bash scripts/qa/down.sh', or free the port, then retry." >&2
    exit 1
  fi
  say "starting vite on :$VITE_PORT (VITE_USE_EMULATORS=1)…"
  # Explicit env wins over any .env.local in the repo (Vite never overrides
  # variables already present in the process environment), so a developer's
  # real Firebase config cannot leak into the QA server.
  (
    cd "$ROOT"
    exec env \
      VITE_USE_EMULATORS=1 \
      VITE_FIREBASE_API_KEY=demo-api-key \
      VITE_FIREBASE_AUTH_DOMAIN="$PROJECT_ID.firebaseapp.com" \
      VITE_FIREBASE_PROJECT_ID="$PROJECT_ID" \
      VITE_FIREBASE_STORAGE_BUCKET="$PROJECT_ID.appspot.com" \
      VITE_FIREBASE_MESSAGING_SENDER_ID=000000000000 \
      VITE_FIREBASE_APP_ID=1:000000000000:web:0000000000000000 \
      setsid nohup "$ROOT/node_modules/.bin/vite" \
      --host 127.0.0.1 --port "$VITE_PORT" --strictPort \
      >"$STATE/logs/vite.log" 2>&1 </dev/null 9>&-
  ) &
  echo $! >"$STATE/run/vite.pid"
  wait_for "vite" vite_ok 120 "$STATE/logs/vite.log"
  # Warm the module graph so the first browser visit does not pay for it.
  curl -fsS --max-time 60 "http://127.0.0.1:$VITE_PORT/" >/dev/null 2>&1 || true
  curl -fsS --max-time 60 "http://127.0.0.1:$VITE_PORT/src/main.tsx" >/dev/null 2>&1 || true
  say "vite up (pid $(cat "$STATE/run/vite.pid"), log $STATE/logs/vite.log)"
fi

say "ready:"
say "  app        http://127.0.0.1:$VITE_PORT"
say "  auth       http://127.0.0.1:$AUTH_PORT   firestore  http://127.0.0.1:$FS_PORT   project $PROJECT_ID"
say "  seed       node scripts/qa/seed.mjs <name>     -> <name>@qa.test / qa-pass-123"
