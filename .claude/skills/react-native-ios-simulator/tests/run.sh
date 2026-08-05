#!/bin/bash
# Integration tests for the session-isolation scripts.
#
# Run after editing anything in ../scripts/. Exits non-zero on any failure.
# Creates no real simulators: a fake `xcrun` is placed first on PATH, and the
# session registry is redirected into a temp dir via BLINK_SIM_REGISTRY.
#
#   ./tests/run.sh          # quiet
#   VERBOSE=1 ./tests/run.sh

set -uo pipefail

TESTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS="$TESTS_DIR/../scripts"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/rn-ios-sim-tests.XXXXXX")"

export PATH="$TESTS_DIR/fixtures/bin:$PATH"
export FAKE_DEVICES="$WORK/devices.txt"
export BLINK_SIM_REGISTRY="$WORK/registry"

PASS=0; FAIL=0; STRAYS=()

cleanup() {
  for pid in "${STRAYS[@]:-}"; do
    [ -n "${pid:-}" ] && kill "$pid" 2>/dev/null
  done
  rm -rf "$WORK"
}
trap cleanup EXIT

say()  { [ -n "${VERBOSE:-}" ] && echo "    $*"; return 0; }
ok()   { PASS=$((PASS+1)); printf '  \033[32mPASS\033[0m %s\n' "$1"; }
bad()  { FAIL=$((FAIL+1)); printf '  \033[31mFAIL\033[0m %s\n       %s\n' "$1" "$2"; }
check(){ # check <name> <expected> <actual>
  if [ "$2" = "$3" ]; then ok "$1"; else bad "$1" "expected '$2', got '$3'"; fi
}

# Reset device list and registry to a known baseline: the user's own booted sim
# plus another agent's booted demo sim. Both must survive every test.
reset_world() {
  rm -rf "$BLINK_SIM_REGISTRY"
  printf 'USER-SIM|iPhone 16 Pro|Booted\nOTHER-AGENT|blink-pr999-demo|Booted\n' > "$FAKE_DEVICES"
}

booted() { grep -c '|Booted$' "$FAKE_DEVICES" 2>/dev/null || echo 0; }
device_state() { awk -F'|' -v u="$1" '$1==u {print $3}' "$FAKE_DEVICES"; }

echo
echo "session claim/release"

# --- claim ------------------------------------------------------------------
reset_world
out=$("$SCRIPTS/claim-session.sh" 3712 2>&1) && eval "$out"
check "claims a port in the reserved range" "yes" \
  "$([ "${BLINK_PORT:-0}" -ge 8100 ] && [ "${BLINK_PORT:-0}" -le 8499 ] && echo yes || echo "no (${BLINK_PORT:-unset})")"
check "names the simulator after the PR" "blink-pr3712-demo" "${BLINK_SIM_NAME:-unset}"
check "boots the simulator it created" "Booted" "$(device_state "${BLINK_UDID:-x}")"

PORT_1="$BLINK_PORT"; UDID_1="$BLINK_UDID"

# --- idempotency ------------------------------------------------------------
eval "$("$SCRIPTS/claim-session.sh" 3712)"
check "re-claim returns the same port" "$PORT_1" "$BLINK_PORT"
check "re-claim reuses the same device" "$UDID_1" "$BLINK_UDID"

# --- port collision ---------------------------------------------------------
# 3712 and 4112 hash to the same base port; the second must be pushed off it.
eval "$("$SCRIPTS/claim-session.sh" 4112)"
check "colliding PRs get distinct ports" "different" \
  "$([ "$BLINK_PORT" != "$PORT_1" ] && echo different || echo "same ($BLINK_PORT)")"

check "never reserves the user's 8081" "absent" \
  "$([ -d "$BLINK_SIM_REGISTRY/ports/8081" ] && echo present || echo absent)"

# --- port already occupied by a non-registry process ------------------------
reset_world
python3 -c '
import socket, sys, time
s = socket.socket(); s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
s.bind(("127.0.0.1", 8212)); s.listen(1)
sys.stderr.write("bound\n"); sys.stderr.flush()
time.sleep(120)
' 2>"$WORK/bind.log" &
BINDER=$!
STRAYS+=($BINDER)
disown $BINDER 2>/dev/null   # keep the shell from printing a job-killed notice at cleanup
for _ in $(seq 30); do grep -q bound "$WORK/bind.log" 2>/dev/null && break; sleep 0.2; done

eval "$("$SCRIPTS/claim-session.sh" 3712)"   # base for 3712 is 8212
check "skips a port held by an outside process" "skipped" \
  "$([ "$BLINK_PORT" != "8212" ] && echo skipped || echo "took 8212 anyway")"
kill "$BINDER" 2>/dev/null

# --- rejects nonsense -------------------------------------------------------
"$SCRIPTS/claim-session.sh" not-a-number >/dev/null 2>&1
check "rejects a non-numeric PR number" "1" "$?"

echo
echo "release safety"

# --- ownership gate ---------------------------------------------------------
reset_world
eval "$("$SCRIPTS/claim-session.sh" 3712)" >/dev/null 2>&1
echo "OTHER-AGENT" > "$BLINK_SESSION_DIR/udid"     # manifest points at someone else
"$SCRIPTS/release-session.sh" 3712 --delete >/dev/null 2>&1
check "refuses a device not named for this PR" "1" "$?"
check "the other agent's simulator survives" "Booted" "$(device_state OTHER-AGENT)"

# --- clean release ----------------------------------------------------------
reset_world
eval "$("$SCRIPTS/claim-session.sh" 3712)" >/dev/null 2>&1
before_others=$(grep -cv "^$BLINK_UDID|" "$FAKE_DEVICES")
"$SCRIPTS/release-session.sh" 3712 --delete >/dev/null 2>&1
check "clean release exits zero" "0" "$?"
check "own device is gone" "" "$(device_state "$BLINK_UDID")"
check "every other device survives" "$before_others" "$(wc -l < "$FAKE_DEVICES" | tr -d ' ')"
check "port reservation is freed" "absent" \
  "$([ -d "$BLINK_SIM_REGISTRY/ports/$BLINK_PORT" ] && echo present || echo absent)"

# --- collateral damage detection --------------------------------------------
reset_world
eval "$("$SCRIPTS/claim-session.sh" 3712)" >/dev/null 2>&1
xcrun simctl shutdown USER-SIM                     # the mistake we must catch
out=$("$SCRIPTS/release-session.sh" 3712 --delete 2>&1); rc=$?
check "detects a foreign simulator was shut down" "1" "$rc"
check "names the damaged device" "yes" \
  "$(echo "$out" | grep -q "iPhone 16 Pro" && echo yes || echo no)"

# --- Metro is killed by PID, never by pattern -------------------------------
reset_world
eval "$("$SCRIPTS/claim-session.sh" 3712)" >/dev/null 2>&1
sleep 120 & OURS=$!;   STRAYS+=($OURS); disown $OURS 2>/dev/null
sleep 120 & THEIRS=$!; STRAYS+=($THEIRS); disown $THEIRS 2>/dev/null
echo "$OURS" > "$BLINK_SESSION_DIR/metro.pid"
"$SCRIPTS/release-session.sh" 3712 --delete >/dev/null 2>&1
sleep 0.5
check "stops the Metro it recorded" "gone" \
  "$(kill -0 $OURS 2>/dev/null && echo alive || echo gone)"
check "leaves another agent's process alone" "alive" \
  "$(kill -0 $THEIRS 2>/dev/null && echo alive || echo gone)"

# --- release without a claim ------------------------------------------------
"$SCRIPTS/release-session.sh" 9999 >/dev/null 2>&1
check "release without a claim fails loudly" "1" "$?"

echo
echo "24h retention"

# --- default release keeps the device and stamps it for the reaper ----------
reset_world
eval "$("$SCRIPTS/claim-session.sh" 3712)" >/dev/null 2>&1
"$SCRIPTS/release-session.sh" 3712 >/dev/null 2>&1
check "default release keeps the device" "Shutdown" "$(device_state "$BLINK_UDID")"
check "default release stamps released-at" "present" \
  "$([ -f "$BLINK_SESSION_DIR/released-at" ] && echo present || echo absent)"

# --- re-claim within the TTL clears the stamp -------------------------------
eval "$("$SCRIPTS/claim-session.sh" 3712)" >/dev/null 2>&1
check "re-claim clears the released-at stamp" "absent" \
  "$([ -f "$BLINK_SESSION_DIR/released-at" ] && echo present || echo absent)"
check "re-claim within the TTL reuses the kept device" "Booted" "$(device_state "$BLINK_UDID")"

# --- reaper removes only expired sessions -----------------------------------
reset_world
eval "$("$SCRIPTS/claim-session.sh" 3712)" >/dev/null 2>&1
FRESH_UDID="$BLINK_UDID"; FRESH_DIR="$BLINK_SESSION_DIR"
"$SCRIPTS/release-session.sh" 3712 >/dev/null 2>&1
eval "$("$SCRIPTS/claim-session.sh" 4113)" >/dev/null 2>&1
STALE_UDID="$BLINK_UDID"; STALE_DIR="$BLINK_SESSION_DIR"
"$SCRIPTS/release-session.sh" 4113 >/dev/null 2>&1
echo 1 > "$STALE_DIR/released-at"                  # expired long ago
"$SCRIPTS/reap-stale.sh" >/dev/null 2>&1
check "reaper deletes the expired device" "" "$(device_state "$STALE_UDID")"
check "reaper removes the expired session dir" "absent" \
  "$([ -d "$STALE_DIR" ] && echo present || echo absent)"
check "reaper keeps a session inside the TTL" "Shutdown" "$(device_state "$FRESH_UDID")"
check "reaper leaves the user's simulator alone" "Booted" "$(device_state USER-SIM)"

# --- reaper never deletes a device it does not own --------------------------
reset_world
eval "$("$SCRIPTS/claim-session.sh" 3712)" >/dev/null 2>&1
"$SCRIPTS/release-session.sh" 3712 >/dev/null 2>&1
echo 1 > "$BLINK_SESSION_DIR/released-at"
echo "OTHER-AGENT" > "$BLINK_SESSION_DIR/udid"     # manifest points at someone else
"$SCRIPTS/reap-stale.sh" >/dev/null 2>&1
check "reaper refuses a device named for another PR" "Booted" "$(device_state OTHER-AGENT)"

# --- reaper never deletes a booted device -----------------------------------
reset_world
eval "$("$SCRIPTS/claim-session.sh" 3712)" >/dev/null 2>&1
"$SCRIPTS/release-session.sh" 3712 >/dev/null 2>&1
echo 1 > "$BLINK_SESSION_DIR/released-at"
xcrun simctl boot "$BLINK_UDID"                    # someone re-booted it out of band
"$SCRIPTS/reap-stale.sh" >/dev/null 2>&1
check "reaper skips a booted device" "Booted" "$(device_state "$BLINK_UDID")"

# --- claiming any session sweeps other PRs' expired ones --------------------
reset_world
eval "$("$SCRIPTS/claim-session.sh" 3712)" >/dev/null 2>&1
EXPIRED_UDID="$BLINK_UDID"
"$SCRIPTS/release-session.sh" 3712 >/dev/null 2>&1
echo 1 > "$BLINK_SIM_REGISTRY/pr3712/released-at"
eval "$("$SCRIPTS/claim-session.sh" 4113)" >/dev/null 2>&1
check "claim sweeps expired sessions from other PRs" "" "$(device_state "$EXPIRED_UDID")"

# --- --delete leaves no session dir behind ----------------------------------
reset_world
eval "$("$SCRIPTS/claim-session.sh" 3712)" >/dev/null 2>&1
"$SCRIPTS/release-session.sh" 3712 --delete >/dev/null 2>&1
check "--delete removes the session dir too" "absent" \
  "$([ -d "$BLINK_SIM_REGISTRY/pr3712" ] && echo present || echo absent)"

echo
echo "build lock"

rm -rf "$BLINK_SIM_REGISTRY/locks"
: > "$WORK/order.log"
"$SCRIPTS/with-lock.sh" native-build 30 bash -c 'echo A-in >> '"$WORK"'/order.log; sleep 2; echo A-out >> '"$WORK"'/order.log' &
LOCK_A=$!
sleep 0.5
"$SCRIPTS/with-lock.sh" native-build 30 bash -c 'echo B-in >> '"$WORK"'/order.log' >/dev/null 2>&1
wait "$LOCK_A" 2>/dev/null   # scoped: a bare `wait` would also block on the decoy sleeps above
check "second holder waits for the first" "A-in A-out B-in" "$(tr '\n' ' ' < "$WORK/order.log" | sed 's/ $//')"

rm -rf "$BLINK_SIM_REGISTRY/locks"
mkdir -p "$BLINK_SIM_REGISTRY/locks/native-build"
echo 999999 > "$BLINK_SIM_REGISTRY/locks/native-build/pid"   # PID that cannot exist
"$SCRIPTS/with-lock.sh" native-build 15 true >/dev/null 2>&1
check "reclaims a lock from a dead holder" "0" "$?"

rm -rf "$BLINK_SIM_REGISTRY/locks"
mkdir -p "$BLINK_SIM_REGISTRY/locks/held"
echo $$ > "$BLINK_SIM_REGISTRY/locks/held/pid"               # this test process: alive
"$SCRIPTS/with-lock.sh" held 12 true >/dev/null 2>&1
check "times out rather than hanging forever" "1" "$?"

rm -rf "$BLINK_SIM_REGISTRY/locks"
"$SCRIPTS/with-lock.sh" native-build 10 false >/dev/null 2>&1
check "releases the lock when the command fails" "absent" \
  "$([ -d "$BLINK_SIM_REGISTRY/locks/native-build" ] && echo present || echo absent)"

echo
echo "-------------------------------------"
printf '%d passed, %d failed\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
