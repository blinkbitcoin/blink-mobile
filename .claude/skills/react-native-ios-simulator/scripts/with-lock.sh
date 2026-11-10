#!/bin/bash
# Serialize an operation that touches machine-global state across all agents.
#
# macOS has no flock(1), so the lock is an atomic mkdir. The lock records the
# holder's PID, and a lock whose holder has died is reclaimed rather than
# deadlocking the next agent.
#
# Use for anything writing shared state: native builds (shared DerivedData),
# yarn installs (shared global cache), pod install.
#
# Usage: with-lock.sh <lock-name> <timeout-seconds> <command> [args...]
#   e.g. with-lock.sh native-build 1800 node node_modules/react-native/cli.js run-ios --udid "$DEMO_UDID"

set -euo pipefail

LOCK_NAME="${1:?usage: with-lock.sh <lock-name> <timeout-seconds> <command> [args...]}"
TIMEOUT="${2:?missing timeout-seconds}"
shift 2
[ "$#" -gt 0 ] || { echo "FATAL: no command given" >&2; exit 1; }

REGISTRY="${DEMO_SIM_REGISTRY:-$HOME/.claude/rn-sim-sessions}"
LOCK_DIR="$REGISTRY/locks/$LOCK_NAME"
RECLAIM_DIR="$LOCK_DIR.reclaim"
mkdir -p "$REGISTRY/locks"

acquired=""
deadline=$(( $(date +%s) + TIMEOUT ))

while [ -z "$acquired" ]; do
  if mkdir "$LOCK_DIR" 2>/dev/null; then
    echo $$ > "$LOCK_DIR/pid"
    acquired=1
    break
  fi

  holder=$(cat "$LOCK_DIR/pid" 2>/dev/null || echo "")
  if [ -n "$holder" ] && ! kill -0 "$holder" 2>/dev/null; then
    # Test seam: widen the window between seeing the dead holder and acting
    # on it, so the suite can force the two-reclaimer interleaving for real.
    [ -n "${WITH_LOCK_RECLAIM_DELAY:-}" ] && sleep "$WITH_LOCK_RECLAIM_DELAY"
    # Reclaiming is itself a critical section: two waiters can both see the
    # same dead pid, and an unguarded rm by the slower one would delete the
    # lock the faster one just took. Only the waiter holding the reclaim
    # mutex may remove the lock, and only after re-reading that it still
    # belongs to the dead pid.
    if mkdir "$RECLAIM_DIR" 2>/dev/null; then
      if [ "$(cat "$LOCK_DIR/pid" 2>/dev/null || echo "")" = "$holder" ] \
         && ! kill -0 "$holder" 2>/dev/null; then
        echo "reclaiming '$LOCK_NAME' from dead pid $holder" >&2
        rm -rf "$LOCK_DIR"
      fi
      rmdir "$RECLAIM_DIR" 2>/dev/null || true
      continue
    fi
    # A reclaim mutex is held for milliseconds; one older than a minute was
    # orphaned by a waiter killed mid-reclaim.
    if [ $(( $(date +%s) - $(stat -f %m "$RECLAIM_DIR" 2>/dev/null || date +%s) )) -gt 60 ]; then
      rmdir "$RECLAIM_DIR" 2>/dev/null || true
      continue
    fi
  fi

  if [ "$(date +%s)" -ge "$deadline" ]; then
    echo "FATAL: timed out after ${TIMEOUT}s waiting for '$LOCK_NAME' (held by pid ${holder:-unknown})" >&2
    exit 1
  fi

  echo "waiting for '$LOCK_NAME' (held by pid ${holder:-unknown})..." >&2
  sleep "${WITH_LOCK_POLL_SECONDS:-10}"   # overridable so tests need not wait 10s per poll
done

trap 'rm -rf "$LOCK_DIR"' EXIT INT TERM
"$@"
