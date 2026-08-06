#!/bin/bash
# Claim an isolated simulator + Metro port for one PR's screenshot run.
#
# Concurrency-safe: the port is reserved by an atomic mkdir in a registry shared
# by every agent on this machine, so two agents claiming at the same instant
# cannot land on the same port. The simulator is named after the PR, which is
# what later proves ownership at release time.
#
# Usage: claim-session.sh <pr-number> [device-type] [runtime]
#   e.g. claim-session.sh 3712
#        claim-session.sh 3712 "iPhone 16 Pro" "iOS 26.5"

set -euo pipefail

PR="${1:?usage: claim-session.sh <pr-number> [device-type] [runtime]}"
DEVICE_TYPE="${2:-iPhone 16 Pro}"
RUNTIME="${3:-}"

case "$PR" in
  ''|*[!0-9]*) echo "FATAL: pr-number must be numeric, got '$PR'" >&2; exit 1 ;;
esac

REGISTRY="${DEMO_SIM_REGISTRY:-$HOME/.claude/rn-sim-sessions}"
SIM_NAME="${DEMO_SIM_PREFIX:-rn-demo}-pr${PR}"
SESSION_DIR="$REGISTRY/pr${PR}"

# Sweep simulators from sessions released more than the TTL ago (default 24h),
# then un-mark our own session: an active claim is never reaped.
"$(dirname "${BASH_SOURCE[0]}")/reap-stale.sh" >/dev/null 2>&1 || true
mkdir -p "$REGISTRY/ports" "$SESSION_DIR"
rm -f "$SESSION_DIR/released-at"

# --- Pre-flight snapshot -----------------------------------------------------
# Everything booted before we touch anything. release-session.sh asserts this
# exact set is still booted afterwards, which is how collateral damage to the
# user's simulator or another agent's gets caught rather than going unnoticed.
xcrun simctl list devices booted -j > "$SESSION_DIR/preflight-booted.json"
PREFLIGHT_COUNT=$(grep -c '"udid"' "$SESSION_DIR/preflight-booted.json" || true)

# --- Port reservation --------------------------------------------------------
# Deterministic starting point per PR (so re-runs are stable), then walk upward.
# mkdir is atomic on every filesystem we care about: whoever creates the
# directory owns the port. 8081 is never in range - that is the user's Metro.
reserve_port() {
  local base=$((8100 + (PR % 400)))
  local candidate stale_pid
  for offset in $(seq 0 60); do
    candidate=$((base + offset))
    [ "$candidate" -eq 8081 ] && continue
    if mkdir "$REGISTRY/ports/$candidate" 2>/dev/null; then
      echo "$PR" > "$REGISTRY/ports/$candidate/owner"
      # Re-check after winning the reservation: another process outside this
      # registry (a stray Metro, an unrelated dev server) may already hold it.
      if lsof -nP -iTCP:"$candidate" -sTCP:LISTEN >/dev/null 2>&1; then
        rm -rf "$REGISTRY/ports/$candidate"
        continue
      fi
      echo "$candidate"; return 0
    fi
    # Reclaim a reservation whose owning session no longer exists.
    stale_pid=$(cat "$REGISTRY/ports/$candidate/metro.pid" 2>/dev/null || echo "")
    if [ -n "$stale_pid" ] && ! kill -0 "$stale_pid" 2>/dev/null; then
      if [ "$(cat "$REGISTRY/ports/$candidate/owner" 2>/dev/null)" = "$PR" ]; then
        echo "$candidate"; return 0
      fi
    fi
  done
  echo "FATAL: no free port in $base..$((base + 60))" >&2; exit 1
}

if [ -f "$SESSION_DIR/port" ]; then
  PORT=$(cat "$SESSION_DIR/port")   # idempotent re-claim
else
  PORT=$(reserve_port)
  echo "$PORT" > "$SESSION_DIR/port"
fi

# --- Simulator ---------------------------------------------------------------
# Reuse our own named sim if a previous run left it; never adopt one we did not
# name, because the name is the only ownership marker release-session trusts.
UDID=$(xcrun simctl list devices -j \
  | python3 -c "
import json,sys
name=sys.argv[1]
for runtime, devices in json.load(sys.stdin)['devices'].items():
    for d in devices:
        if d['name'] == name and d.get('isAvailable', True):
            print(d['udid']); sys.exit(0)
" "$SIM_NAME" || true)

if [ -z "$UDID" ]; then
  if [ -z "$RUNTIME" ]; then
    RUNTIME_ID=$(xcrun simctl list runtimes -j \
      | python3 -c "
import json,sys
rs=[r for r in json.load(sys.stdin)['runtimes'] if r['isAvailable'] and 'iOS' in r['name']]
print(sorted(rs, key=lambda r: r['version'])[-1]['identifier'])
")
  else
    RUNTIME_ID=$(xcrun simctl list runtimes -j \
      | python3 -c "
import json,sys
name=sys.argv[1]
for r in json.load(sys.stdin)['runtimes']:
    if r['isAvailable'] and r['name'] == name:
        print(r['identifier']); sys.exit(0)
sys.exit('runtime not available: ' + name)
" "$RUNTIME")
  fi
  UDID=$(xcrun simctl create "$SIM_NAME" "$DEVICE_TYPE" "$RUNTIME_ID")
  echo "created" > "$SESSION_DIR/origin"
fi

echo "$UDID" > "$SESSION_DIR/udid"
echo "$SIM_NAME" > "$SESSION_DIR/name"
ln -sfn "$SESSION_DIR" "$REGISTRY/ports/$PORT/session" 2>/dev/null || true

xcrun simctl bootstatus "$UDID" -b >/dev/null 2>&1 || xcrun simctl boot "$UDID"

# Persist the Metro redirect on THIS device only, so later plain `simctl launch`
# calls keep using our bundler and never fall back to the user's 8081. Needs the
# app's bundle id; without one the persisted redirect is skipped (flows that pass
# RCT_jsLocation as a launch argument are unaffected).
if [ -n "${DEMO_APP_ID_IOS:-}" ]; then
  xcrun simctl spawn "$UDID" defaults write "$DEMO_APP_ID_IOS" RCT_jsLocation "localhost:$PORT" || true
fi

cat <<EOF
# Claimed session for PR #$PR
export DEMO_PR=$PR
export DEMO_SIM_NAME="$SIM_NAME"
export DEMO_UDID=$UDID
export DEMO_PORT=$PORT
export DEMO_SESSION_DIR="$SESSION_DIR"
# Devices booted before this session: $PREFLIGHT_COUNT (recorded for the release check)
EOF
