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
# Keyed by the full device name, not the bare PR number: the registry is shared
# machine-wide, and two repos using these skills can hold the same PR number at
# once. The prefix is what keeps their sessions apart.
SESSION_DIR="$REGISTRY/${SIM_NAME}"

# Sweep simulators from sessions released more than the TTL ago (default 72h),
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
      echo "$SIM_NAME" > "$REGISTRY/ports/$candidate/owner"
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
      if [ "$(cat "$REGISTRY/ports/$candidate/owner" 2>/dev/null)" = "$SIM_NAME" ]; then
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

# --- Golden clone fast path --------------------------------------------------
# A blessed "golden" simulator (app installed, account logged in - see
# bless-golden.sh) turns device setup from install + login minutes into a
# seconds-long clone. The clone never mutates the golden, and the new device is
# named for this PR like any other, so every ownership guard works unchanged.
# Any ineligibility falls through to a blank create with a note - a demo on the
# wrong device type or a booted golden must never be silent.
if [ -z "$UDID" ]; then
  GOLDEN_NAME="${DEMO_SIM_GOLDEN:-${DEMO_SIM_PREFIX:-rn-demo}-golden}"
  GOLDEN_DIR="$REGISTRY/golden/$GOLDEN_NAME"
  if [ "$GOLDEN_NAME" != "none" ]; then
    GOLDEN=$(xcrun simctl list devices -j \
      | python3 -c "
import json,sys
name=sys.argv[1]
for _, devices in json.load(sys.stdin)['devices'].items():
    for d in devices:
        if d['name'] == name and d.get('isAvailable', True):
            print('%s|%s' % (d['udid'], d.get('state', ''))); sys.exit(0)
" "$GOLDEN_NAME" || true)
    if [ -n "$GOLDEN" ]; then
      GOLDEN_UDID="${GOLDEN%|*}"; GOLDEN_STATE="${GOLDEN#*|}"
      STAMP_TYPE=$(grep '^device-type=' "$GOLDEN_DIR/stamp" 2>/dev/null | cut -d= -f2- || true)
      STAMP_RUNTIME=$(grep '^runtime=' "$GOLDEN_DIR/stamp" 2>/dev/null | cut -d= -f2- || true)
      if [ ! -f "$GOLDEN_DIR/stamp" ]; then
        echo "note: golden $GOLDEN_NAME has no stamp (not blessed by bless-golden.sh); creating a blank device" >&2
      elif [ "$GOLDEN_STATE" != "Shutdown" ]; then
        echo "note: golden $GOLDEN_NAME is $GOLDEN_STATE, clone needs Shutdown; creating a blank device" >&2
      elif [ "$DEVICE_TYPE" != "$STAMP_TYPE" ]; then
        # A clone inherits the golden's hardware; shipping a pair shot on a
        # silently different device type would make the demo dishonest.
        echo "note: golden $GOLDEN_NAME is a '$STAMP_TYPE', requested '$DEVICE_TYPE'; creating a blank device" >&2
      elif [ -n "$RUNTIME" ] && [ "$RUNTIME" != "$STAMP_RUNTIME" ]; then
        echo "note: golden $GOLDEN_NAME runs '$STAMP_RUNTIME', requested '$RUNTIME'; creating a blank device" >&2
      else
        # Under the golden lock: a concurrent re-bless swaps the golden device
        # mid-flight. If the clone still fails, fall through to a blank create.
        UDID=$("$(dirname "${BASH_SOURCE[0]}")/with-lock.sh" golden 300 \
          xcrun simctl clone "$GOLDEN_UDID" "$SIM_NAME" 2>/dev/null || true)
        if [ -n "$UDID" ]; then
          echo "cloned-from-golden" > "$SESSION_DIR/origin"
          echo "$GOLDEN_NAME" > "$SESSION_DIR/golden-source"
          cp "$GOLDEN_DIR/stamp" "$SESSION_DIR/golden-stamp" 2>/dev/null || true
          echo "$STAMP_TYPE" > "$SESSION_DIR/device-type"
          echo "${STAMP_RUNTIME:-default}" > "$SESSION_DIR/runtime"
        else
          echo "note: cloning golden $GOLDEN_NAME failed; creating a blank device" >&2
        fi
      fi
    fi
  fi
fi

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
  # Recorded so bless-golden.sh can stamp what hardware the golden actually is,
  # which is what lets a later claim refuse a device-type-mismatched clone.
  echo "$DEVICE_TYPE" > "$SESSION_DIR/device-type"
  echo "${RUNTIME:-default}" > "$SESSION_DIR/runtime"
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

# Stamp comments (sha/date/device-type) let the agent judge whether the golden's
# native build is stale before trusting the cloned install - see SKILL.md.
if [ -f "$SESSION_DIR/golden-stamp" ]; then
  echo "# golden: this device is a clone of $(cat "$SESSION_DIR/golden-source" 2>/dev/null || echo "the golden sim")"
  sed 's/^/# golden /' "$SESSION_DIR/golden-stamp"
  # Instant staleness verdict when the cwd is an app worktree: hash comparison
  # against the blessed Podfile.lock instead of git archaeology. A wrong guess
  # here used to cost a ~14 min rebuild discovered as a crash at launch.
  RECORDED_LOCK=$(grep '^podfile-lock-hash=' "$SESSION_DIR/golden-stamp" 2>/dev/null | cut -d= -f2- || true)
  if [ -n "$RECORDED_LOCK" ] && [ -f "ios/Podfile.lock" ]; then
    CURRENT_LOCK=$(shasum -a 256 ios/Podfile.lock | cut -d' ' -f1)
    if [ "$CURRENT_LOCK" = "$RECORDED_LOCK" ]; then
      echo "# golden verdict: native build matches this worktree's ios/Podfile.lock"
    else
      echo "# golden verdict: NATIVE BUILD STALE - ios/Podfile.lock changed since the bless; install a fresh build onto this clone, or re-bless the golden"
    fi
  fi
fi
