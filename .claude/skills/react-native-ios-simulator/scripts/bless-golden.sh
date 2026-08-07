#!/bin/bash
# Promote this session's simulator into the golden slot - the device that
# claim-session.sh clones for every later session instead of creating a blank
# one and paying app install + staging login again.
#
# Bless INSTEAD of release, never after it: this script terminates the session
# it promotes. Merely renaming the device would leave the session manifest
# pointing at a UDID whose name no longer matches, and the next
# release-session.sh would exit FATAL through its ownership gate - the signal
# reserved for real collateral damage, degraded into a false alarm. So bless
# verifies ownership, shuts the device down, renames it into the golden slot,
# writes the staleness stamp, and then adopts the session: manifest removed,
# port freed. There is nothing left to release.
#
# Simulator names are not unique, so replacing an existing golden is a swap
# that must end with exactly one device carrying the name: rename the old
# golden aside, rename the new one into place, delete the old. The swap (and
# the claim-side clone) run under the shared `golden` lock, because a clone of
# a golden that is being swapped mid-flight is a real race.
#
# Usage: bless-golden.sh <pr-number> [--sha <sha>]
#   <pr-number>  the claimed session whose simulator becomes the golden
#   --sha        build SHA recorded in the stamp (default: HEAD of the cwd's
#                git repo, or "unknown") - the agent compares it against
#                native-path changes before trusting a clone's app install
#
# Workflow: claim a session, install the app, log in once, then bless.
# If a later clone comes up logged out, the fix is to re-bless a fresh login.

set -euo pipefail

die() { echo "FATAL: $*" >&2; exit 1; }

PR="${1:?usage: bless-golden.sh <pr-number> [--sha <sha>]}"
shift

case "$PR" in
  ''|*[!0-9]*) die "pr-number must be numeric, got '$PR'" ;;
esac

SHA=""
while [ $# -gt 0 ]; do
  case "$1" in
    --sha) SHA="${2:?--sha needs a value}"; shift 2 ;;
    *) die "unknown argument '$1' (usage: bless-golden.sh <pr-number> [--sha <sha>])" ;;
  esac
done
[ -n "$SHA" ] || SHA=$(git rev-parse HEAD 2>/dev/null || echo "unknown")

REGISTRY="${DEMO_SIM_REGISTRY:-$HOME/.claude/rn-sim-sessions}"
PREFIX="${DEMO_SIM_PREFIX:-rn-demo}"
SIM_NAME="${PREFIX}-pr${PR}"
SESSION_DIR="$REGISTRY/$SIM_NAME"
GOLDEN_NAME="${DEMO_SIM_GOLDEN:-${PREFIX}-golden}"
[ "$GOLDEN_NAME" != "none" ] || die "DEMO_SIM_GOLDEN=none disables the golden slot; unset it to bless"
GOLDEN_DIR="$REGISTRY/golden/$GOLDEN_NAME"

[ -d "$SESSION_DIR" ] || die "no claimed session for PR #$PR"
UDID=$(cat "$SESSION_DIR/udid" 2>/dev/null || echo "")
[ -n "$UDID" ] || die "session for PR #$PR has no recorded device"
PORT=$(cat "$SESSION_DIR/port" 2>/dev/null || echo "")

# --- Ownership gate ----------------------------------------------------------
# Same rule as release-session.sh: never touch a device this skill did not name
# for this exact session, even if the manifest points at it.
ACTUAL_NAME=$(xcrun simctl list devices -j | python3 -c "
import json,sys
udid=sys.argv[1]
for _, devices in json.load(sys.stdin)['devices'].items():
    for d in devices:
        if d['udid'] == udid:
            print(d['name']); sys.exit(0)
" "$UDID" || true)
[ -n "$ACTUAL_NAME" ] || die "device $UDID no longer exists"
[ "$ACTUAL_NAME" = "$SIM_NAME" ] || die "refusing to bless $UDID - named '$ACTUAL_NAME', expected '$SIM_NAME'"

DEVICE_TYPE=$(cat "$SESSION_DIR/device-type" 2>/dev/null || echo "")
RUNTIME=$(cat "$SESSION_DIR/runtime" 2>/dev/null || echo "default")
[ -n "$DEVICE_TYPE" ] || die "session for PR #$PR recorded no device type (claimed before the golden-clone feature?) - re-claim and retry"

# --- Stop this session's Metro, by recorded PID only -------------------------
# Bless replaces release, so it inherits release's cleanup duties: without this
# the bundler would keep listening on a port the registry just freed.
METRO_PID=$(cat "$SESSION_DIR/metro.pid" 2>/dev/null || echo "")
if [ -n "$METRO_PID" ] && kill -0 "$METRO_PID" 2>/dev/null; then
  kill "$METRO_PID" 2>/dev/null || true
  sleep 1
  kill -0 "$METRO_PID" 2>/dev/null && kill -9 "$METRO_PID" 2>/dev/null || true
  echo "stopped Metro pid $METRO_PID (port $PORT)"
fi

# Ours by the gate above, so shutting it down is as safe as release doing it.
xcrun simctl shutdown "$UDID" 2>/dev/null || true

# --- The swap, under the golden lock -----------------------------------------
SWAP="$(mktemp -d "${TMPDIR:-/tmp}/bless-golden.XXXXXX")"
trap 'rm -rf "$SWAP"' EXIT
cat > "$SWAP/swap.sh" <<'SWAPEOF'
set -euo pipefail
UDID="$1"; GOLDEN_NAME="$2"
OLD=$(xcrun simctl list devices -j | python3 -c "
import json,sys
name=sys.argv[1]
for _, devices in json.load(sys.stdin)['devices'].items():
    for d in devices:
        if d['name'] == name:
            print(d['udid']); sys.exit(0)
" "$GOLDEN_NAME" || true)
if [ -n "$OLD" ]; then
  xcrun simctl shutdown "$OLD" 2>/dev/null || true
  xcrun simctl rename "$OLD" "$GOLDEN_NAME-retired"
fi
xcrun simctl rename "$UDID" "$GOLDEN_NAME"
if [ -n "$OLD" ]; then
  xcrun simctl delete "$OLD"
fi
SWAPEOF
"$(dirname "${BASH_SOURCE[0]}")/with-lock.sh" golden 300 \
  bash "$SWAP/swap.sh" "$UDID" "$GOLDEN_NAME"

# --- Stamp -------------------------------------------------------------------
# What a later claim needs to judge a clone: which hardware this is (device
# type/runtime gate the clone) and which build it carries (the agent diffs
# native paths against this SHA before trusting the install).
mkdir -p "$GOLDEN_DIR"
cat > "$GOLDEN_DIR/stamp" <<EOF
sha=$SHA
date=$(date +%Y-%m-%dT%H:%M:%S)
device-type=$DEVICE_TYPE
runtime=$RUNTIME
EOF

# --- Collateral-damage assertion ---------------------------------------------
# Same exit guarantee as release-session.sh: every device booted before this
# session began must still be booted (our own was never in that snapshot - the
# preflight is taken before claim boots it).
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
fi

# --- Adopt the session -------------------------------------------------------
# The device left the session's namespace, so the session must not survive it.
if [ -n "$PORT" ] && [ "$(cat "$REGISTRY/ports/$PORT/owner" 2>/dev/null)" = "$SIM_NAME" ]; then
  rm -rf "$REGISTRY/ports/$PORT"
fi
rm -rf "$SESSION_DIR"

echo "blessed $GOLDEN_NAME ($UDID) - stamp: $GOLDEN_DIR/stamp"
sed 's/^/  /' "$GOLDEN_DIR/stamp"
