#!/bin/bash
# Release one PR's screenshot session and prove nothing else was disturbed.
#
# Only ever touches: the simulator named <prefix>-pr<N> for this PR, the Metro process
# whose PID this session recorded, and this session's port reservation. Then it
# diffs the booted-device list against the pre-flight snapshot and fails loudly
# if anything that was booted before is not booted now.
#
# Usage: release-session.sh <pr-number> [--delete]
#   default leaves the simulator shut down but present (cheap to re-use for
#           retakes); reap-stale.sh removes it automatically once it has sat
#           released for DEMO_SIM_TTL_HOURS (default 72h)
#   --delete removes it immediately

set -euo pipefail

PR="${1:?usage: release-session.sh <pr-number> [--delete]}"
DELETE="${2:-}"

case "$PR" in
  ''|*[!0-9]*) echo "FATAL: pr-number must be numeric, got '$PR'" >&2; exit 1 ;;
esac

REGISTRY="${DEMO_SIM_REGISTRY:-$HOME/.claude/rn-sim-sessions}"
EXPECTED_NAME="${DEMO_SIM_PREFIX:-rn-demo}-pr${PR}"
# Same (prefix, PR) key as claim-session.sh: a release run under a different
# prefix cannot even see this session, let alone touch its device.
SESSION_DIR="$REGISTRY/${EXPECTED_NAME}"

[ -d "$SESSION_DIR" ] || { echo "FATAL: no claimed session for PR #$PR" >&2; exit 1; }

UDID=$(cat "$SESSION_DIR/udid" 2>/dev/null || echo "")
PORT=$(cat "$SESSION_DIR/port" 2>/dev/null || echo "")

# --- Ownership gate ----------------------------------------------------------
# Refuse to shut down or delete a device whose name is not ours, even if the
# manifest points at it. This is what stops a stale/edited manifest from taking
# out the user's simulator or another agent's.
if [ -n "$UDID" ]; then
  ACTUAL_NAME=$(xcrun simctl list devices -j | python3 -c "
import json,sys
udid=sys.argv[1]
for _, devices in json.load(sys.stdin)['devices'].items():
    for d in devices:
        if d['udid'] == udid:
            print(d['name']); sys.exit(0)
" "$UDID" || true)

  if [ -z "$ACTUAL_NAME" ]; then
    echo "note: device $UDID no longer exists; nothing to shut down"
    UDID=""
  elif [ "$ACTUAL_NAME" != "$EXPECTED_NAME" ]; then
    echo "FATAL: refusing to touch $UDID - named '$ACTUAL_NAME', expected '$EXPECTED_NAME'" >&2
    exit 1
  fi
fi

# --- Metro ------------------------------------------------------------------
# By recorded PID only. Never pkill -f metro / node: that kills the user's
# bundler on 8081 and every other agent's.
METRO_PID=$(cat "$SESSION_DIR/metro.pid" 2>/dev/null || echo "")
if [ -n "$METRO_PID" ] && kill -0 "$METRO_PID" 2>/dev/null; then
  kill "$METRO_PID" 2>/dev/null || true
  sleep 1
  kill -0 "$METRO_PID" 2>/dev/null && kill -9 "$METRO_PID" 2>/dev/null || true
  echo "stopped Metro pid $METRO_PID (port $PORT)"
fi

# --- Simulator ---------------------------------------------------------------
if [ -n "$UDID" ]; then
  xcrun simctl shutdown "$UDID" 2>/dev/null || true
  if [ "$DELETE" = "--delete" ]; then
    xcrun simctl delete "$UDID"
    echo "deleted $EXPECTED_NAME ($UDID)"
  else
    # Stamp for the reaper: kept for DEMO_SIM_TTL_HOURS (default 72h) so
    # retakes are cheap, then reap-stale.sh removes it on a later claim/release.
    date +%s > "$SESSION_DIR/released-at"
    echo "shut down $EXPECTED_NAME ($UDID), kept for ${DEMO_SIM_TTL_HOURS:-72}h"
  fi
fi

# --- Port release ------------------------------------------------------------
if [ -n "$PORT" ] && [ "$(cat "$REGISTRY/ports/$PORT/owner" 2>/dev/null)" = "$EXPECTED_NAME" ]; then
  rm -rf "$REGISTRY/ports/$PORT"
fi

# --- Collateral-damage assertion ---------------------------------------------
# Every device booted at claim time must still be booted, minus our own.
PRE="$SESSION_DIR/preflight-booted.json"
if [ -f "$PRE" ]; then
  NOW="$SESSION_DIR/postflight-booted.json"
  xcrun simctl list devices booted -j > "$NOW"
  MISSING=$(python3 -c "
import json, sys
pre_path, now_path, ours = sys.argv[1], sys.argv[2], sys.argv[3]
def udids(path):
    with open(path) as f:
        doc = json.load(f)
    return {d['udid']: d['name'] for _, ds in doc['devices'].items() for d in ds}
before, after = udids(pre_path), udids(now_path)
for u, n in before.items():
    if u not in after and u != ours:
        print('%s (%s)' % (n, u))
" "$PRE" "$NOW" "$UDID")
  if [ -n "$MISSING" ]; then
    echo "COLLATERAL DAMAGE - these were booted before this session and are not now:" >&2
    echo "$MISSING" >&2
    exit 1
  fi
  echo "verified: no other simulator was shut down by this session"
fi

# --- Retention housekeeping --------------------------------------------------
# A deleted device needs no session manifest; kept devices are swept once their
# released-at stamp ages past the TTL.
if [ "$DELETE" = "--delete" ]; then
  rm -rf "$SESSION_DIR"
fi
"$(dirname "${BASH_SOURCE[0]}")/reap-stale.sh" || true
