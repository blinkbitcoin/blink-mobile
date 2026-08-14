#!/bin/bash
# Free reservations from Android sessions released more than the TTL ago.
#
# The iOS reaper deletes simulators; this one has nothing to delete (an AVD is
# a durable, hand-made artifact - deleting it would destroy work nobody asked
# us to destroy). What it sweeps is the SESSION and its RESERVATIONS, so a
# crashed or forgotten session cannot hold an AVD and a port hostage forever.
#
# Safety mirrors release-session.sh: a session whose emulator is still attached
# and alive is never swept, and only this prefix's sessions are touched -
# another repo's expired sessions belong to its own reaper.
#
# Usage: reap-stale.sh
#   DEMO_SIM_TTL_HOURS  retention window, default 72
#   DEMO_SIM_REGISTRY   session registry, default ~/.claude/rn-sim-sessions

set -uo pipefail

REGISTRY="${DEMO_SIM_REGISTRY:-$HOME/.claude/rn-sim-sessions}"
TTL_HOURS="${DEMO_SIM_TTL_HOURS:-72}"
PREFIX="${DEMO_EMU_PREFIX:-${DEMO_SIM_PREFIX:-rn-demo}}"
NOW=$(date +%s)
TTL_SECONDS=$((TTL_HOURS * 3600))

[ -d "$REGISTRY" ] || exit 0

PORTS_LIB="$(dirname "${BASH_SOURCE[0]}")/../../react-native-ios-simulator/lib/ports.sh"
[ -f "$PORTS_LIB" ] && . "$PORTS_LIB"

for SESSION_DIR in "$REGISTRY/${PREFIX}-android-pr"*/; do
  [ -d "$SESSION_DIR" ] || continue
  STAMP_FILE="$SESSION_DIR/released-at"
  [ -f "$STAMP_FILE" ] || continue          # active or crashed: not ours to judge

  RELEASED_AT=$(cat "$STAMP_FILE" 2>/dev/null || echo "")
  case "$RELEASED_AT" in
    ''|*[!0-9]*) continue ;;
  esac
  [ $((NOW - RELEASED_AT)) -ge "$TTL_SECONDS" ] || continue

  SESSION_NAME=$(basename "$SESSION_DIR")
  SERIAL=$(cat "$SESSION_DIR/serial" 2>/dev/null || echo "")

  # Someone re-booted this emulator out of band: leave the whole session alone.
  if [ -n "$SERIAL" ] && adb devices 2>/dev/null | grep -q "^$SERIAL[[:space:]]"; then
    echo "reap: skipping $SESSION_NAME - $SERIAL is attached, someone is using it" >&2
    continue
  fi

  if type release_metro_port >/dev/null 2>&1; then
    release_metro_port "$REGISTRY" "$(cat "$SESSION_DIR/port" 2>/dev/null || echo "")" "$SESSION_NAME"
    CONSOLE_PORT=$(cat "$SESSION_DIR/console-port" 2>/dev/null || echo "")
    AVD=$(cat "$SESSION_DIR/avd" 2>/dev/null || echo "")
    [ -n "$CONSOLE_PORT" ] && release_slot "$REGISTRY" emu-ports "$CONSOLE_PORT" "$SESSION_NAME"
    [ -n "$AVD" ] && release_slot "$REGISTRY" avds "$AVD" "$SESSION_NAME"
  fi

  rm -rf "$SESSION_DIR"
  echo "reaped $SESSION_NAME - released $(( (NOW - RELEASED_AT) / 3600 ))h ago"
done

exit 0
