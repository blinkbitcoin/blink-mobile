#!/bin/bash
# Release one PR's Android session and prove nothing else was disturbed.
#
# Only ever touches: the emulator whose PID this session recorded, the Metro
# process whose PID this session recorded, and this session's reservations.
# Then it diffs the attached-device list against the pre-flight snapshot and
# fails loudly if anything that was attached before is gone - the Android twin
# of the iOS collateral-damage assertion.
#
# Usage: release-session.sh <pr-number> [--delete]
#   default leaves the emulator shut down and the session on disk (cheap
#           retakes); reap-stale.sh sweeps it after DEMO_SIM_TTL_HOURS (72h)
#   --delete drops the session directory immediately

set -euo pipefail

TEL_LIB="$(dirname "${BASH_SOURCE[0]}")/../../react-native-ios-simulator/lib/telemetry.sh"
{ [ -f "$TEL_LIB" ] && . "$TEL_LIB"; } 2>/dev/null || true
type tel_emit >/dev/null 2>&1 || { tel_now() { echo 0; }; tel_emit() { :; }; tel_span() { while [ $# -gt 0 ] && [ "$1" != "--" ]; do shift; done; [ $# -gt 0 ] && shift; "$@"; }; }
T_RELEASE=$(tel_now)

PORTS_LIB="$(dirname "${BASH_SOURCE[0]}")/../../react-native-ios-simulator/lib/ports.sh"
[ -f "$PORTS_LIB" ] || { echo "FATAL: missing $PORTS_LIB" >&2; exit 1; }
. "$PORTS_LIB"

PR="${1:?usage: release-session.sh <pr-number> [--delete]}"
DELETE="${2:-}"

case "$PR" in
  ''|*[!0-9]*) echo "FATAL: pr-number must be numeric, got '$PR'" >&2; exit 1 ;;
esac

REGISTRY="${DEMO_SIM_REGISTRY:-$HOME/.claude/rn-sim-sessions}"
SESSION_NAME="${DEMO_EMU_PREFIX:-${DEMO_SIM_PREFIX:-rn-demo}}-android-pr${PR}"
SESSION_DIR="$REGISTRY/${SESSION_NAME}"

[ -d "$SESSION_DIR" ] || { echo "FATAL: no claimed Android session for PR #$PR" >&2; exit 1; }

SERIAL=$(cat "$SESSION_DIR/serial" 2>/dev/null || echo "")
PORT=$(cat "$SESSION_DIR/port" 2>/dev/null || echo "")
CONSOLE_PORT=$(cat "$SESSION_DIR/console-port" 2>/dev/null || echo "")
AVD=$(cat "$SESSION_DIR/avd" 2>/dev/null || echo "")
EMU_PID=$(cat "$SESSION_DIR/emulator.pid" 2>/dev/null || echo "")

# --- Ownership gate ----------------------------------------------------------
# An emulator we did not start is never ours to kill, however the manifest
# looks. Two independent checks: the recorded PID must still be an emulator we
# own, and the live AVD identity must match what we reserved.
if [ -n "$SERIAL" ] && adb devices | grep -q "^$SERIAL[[:space:]]"; then
  LIVE_AVD=$(adb -s "$SERIAL" emu avd name 2>/dev/null | head -1 | tr -d '\r' || true)
  if [ -n "$LIVE_AVD" ] && [ -n "$AVD" ] && [ "$LIVE_AVD" != "$AVD" ]; then
    echo "FATAL: refusing to touch $SERIAL - it runs AVD '$LIVE_AVD', not the '$AVD' this session reserved" >&2
    exit 1
  fi
  if [ -z "$EMU_PID" ] || ! kill -0 "$EMU_PID" 2>/dev/null; then
    echo "note: $SERIAL is attached but this session's emulator process is gone; leaving it alone" >&2
    SERIAL=""
  fi
fi

# --- Metro -------------------------------------------------------------------
# By recorded PID only, never pkill: that would kill the user's 8081 bundler
# and every other agent's.
METRO_PID=$(cat "$SESSION_DIR/metro.pid" 2>/dev/null || echo "")
if [ -n "$METRO_PID" ] && kill -0 "$METRO_PID" 2>/dev/null; then
  kill "$METRO_PID" 2>/dev/null || true
  sleep 1
  kill -0 "$METRO_PID" 2>/dev/null && kill -9 "$METRO_PID" 2>/dev/null || true
  echo "stopped Metro pid $METRO_PID (port $PORT)"
fi

# --- Emulator ----------------------------------------------------------------
if [ -n "$SERIAL" ]; then
  adb -s "$SERIAL" emu kill >/dev/null 2>&1 || true
  # Give it a moment to detach before the postflight diff reads the list.
  for _ in $(seq 30); do
    adb devices | grep -q "^$SERIAL[[:space:]]" || break
    sleep 1
  done
  if [ -n "$EMU_PID" ] && kill -0 "$EMU_PID" 2>/dev/null; then
    kill "$EMU_PID" 2>/dev/null || true
  fi
  echo "shut down $SERIAL (AVD $AVD)"
fi

# --- Reservations ------------------------------------------------------------
release_metro_port "$REGISTRY" "$PORT" "$SESSION_NAME"
[ -n "$CONSOLE_PORT" ] && release_slot "$REGISTRY" emu-ports "$CONSOLE_PORT" "$SESSION_NAME"
[ -n "$AVD" ] && release_slot "$REGISTRY" avds "$AVD" "$SESSION_NAME"

# --- Collateral-damage assertion ---------------------------------------------
# Every device attached at claim time must still be attached, minus our own.
PRE="$SESSION_DIR/preflight-devices.txt"
if [ -f "$PRE" ]; then
  NOW="$SESSION_DIR/postflight-devices.txt"
  adb devices | tail -n +2 | awk 'NF>=2 {print $1}' > "$NOW" 2>/dev/null || : > "$NOW"
  MISSING=""
  while IFS= read -r dev; do
    [ -n "$dev" ] || continue
    [ "$dev" = "$SERIAL" ] && continue
    grep -qx "$dev" "$NOW" || MISSING="$MISSING $dev"
  done < "$PRE"
  if [ -n "$MISSING" ]; then
    echo "COLLATERAL DAMAGE - these were attached before this session and are not now:$MISSING" >&2
    exit 1
  fi
  echo "verified: no other emulator was shut down by this session"
fi

# --- Retention ---------------------------------------------------------------
if [ "$DELETE" = "--delete" ]; then
  rm -rf "$SESSION_DIR"
else
  date +%s > "$SESSION_DIR/released-at"
  echo "session kept for ${DEMO_SIM_TTL_HOURS:-72}h"
fi
"$(dirname "${BASH_SOURCE[0]}")/reap-stale.sh" >/dev/null 2>&1 || true

DEMO_SIM_NAME="$SESSION_NAME" tel_emit android.release.total "$T_RELEASE" \
  deleted="$([ "$DELETE" = "--delete" ] && echo 1 || echo 0)"
