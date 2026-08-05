#!/bin/bash
# Delete demo simulators whose sessions were released more than the TTL ago.
#
# release-session.sh (without --delete) keeps the simulator and stamps the
# session with a released-at time; this reaper — invoked from every claim and
# release, or manually — removes devices past the TTL so retakes stay cheap for
# a day without simulators accumulating forever.
#
# Safety mirrors release-session.sh: a device is only deleted when the live
# device list says its udid still carries the session's expected
# blink-pr<N>-demo name, and never while it is booted (someone is using it).
#
# Usage: reap-stale.sh
#   BLINK_SIM_TTL_HOURS  retention window, default 24
#   BLINK_SIM_REGISTRY   session registry, default ~/.claude/blink-sim-sessions

set -uo pipefail

REGISTRY="${BLINK_SIM_REGISTRY:-$HOME/.claude/blink-sim-sessions}"
TTL_HOURS="${BLINK_SIM_TTL_HOURS:-24}"
NOW=$(date +%s)
TTL_SECONDS=$((TTL_HOURS * 3600))

[ -d "$REGISTRY" ] || exit 0

for SESSION_DIR in "$REGISTRY"/pr*/; do
  [ -d "$SESSION_DIR" ] || continue
  STAMP_FILE="$SESSION_DIR/released-at"
  [ -f "$STAMP_FILE" ] || continue          # active or crashed session: not ours to judge

  RELEASED_AT=$(cat "$STAMP_FILE" 2>/dev/null || echo "")
  case "$RELEASED_AT" in
    ''|*[!0-9]*) continue ;;
  esac
  [ $((NOW - RELEASED_AT)) -ge "$TTL_SECONDS" ] || continue

  PR=$(basename "$SESSION_DIR" | sed 's/^pr//')
  EXPECTED_NAME="blink-pr${PR}-demo"
  UDID=$(cat "$SESSION_DIR/udid" 2>/dev/null || echo "")

  if [ -n "$UDID" ]; then
    DEVICE=$(xcrun simctl list devices -j | python3 -c "
import json,sys
udid=sys.argv[1]
for _, devices in json.load(sys.stdin)['devices'].items():
    for d in devices:
        if d['udid'] == udid:
            print('%s|%s' % (d['name'], d.get('state', ''))); sys.exit(0)
" "$UDID" || true)

    if [ -n "$DEVICE" ]; then
      NAME="${DEVICE%|*}"; STATE="${DEVICE#*|}"
      if [ "$NAME" != "$EXPECTED_NAME" ]; then
        echo "reap: skipping $UDID - named '$NAME', expected '$EXPECTED_NAME'" >&2
        continue
      fi
      if [ "$STATE" = "Booted" ]; then
        echo "reap: skipping $EXPECTED_NAME - booted, someone is using it" >&2
        continue
      fi
      xcrun simctl delete "$UDID" || continue
      echo "reaped $EXPECTED_NAME ($UDID) - released $(( (NOW - RELEASED_AT) / 3600 ))h ago"
    fi
  fi

  rm -rf "$SESSION_DIR"
done

exit 0
