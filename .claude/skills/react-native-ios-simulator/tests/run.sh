#!/bin/bash
# Integration tests for the session-isolation scripts.
#
# Run after editing anything in ../scripts/. Exits non-zero on any failure.
# Creates no real simulators: a fake `xcrun` is placed first on PATH, and the
# session registry is redirected into a temp dir via DEMO_SIM_REGISTRY.
#
#   ./tests/run.sh          # quiet
#   VERBOSE=1 ./tests/run.sh

set -uo pipefail

TESTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS="$TESTS_DIR/../scripts"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/rn-ios-sim-tests.XXXXXX")"

export PATH="$TESTS_DIR/fixtures/bin:$PATH"
export FAKE_DEVICES="$WORK/devices.txt"
export DEMO_SIM_REGISTRY="$WORK/registry"
export FAKE_ARGS_LOG="$WORK/xcrun-args.log"
export FAKE_APP_ROOT="$WORK/app-root"
unset DEMO_APP_ID_IOS DEMO_SIM_PREFIX 2>/dev/null || true

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
  rm -rf "$DEMO_SIM_REGISTRY"
  : > "$FAKE_ARGS_LOG"
  printf 'USER-SIM|iPhone 16 Pro|Booted\nOTHER-AGENT|rn-demo-pr999|Booted\n' > "$FAKE_DEVICES"
}

booted() { grep -c '|Booted$' "$FAKE_DEVICES" 2>/dev/null || echo 0; }
device_state() { awk -F'|' -v u="$1" '$1==u {print $3}' "$FAKE_DEVICES"; }

echo
echo "session claim/release"

# --- claim ------------------------------------------------------------------
reset_world
out=$("$SCRIPTS/claim-session.sh" 3712 2>&1) && eval "$out"
check "claims a port in the reserved range" "yes" \
  "$([ "${DEMO_PORT:-0}" -ge 8100 ] && [ "${DEMO_PORT:-0}" -le 8499 ] && echo yes || echo "no (${DEMO_PORT:-unset})")"
check "names the simulator after the PR" "rn-demo-pr3712" "${DEMO_SIM_NAME:-unset}"
check "boots the simulator it created" "Booted" "$(device_state "${DEMO_UDID:-x}")"

PORT_1="$DEMO_PORT"; UDID_1="$DEMO_UDID"

# --- idempotency ------------------------------------------------------------
eval "$("$SCRIPTS/claim-session.sh" 3712)"
check "re-claim returns the same port" "$PORT_1" "$DEMO_PORT"
check "re-claim reuses the same device" "$UDID_1" "$DEMO_UDID"

# --- port collision ---------------------------------------------------------
# 3712 and 4112 hash to the same base port; the second must be pushed off it.
eval "$("$SCRIPTS/claim-session.sh" 4112)"
check "colliding PRs get distinct ports" "different" \
  "$([ "$DEMO_PORT" != "$PORT_1" ] && echo different || echo "same ($DEMO_PORT)")"

check "never reserves the user's 8081" "absent" \
  "$([ -d "$DEMO_SIM_REGISTRY/ports/8081" ] && echo present || echo absent)"

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
  "$([ "$DEMO_PORT" != "8212" ] && echo skipped || echo "took 8212 anyway")"
kill "$BINDER" 2>/dev/null

# --- rejects nonsense -------------------------------------------------------
"$SCRIPTS/claim-session.sh" not-a-number >/dev/null 2>&1
check "rejects a non-numeric PR number" "1" "$?"

echo
echo "release safety"

# --- ownership gate ---------------------------------------------------------
reset_world
eval "$("$SCRIPTS/claim-session.sh" 3712)" >/dev/null 2>&1
echo "OTHER-AGENT" > "$DEMO_SESSION_DIR/udid"     # manifest points at someone else
"$SCRIPTS/release-session.sh" 3712 --delete >/dev/null 2>&1
check "refuses a device not named for this PR" "1" "$?"
check "the other agent's simulator survives" "Booted" "$(device_state OTHER-AGENT)"

# --- clean release ----------------------------------------------------------
reset_world
eval "$("$SCRIPTS/claim-session.sh" 3712)" >/dev/null 2>&1
before_others=$(grep -cv "^$DEMO_UDID|" "$FAKE_DEVICES")
"$SCRIPTS/release-session.sh" 3712 --delete >/dev/null 2>&1
check "clean release exits zero" "0" "$?"
check "own device is gone" "" "$(device_state "$DEMO_UDID")"
check "every other device survives" "$before_others" "$(wc -l < "$FAKE_DEVICES" | tr -d ' ')"
check "port reservation is freed" "absent" \
  "$([ -d "$DEMO_SIM_REGISTRY/ports/$DEMO_PORT" ] && echo present || echo absent)"

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
echo "$OURS" > "$DEMO_SESSION_DIR/metro.pid"
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
echo "72h retention"

# --- default release keeps the device and stamps it for the reaper ----------
reset_world
eval "$("$SCRIPTS/claim-session.sh" 3712)" >/dev/null 2>&1
"$SCRIPTS/release-session.sh" 3712 >/dev/null 2>&1
check "default release keeps the device" "Shutdown" "$(device_state "$DEMO_UDID")"
check "default release stamps released-at" "present" \
  "$([ -f "$DEMO_SESSION_DIR/released-at" ] && echo present || echo absent)"

# --- re-claim within the TTL clears the stamp -------------------------------
eval "$("$SCRIPTS/claim-session.sh" 3712)" >/dev/null 2>&1
check "re-claim clears the released-at stamp" "absent" \
  "$([ -f "$DEMO_SESSION_DIR/released-at" ] && echo present || echo absent)"
check "re-claim within the TTL reuses the kept device" "Booted" "$(device_state "$DEMO_UDID")"

# --- the 72h default is real, not just documented ----------------------------
# Every other retention test ages a stamp with `echo 1` (expired under ANY
# ttl), so these two are the only assertions that notice the default silently
# reverting to 24h (48h-old must survive) or drifting to forever (73h-old
# must not).
reset_world
eval "$("$SCRIPTS/claim-session.sh" 3712)" >/dev/null 2>&1
"$SCRIPTS/release-session.sh" 3712 >/dev/null 2>&1
echo $(( $(date +%s) - 48 * 3600 )) > "$DEMO_SESSION_DIR/released-at"
"$SCRIPTS/reap-stale.sh" >/dev/null 2>&1
check "a session released 48h ago survives the default TTL" "Shutdown" \
  "$(device_state "$DEMO_UDID")"
echo $(( $(date +%s) - 73 * 3600 )) > "$DEMO_SESSION_DIR/released-at"
"$SCRIPTS/reap-stale.sh" >/dev/null 2>&1
check "a session released 73h ago is reaped" "" "$(device_state "$DEMO_UDID")"

# --- DEMO_SIM_TTL_HOURS still overrides the default --------------------------
reset_world
eval "$("$SCRIPTS/claim-session.sh" 3712)" >/dev/null 2>&1
"$SCRIPTS/release-session.sh" 3712 >/dev/null 2>&1
echo $(( $(date +%s) - 2 * 3600 )) > "$DEMO_SESSION_DIR/released-at"
DEMO_SIM_TTL_HOURS=1 "$SCRIPTS/reap-stale.sh" >/dev/null 2>&1
check "DEMO_SIM_TTL_HOURS=1 reaps a 2h-old session" "" "$(device_state "$DEMO_UDID")"

# --- reaper removes only expired sessions -----------------------------------
reset_world
eval "$("$SCRIPTS/claim-session.sh" 3712)" >/dev/null 2>&1
FRESH_UDID="$DEMO_UDID"; FRESH_DIR="$DEMO_SESSION_DIR"
"$SCRIPTS/release-session.sh" 3712 >/dev/null 2>&1
eval "$("$SCRIPTS/claim-session.sh" 4113)" >/dev/null 2>&1
STALE_UDID="$DEMO_UDID"; STALE_DIR="$DEMO_SESSION_DIR"
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
echo 1 > "$DEMO_SESSION_DIR/released-at"
echo "OTHER-AGENT" > "$DEMO_SESSION_DIR/udid"     # manifest points at someone else
"$SCRIPTS/reap-stale.sh" >/dev/null 2>&1
check "reaper refuses a device named for another PR" "Booted" "$(device_state OTHER-AGENT)"

# --- reaper never deletes a booted device -----------------------------------
reset_world
eval "$("$SCRIPTS/claim-session.sh" 3712)" >/dev/null 2>&1
"$SCRIPTS/release-session.sh" 3712 >/dev/null 2>&1
echo 1 > "$DEMO_SESSION_DIR/released-at"
xcrun simctl boot "$DEMO_UDID"                    # someone re-booted it out of band
"$SCRIPTS/reap-stale.sh" >/dev/null 2>&1
check "reaper skips a booted device" "Booted" "$(device_state "$DEMO_UDID")"

# --- claiming any session sweeps other PRs' expired ones --------------------
reset_world
eval "$("$SCRIPTS/claim-session.sh" 3712)" >/dev/null 2>&1
EXPIRED_UDID="$DEMO_UDID"
"$SCRIPTS/release-session.sh" 3712 >/dev/null 2>&1
echo 1 > "$DEMO_SIM_REGISTRY/rn-demo-pr3712/released-at"
eval "$("$SCRIPTS/claim-session.sh" 4113)" >/dev/null 2>&1
check "claim sweeps expired sessions from other PRs" "" "$(device_state "$EXPIRED_UDID")"

# --- --delete leaves no session dir behind ----------------------------------
reset_world
eval "$("$SCRIPTS/claim-session.sh" 3712)" >/dev/null 2>&1
"$SCRIPTS/release-session.sh" 3712 --delete >/dev/null 2>&1
check "--delete removes the session dir too" "absent" \
  "$([ -d "$DEMO_SIM_REGISTRY/rn-demo-pr3712" ] && echo present || echo absent)"

echo
echo "configurable naming and app identity"

# --- custom DEMO_SIM_PREFIX names and guards consistently ---------------------
reset_world
eval "$(DEMO_SIM_PREFIX=acme "$SCRIPTS/claim-session.sh" 500)" >/dev/null 2>&1
check "custom prefix names the simulator" "acme-pr500" "$DEMO_SIM_NAME"
DEMO_SIM_PREFIX=acme "$SCRIPTS/release-session.sh" 500 --delete >/dev/null 2>&1
check "release with the same prefix succeeds" "0" "$?"

reset_world
eval "$(DEMO_SIM_PREFIX=acme "$SCRIPTS/claim-session.sh" 501)" >/dev/null 2>&1
"$SCRIPTS/release-session.sh" 501 --delete >/dev/null 2>&1
check "release under the wrong prefix refuses (session is keyed by prefix)" "1" "$?"
check "the wrong-prefix device survives the refused release" "Booted" "$(device_state "$DEMO_UDID")"
DEMO_SIM_PREFIX=acme "$SCRIPTS/release-session.sh" 501 --delete >/dev/null 2>&1

# --- two repos, same PR number: sessions never collide ------------------------
# The registry is shared machine-wide; the prefix is the only thing separating
# repo A's PR #700 from repo B's PR #700.
reset_world
eval "$(DEMO_SIM_PREFIX=repoa "$SCRIPTS/claim-session.sh" 700)" >/dev/null 2>&1
A_UDID="$DEMO_UDID"; A_DIR="$DEMO_SESSION_DIR"; A_PORT="$DEMO_PORT"
eval "$(DEMO_SIM_PREFIX=repob "$SCRIPTS/claim-session.sh" 700)" >/dev/null 2>&1
check "same PR in two repos gets distinct simulators" "different" \
  "$([ "$DEMO_UDID" != "$A_UDID" ] && echo different || echo "same ($DEMO_UDID)")"
check "same PR in two repos gets distinct session dirs" "different" \
  "$([ "$DEMO_SESSION_DIR" != "$A_DIR" ] && echo different || echo "same ($DEMO_SESSION_DIR)")"
check "same PR in two repos gets distinct ports" "different" \
  "$([ "$DEMO_PORT" != "$A_PORT" ] && echo different || echo "same ($DEMO_PORT)")"
DEMO_SIM_PREFIX=repob "$SCRIPTS/release-session.sh" 700 --delete >/dev/null 2>&1
check "releasing repo B's session leaves repo A's simulator alone" "Booted" \
  "$(device_state "$A_UDID")"
DEMO_SIM_PREFIX=repoa "$SCRIPTS/release-session.sh" 700 --delete >/dev/null 2>&1

# --- the reaper honors the configured prefix ----------------------------------
reset_world
eval "$(DEMO_SIM_PREFIX=acme "$SCRIPTS/claim-session.sh" 502)" >/dev/null 2>&1
ACME_UDID="$DEMO_UDID"; ACME_DIR="$DEMO_SESSION_DIR"
DEMO_SIM_PREFIX=acme "$SCRIPTS/release-session.sh" 502 >/dev/null 2>&1
echo 1 > "$ACME_DIR/released-at"
"$SCRIPTS/reap-stale.sh" >/dev/null 2>&1
check "the default-prefix reaper skips a foreign-prefix device" "Shutdown" "$(device_state "$ACME_UDID")"
DEMO_SIM_PREFIX=acme "$SCRIPTS/reap-stale.sh" >/dev/null 2>&1
check "the same-prefix reaper deletes the expired device" "" "$(device_state "$ACME_UDID")"

# --- Metro redirect persists only with an app id ------------------------------
reset_world
eval "$(DEMO_APP_ID_IOS=com.example.demoapp "$SCRIPTS/claim-session.sh" 610)" >/dev/null 2>&1
check "claim persists the Metro redirect for the configured app id" "yes" \
  "$(grep -q "spawn $DEMO_UDID defaults write com.example.demoapp RCT_jsLocation localhost:$DEMO_PORT" "$FAKE_ARGS_LOG" && echo yes || echo no)"
"$SCRIPTS/release-session.sh" 610 --delete >/dev/null 2>&1

reset_world
eval "$("$SCRIPTS/claim-session.sh" 611)" >/dev/null 2>&1
check "claim without DEMO_APP_ID_IOS skips the defaults write" "no" \
  "$(grep -q "defaults write" "$FAKE_ARGS_LOG" && echo yes || echo no)"
"$SCRIPTS/release-session.sh" 611 --delete >/dev/null 2>&1

echo
echo "app reset (fresh-install simulation)"

APP_SRC="$WORK/SampleApp.app"           # a bundle as it would exist on the device
mkdir -p "$APP_SRC"; echo "com.example.demoapp" > "$APP_SRC/fake-bundle-id"

# --- refuses without a udid ---------------------------------------------------
reset_world
out=$(DEMO_UDID= "$SCRIPTS/reset-app.sh" --app-id com.example.demoapp 2>&1); rc=$?
check "reset refuses without a udid" "1" "$rc"
check "reset explains the booted-device hazard" "yes" \
  "$(echo "$out" | grep -qi "booted" && echo yes || echo no)"

# --- refuses a device it does not own ----------------------------------------
# The user's sim gets a real app container first, so the ONLY thing that can
# fail this reset is the ownership guard — without that setup the check passes
# vacuously on the later "app not installed" error (found by mutation check).
reset_world
eval "$("$SCRIPTS/claim-session.sh" 620)" >/dev/null 2>&1
mkdir -p "$FAKE_APP_ROOT/USER-SIM"
cp -R "$APP_SRC" "$FAKE_APP_ROOT/USER-SIM/com.example.demoapp.app"
out=$(DEMO_UDID=USER-SIM DEMO_SESSION_DIR="$DEMO_SESSION_DIR" DEMO_PORT="$DEMO_PORT" \
  "$SCRIPTS/reset-app.sh" --app-id com.example.demoapp 2>&1); rc=$?
check "reset refuses the user's simulator" "1" "$rc"
check "the refusal names the ownership rule, not a later failure" "yes" \
  "$(echo "$out" | grep -q "refusing" && echo yes || echo no)"
check "the user's app was not uninstalled by the refused reset" "present" \
  "$([ -d "$FAKE_APP_ROOT/USER-SIM/com.example.demoapp.app" ] && echo present || echo absent)"
rm -rf "$FAKE_APP_ROOT/USER-SIM"
"$SCRIPTS/release-session.sh" 620 --delete >/dev/null 2>&1

# --- refuses without an app id ------------------------------------------------
reset_world
eval "$("$SCRIPTS/claim-session.sh" 621)" >/dev/null 2>&1
DEMO_APP_ID_IOS= "$SCRIPTS/reset-app.sh" >/dev/null 2>&1
check "reset refuses without an app id" "1" "$?"
"$SCRIPTS/release-session.sh" 621 --delete >/dev/null 2>&1

# --- happy path: cache, uninstall-then-install, redirect re-persisted ---------
reset_world
eval "$("$SCRIPTS/claim-session.sh" 622)" >/dev/null 2>&1
mkdir -p "$FAKE_APP_ROOT/$DEMO_UDID"
cp -R "$APP_SRC" "$FAKE_APP_ROOT/$DEMO_UDID/com.example.demoapp.app"
: > "$FAKE_ARGS_LOG"
"$SCRIPTS/reset-app.sh" --app-id com.example.demoapp >/dev/null 2>&1
check "reset exits zero on the happy path" "0" "$?"
check "reset caches the bundle in the session dir" "present" \
  "$([ -d "$DEMO_SESSION_DIR/app-cache/com.example.demoapp.app" ] && echo present || echo absent)"
UNINSTALL_LINE=$(grep -n "uninstall $DEMO_UDID com.example.demoapp" "$FAKE_ARGS_LOG" | head -1 | cut -d: -f1)
INSTALL_LINE=$(grep -n "install $DEMO_UDID" "$FAKE_ARGS_LOG" | grep -v uninstall | head -1 | cut -d: -f1)
check "uninstall precedes install" "yes" \
  "$([ -n "$UNINSTALL_LINE" ] && [ -n "$INSTALL_LINE" ] && [ "$UNINSTALL_LINE" -lt "$INSTALL_LINE" ] && echo yes || echo "no (u=$UNINSTALL_LINE i=$INSTALL_LINE)")"
check "reset re-persists the Metro redirect" "yes" \
  "$(grep -q "spawn $DEMO_UDID defaults write com.example.demoapp RCT_jsLocation localhost:$DEMO_PORT" "$FAKE_ARGS_LOG" && echo yes || echo no)"
check "the app is installed again afterwards" "present" \
  "$([ -d "$FAKE_APP_ROOT/$DEMO_UDID/com.example.demoapp.app" ] && echo present || echo absent)"

# --- flag-less invocation: env fallbacks carry udid and app id ----------------
: > "$FAKE_ARGS_LOG"
DEMO_APP_ID_IOS=com.example.demoapp "$SCRIPTS/reset-app.sh" >/dev/null 2>&1
check "reset resolves the app id from DEMO_APP_ID_IOS" "0" "$?"
check "env-resolved reset re-persisted the redirect" "yes" \
  "$(grep -q "defaults write com.example.demoapp" "$FAKE_ARGS_LOG" && echo yes || echo no)"

# --- --udid overrides the session env -----------------------------------------
: > "$FAKE_ARGS_LOG"
DEMO_UDID= "$SCRIPTS/reset-app.sh" --udid "$DEMO_UDID" --app-id com.example.demoapp >/dev/null 2>&1 \
  || true   # $DEMO_UDID is empty in that subshell; capture the real one first
RESET_UDID="$DEMO_UDID"
DEMO_UDID= DEMO_SESSION_DIR="$DEMO_SESSION_DIR" DEMO_PORT="$DEMO_PORT" \
  "$SCRIPTS/reset-app.sh" --udid "$RESET_UDID" --app-id com.example.demoapp >/dev/null 2>&1
check "reset accepts --udid in place of the env var" "0" "$?"

# --- reinstalls from cache when the device lost the app -----------------------
rm -rf "$FAKE_APP_ROOT/$DEMO_UDID/com.example.demoapp.app"
"$SCRIPTS/reset-app.sh" --app-id com.example.demoapp >/dev/null 2>&1
check "reset falls back to the cached bundle" "present" \
  "$([ -d "$FAKE_APP_ROOT/$DEMO_UDID/com.example.demoapp.app" ] && echo present || echo absent)"

# --- no port: still resets, warns, skips the defaults write -------------------
: > "$FAKE_ARGS_LOG"
out=$(DEMO_PORT= "$SCRIPTS/reset-app.sh" --app-id com.example.demoapp 2>&1); rc=$?
check "reset without a port still succeeds" "0" "$rc"
check "reset without a port warns about the skipped redirect" "yes" \
  "$(echo "$out" | grep -qi "warning" && echo yes || echo no)"
check "reset without a port writes no defaults" "no" \
  "$(grep -q "defaults write" "$FAKE_ARGS_LOG" && echo yes || echo no)"
"$SCRIPTS/release-session.sh" 622 --delete >/dev/null 2>&1

echo
echo "telemetry (lib/telemetry.sh)"

TEL="$TESTS_DIR/../lib/telemetry.sh"
TEL_TEST_DIR="$WORK/telemetry"
spans_file() { ls "$1"/spans-*.jsonl 2>/dev/null | head -1; }
span_lines() { cat "$(spans_file "$1")" 2>/dev/null; }

# --- tel_span is transparent -------------------------------------------------
rm -rf "$TEL_TEST_DIR"
out=$(DEMO_TELEMETRY_DIR="$TEL_TEST_DIR" bash -c '
  . "'"$TEL"'"
  tel_span test.span k=v -- bash -c "echo real-out; echo real-err >&2; exit 3"
' 2>"$WORK/tel-err.txt"); rc=$?
check "tel_span preserves the exit code" "3" "$rc"
check "tel_span preserves stdout" "real-out" "$out"
check "tel_span preserves stderr" "real-err" "$(cat "$WORK/tel-err.txt")"
check "one span, one line" "1" "$(span_lines "$TEL_TEST_DIR" | wc -l | tr -d ' ')"
check "the line is valid v1 JSON with every schema key" "yes" \
  "$(span_lines "$TEL_TEST_DIR" | python3 -c '
import json, sys
r = json.loads(sys.stdin.readline())
need = {"v","ts","dur_ms","span","skill","session","run_id","rev","ok","meta"}
ok = r["v"] == 1 and need <= set(r) and r["skill"] == "test" and r["ok"] is False and r["meta"]["rc"] == 3
print("yes" if ok else "no")' 2>/dev/null)"

# --- the unit trap: seconds-vs-ms is the classic telemetry bug ---------------
rm -rf "$TEL_TEST_DIR"
DEMO_TELEMETRY_DIR="$TEL_TEST_DIR" bash -c '. "'"$TEL"'"; tel_span test.sleep -- sleep 0.5' >/dev/null 2>&1
DUR=$(span_lines "$TEL_TEST_DIR" | python3 -c 'import json,sys; print(json.loads(sys.stdin.readline())["dur_ms"])' 2>/dev/null)
check "a 0.5s span records dur_ms in [400,5000]" "yes" \
  "$([ -n "$DUR" ] && [ "$DUR" -ge 400 ] && [ "$DUR" -le 5000 ] && echo yes || echo "no ($DUR)")"

# --- concurrent writers never tear each other's lines ------------------------
rm -rf "$TEL_TEST_DIR"
for i in $(seq 20); do
  DEMO_TELEMETRY_DIR="$TEL_TEST_DIR" bash -c '
    . "'"$TEL"'"
    for j in 1 2 3 4 5 6 7 8 9 10; do t0=$(tel_now); tel_emit test.par "$t0" writer='"$i"' seq=$j; done
  ' &
done
wait
check "20 writers x 10 spans -> exactly 200 lines" "200" \
  "$(span_lines "$TEL_TEST_DIR" | wc -l | tr -d ' ')"
check "every concurrent line parses" "200" \
  "$(span_lines "$TEL_TEST_DIR" | python3 -c '
import json, sys
print(sum(1 for l in sys.stdin if l.strip() and json.loads(l)))' 2>/dev/null)"

# --- kill switch -------------------------------------------------------------
rm -rf "$TEL_TEST_DIR"
DEMO_TELEMETRY=0 DEMO_TELEMETRY_DIR="$TEL_TEST_DIR" bash -c '. "'"$TEL"'"; tel_span test.off -- true' >/dev/null 2>&1
check "DEMO_TELEMETRY=0 runs the command" "0" "$?"
check "DEMO_TELEMETRY=0 writes nothing" "absent" \
  "$([ -d "$TEL_TEST_DIR" ] && echo present || echo absent)"

# --- failure isolation: telemetry may never fail the caller ------------------
# The instrumented scripts run set -euo pipefail; an unwritable telemetry dir
# has to degrade to silence, not abort a claim.
rm -rf "$TEL_TEST_DIR"; mkdir -p "$TEL_TEST_DIR"; chmod 0500 "$TEL_TEST_DIR"
DEMO_TELEMETRY_DIR="$TEL_TEST_DIR" bash -c '
  set -euo pipefail
  . "'"$TEL"'"
  t0=$(tel_now); tel_emit test.blocked "$t0"; tel_span test.blocked2 -- true
  echo survived
' > "$WORK/tel-iso.txt" 2>&1
check "an unwritable telemetry dir cannot fail a set -e caller" "0" "$?"
check "the caller actually ran to completion" "survived" "$(cat "$WORK/tel-iso.txt")"
chmod 0700 "$TEL_TEST_DIR"

# --- claims survive a broken lib and work without one ------------------------
reset_world
SAVED_LIB="$WORK/telemetry.sh.saved"
cp "$TEL" "$SAVED_LIB"
echo "this is not bash {{{" > "$TESTS_DIR/../lib/telemetry.sh"
eval "$("$SCRIPTS/claim-session.sh" 730)" >/dev/null 2>&1
check "a syntactically broken lib does not break a claim" "0" "$?"
"$SCRIPTS/release-session.sh" 730 --delete >/dev/null 2>&1
rm "$TESTS_DIR/../lib/telemetry.sh"
eval "$("$SCRIPTS/claim-session.sh" 731)" >/dev/null 2>&1
check "an absent lib does not break a claim" "0" "$?"
"$SCRIPTS/release-session.sh" 731 --delete >/dev/null 2>&1
cp "$SAVED_LIB" "$TESTS_DIR/../lib/telemetry.sh"

# --- instrumented claims label origin from independent evidence --------------
reset_world
rm -rf "$DEMO_SIM_REGISTRY/telemetry"
eval "$("$SCRIPTS/claim-session.sh" 732)" >/dev/null 2>&1
ORIGIN_META=$(span_lines "$DEMO_SIM_REGISTRY/telemetry" | python3 -c '
import json, sys
for l in sys.stdin:
    r = json.loads(l)
    if r["span"] == "sim.claim.total":
        print(r["meta"].get("origin", "")); break' 2>/dev/null)
check "created claim emits origin=created, matching the session file" "yes" \
  "$([ "$ORIGIN_META" = "$(cat "$DEMO_SIM_REGISTRY/rn-demo-pr732/origin")" ] && [ "$ORIGIN_META" = "created" ] && echo yes || echo "no ($ORIGIN_META)")"
check "claim emits its sub-spans too" "yes" \
  "$(span_lines "$DEMO_SIM_REGISTRY/telemetry" | grep -q '"span":"sim.claim.boot"' && span_lines "$DEMO_SIM_REGISTRY/telemetry" | grep -q '"span":"sim.claim.reap"' && echo yes || echo no)"
"$SCRIPTS/release-session.sh" 732 >/dev/null 2>&1
check "a clean release emits its span" "yes" \
  "$(span_lines "$DEMO_SIM_REGISTRY/telemetry" | grep -q '"span":"sim.release.total"' && echo yes || echo no)"

mkdir -p "$FAKE_APP_ROOT"   # bless needs the app-root scaffolding from earlier sections
eval "$("$SCRIPTS/claim-session.sh" 733)" >/dev/null 2>&1
"$SCRIPTS/bless-golden.sh" 733 --sha tel111 --lockfile /dev/null 2>/dev/null >/dev/null
rm -rf "$DEMO_SIM_REGISTRY/telemetry"
eval "$("$SCRIPTS/claim-session.sh" 734)" >/dev/null 2>&1
ORIGIN_META=$(span_lines "$DEMO_SIM_REGISTRY/telemetry" | python3 -c '
import json, sys
for l in sys.stdin:
    r = json.loads(l)
    if r["span"] == "sim.claim.total":
        print(r["meta"].get("origin", "")); break' 2>/dev/null)
check "cloned claim emits origin=cloned-from-golden, matching the session file" "yes" \
  "$([ "$ORIGIN_META" = "$(cat "$DEMO_SIM_REGISTRY/rn-demo-pr734/origin")" ] && [ "$ORIGIN_META" = "cloned-from-golden" ] && echo yes || echo "no ($ORIGIN_META)")"
"$SCRIPTS/release-session.sh" 734 --delete >/dev/null 2>&1

echo
echo "native-build staleness stamp (native-stamp.sh)"

NS="$SCRIPTS/native-stamp.sh"
NS_APP="$WORK/lock-app"; mkdir -p "$NS_APP/ios"
echo "PODS v1" > "$NS_APP/ios/Podfile.lock"
NS_STAMP="$WORK/native-stamp"
echo "sha=abc" > "$NS_STAMP"

(cd "$NS_APP" && "$NS" write "$NS_STAMP") >/dev/null 2>&1
check "write records a podfile-lock-hash" "yes" \
  "$(grep -q '^podfile-lock-hash=' "$NS_STAMP" && echo yes || echo no)"
check "write preserves the stamp's other keys" "yes" \
  "$(grep -q '^sha=abc' "$NS_STAMP" && echo yes || echo no)"

(cd "$NS_APP" && "$NS" check "$NS_STAMP") >/dev/null 2>&1
check "check passes while the lockfile is unchanged" "0" "$?"

echo "PODS v2 - a native module renamed" > "$NS_APP/ios/Podfile.lock"
out=$(cd "$NS_APP" && "$NS" check "$NS_STAMP" 2>&1); rc=$?
check "check fails once the lockfile changed" "1" "$rc"
check "the failure says STALE and names Podfile.lock" "yes" \
  "$(echo "$out" | grep -q "STALE" && echo "$out" | grep -q "Podfile.lock" && echo yes || echo no)"

(cd "$NS_APP" && "$NS" write "$NS_STAMP") >/dev/null 2>&1
check "re-write replaces the hash line instead of stacking a second one" "1" \
  "$(grep -c '^podfile-lock-hash=' "$NS_STAMP" | tr -d ' ')"

# A stamp that cannot vouch for its build must fail, never pass vacuously.
echo "sha=abc" > "$NS_STAMP"
(cd "$NS_APP" && "$NS" check "$NS_STAMP") >/dev/null 2>&1
check "a stamp without a hash demands a re-stamp" "1" "$?"

"$NS" check "$NS_STAMP" --lockfile "$WORK/does-not-exist.lock" >/dev/null 2>&1
check "a missing lockfile is a loud failure, not a pass" "1" "$?"

echo
echo "golden simulator (bless + clone)"

# One world for the whole section: a golden is long-lived state by design.
reset_world
eval "$("$SCRIPTS/claim-session.sh" 700)" >/dev/null 2>&1
BLESS_UDID="$DEMO_UDID"; BLESS_PORT="$DEMO_PORT"
mkdir -p "$FAKE_APP_ROOT/$BLESS_UDID"
cp -R "$APP_SRC" "$FAKE_APP_ROOT/$BLESS_UDID/com.example.demoapp.app"
"$SCRIPTS/bless-golden.sh" 700 --sha abc123 >/dev/null 2>&1
check "bless exits zero" "0" "$?"
check "the blessed device carries the golden name" "rn-demo-golden" \
  "$(awk -F'|' -v u="$BLESS_UDID" '$1==u {print $2}' "$FAKE_DEVICES")"
check "the golden is left shutdown (clone requires it)" "Shutdown" \
  "$(device_state "$BLESS_UDID")"
GOLDEN_STAMP="$DEMO_SIM_REGISTRY/golden/rn-demo-golden/stamp"
check "the stamp records the build sha" "yes" \
  "$(grep -q '^sha=abc123' "$GOLDEN_STAMP" && echo yes || echo no)"
check "the stamp records the device type" "yes" \
  "$(grep -q '^device-type=iPhone 16 Pro' "$GOLDEN_STAMP" && echo yes || echo no)"
check "bless adopts the session - a later release finds nothing" "1" \
  "$("$SCRIPTS/release-session.sh" 700 >/dev/null 2>&1; echo $?)"
check "bless freed the session's port" "absent" \
  "$([ -d "$DEMO_SIM_REGISTRY/ports/$BLESS_PORT" ] && echo present || echo absent)"

# --- claim clones the golden instead of creating blank -----------------------
out=$("$SCRIPTS/claim-session.sh" 701) && eval "$out"
check "claim clones the golden's udid" "yes" \
  "$(grep -q "clone $BLESS_UDID rn-demo-pr701" "$FAKE_ARGS_LOG" && echo yes || echo no)"
check "the clone is named for the PR like any other session device" "Booted" \
  "$(device_state "$DEMO_UDID")"
check "the clone carries the golden's app container" "present" \
  "$([ -d "$FAKE_APP_ROOT/$DEMO_UDID/com.example.demoapp.app" ] && echo present || echo absent)"
check "claim output surfaces the golden stamp for staleness judgment" "yes" \
  "$(echo "$out" | grep -q "sha=abc123" && echo yes || echo no)"
"$SCRIPTS/release-session.sh" 701 --delete >/dev/null 2>&1
check "a cloned session releases cleanly" "0" "$?"
check "releasing the clone leaves the golden alone" "Shutdown" \
  "$(device_state "$BLESS_UDID")"

# --- the Metro redirect is persisted on clones too ---------------------------
: > "$FAKE_ARGS_LOG"
eval "$(DEMO_APP_ID_IOS=com.example.demoapp "$SCRIPTS/claim-session.sh" 702)" >/dev/null 2>&1
check "a cloned claim still persists the Metro redirect" "yes" \
  "$(grep -q "spawn $DEMO_UDID defaults write com.example.demoapp RCT_jsLocation localhost:$DEMO_PORT" "$FAKE_ARGS_LOG" && echo yes || echo no)"
"$SCRIPTS/release-session.sh" 702 --delete >/dev/null 2>&1

# --- every ineligibility falls back to a blank create ------------------------
# The fake's clone verb errors on a booted source, so this cannot pass against
# a clone that "succeeded" anyway.
xcrun simctl boot "$BLESS_UDID"
eval "$("$SCRIPTS/claim-session.sh" 703)" >/dev/null 2>&1
check "a booted golden falls back to create" "created" \
  "$(cat "$DEMO_SIM_REGISTRY/rn-demo-pr703/origin")"
"$SCRIPTS/release-session.sh" 703 --delete >/dev/null 2>&1
xcrun simctl shutdown "$BLESS_UDID"

eval "$("$SCRIPTS/claim-session.sh" 704 "iPhone SE (3rd generation)")" >/dev/null 2>&1
check "a device-type mismatch falls back to create (a clone would lie about hardware)" "created" \
  "$(cat "$DEMO_SIM_REGISTRY/rn-demo-pr704/origin")"
"$SCRIPTS/release-session.sh" 704 --delete >/dev/null 2>&1

eval "$("$SCRIPTS/claim-session.sh" 705 "iPhone 16 Pro" "iOS 18.6")" >/dev/null 2>&1
check "an explicit runtime mismatch falls back to create" "created" \
  "$(cat "$DEMO_SIM_REGISTRY/rn-demo-pr705/origin")"
"$SCRIPTS/release-session.sh" 705 --delete >/dev/null 2>&1

eval "$(DEMO_SIM_GOLDEN=none "$SCRIPTS/claim-session.sh" 706)" >/dev/null 2>&1
check "DEMO_SIM_GOLDEN=none disables cloning" "created" \
  "$(cat "$DEMO_SIM_REGISTRY/rn-demo-pr706/origin")"
"$SCRIPTS/release-session.sh" 706 --delete >/dev/null 2>&1

# --- the reaper never touches the golden -------------------------------------
# Including via a hostile session manifest pointing at the golden's udid: the
# reaper's name gate must hold for the golden exactly as for the user's sim.
eval "$("$SCRIPTS/claim-session.sh" 707)" >/dev/null 2>&1
"$SCRIPTS/release-session.sh" 707 >/dev/null 2>&1
echo 1 > "$DEMO_SIM_REGISTRY/rn-demo-pr707/released-at"
echo "$BLESS_UDID" > "$DEMO_SIM_REGISTRY/rn-demo-pr707/udid"
"$SCRIPTS/reap-stale.sh" >/dev/null 2>&1
check "the reaper refuses a manifest pointing at the golden" "Shutdown" \
  "$(device_state "$BLESS_UDID")"
rm -rf "$DEMO_SIM_REGISTRY/rn-demo-pr707"

# --- re-bless swaps atomically: exactly one golden survives ------------------
out=$("$SCRIPTS/claim-session.sh" 708) && eval "$out"
NEW_UDID="$DEMO_UDID"
"$SCRIPTS/bless-golden.sh" 708 --sha def456 >/dev/null 2>&1
check "re-bless exits zero" "0" "$?"
check "exactly one device carries the golden name after a re-bless" "1" \
  "$(awk -F'|' '$2=="rn-demo-golden"' "$FAKE_DEVICES" | wc -l | tr -d ' ')"
check "the new device is the golden now" "rn-demo-golden" \
  "$(awk -F'|' -v u="$NEW_UDID" '$1==u {print $2}' "$FAKE_DEVICES")"
check "the retired golden is deleted, not orphaned" "" \
  "$(device_state "$BLESS_UDID")"
check "the stamp now describes the new golden" "yes" \
  "$(grep -q '^sha=def456' "$GOLDEN_STAMP" && echo yes || echo no)"

# --- the stamp's lockfile hash gives claim an instant staleness verdict ------
VERDICT_APP="$WORK/verdict-app"; mkdir -p "$VERDICT_APP/ios"
echo "PODS blessed" > "$VERDICT_APP/ios/Podfile.lock"
"$NS" write "$GOLDEN_STAMP" --lockfile "$VERDICT_APP/ios/Podfile.lock" >/dev/null 2>&1
out=$(cd "$VERDICT_APP" && "$SCRIPTS/claim-session.sh" 709)
check "claim reports a matching native build from the worktree root" "yes" \
  "$(echo "$out" | grep -q "native build matches" && echo yes || echo no)"
(cd "$VERDICT_APP" && "$SCRIPTS/release-session.sh" 709 --delete) >/dev/null 2>&1

echo "PODS newer - native module changed" > "$VERDICT_APP/ios/Podfile.lock"
out=$(cd "$VERDICT_APP" && "$SCRIPTS/claim-session.sh" 712)
check "claim warns NATIVE BUILD STALE when the lockfile moved on" "yes" \
  "$(echo "$out" | grep -q "NATIVE BUILD STALE" && echo yes || echo no)"
(cd "$VERDICT_APP" && "$SCRIPTS/release-session.sh" 712 --delete) >/dev/null 2>&1

# --- bless records the lockfile hash in the stamp ----------------------------
out=$("$SCRIPTS/claim-session.sh" 713) && eval "$out"
"$SCRIPTS/bless-golden.sh" 713 --sha bbb222 --lockfile "$VERDICT_APP/ios/Podfile.lock" >/dev/null 2>&1
check "bless with a lockfile exits zero" "0" "$?"
check "the blessed stamp carries the lockfile hash" "yes" \
  "$(grep -q '^podfile-lock-hash=' "$GOLDEN_STAMP" && echo yes || echo no)"

echo
echo "credential precheck"

# The wall this removes: an agent discovering forty minutes into a session
# that the staging OTP was never set on this machine. Claim reports the gap
# up front - and never blocks, because most demos need no account at all.
reset_world
export FAKE_CRED_PRESENT=some-value
out=$(DEMO_REQUIRED_ENV="FAKE_CRED_PRESENT FAKE_CRED_ABSENT" "$SCRIPTS/claim-session.sh" 720); rc=$?
check "a claim with missing credentials still succeeds" "0" "$rc"
check "claim names each missing credential up front" "yes" \
  "$(echo "$out" | grep "missing credentials" | grep -q "FAKE_CRED_ABSENT" && echo yes || echo no)"
check "a present credential is not reported missing" "no" \
  "$(echo "$out" | grep "missing credentials" | grep -q "FAKE_CRED_PRESENT" && echo yes || echo no)"
"$SCRIPTS/release-session.sh" 720 --delete >/dev/null 2>&1

out=$(DEMO_REQUIRED_ENV="FAKE_CRED_PRESENT" "$SCRIPTS/claim-session.sh" 721)
check "no note when every required credential is present" "no" \
  "$(echo "$out" | grep -q "missing credentials" && echo yes || echo no)"
"$SCRIPTS/release-session.sh" 721 --delete >/dev/null 2>&1
unset FAKE_CRED_PRESENT

# --- bless safety gates ------------------------------------------------------
reset_world
eval "$("$SCRIPTS/claim-session.sh" 710)" >/dev/null 2>&1
echo "OTHER-AGENT" > "$DEMO_SESSION_DIR/udid"      # manifest points at someone else
"$SCRIPTS/bless-golden.sh" 710 >/dev/null 2>&1
check "bless refuses a device not named for the session" "1" "$?"
check "the foreign device survives the refused bless" "Booted" \
  "$(device_state OTHER-AGENT)"
rm -rf "$DEMO_SIM_REGISTRY/rn-demo-pr710"

"$SCRIPTS/bless-golden.sh" 9999 >/dev/null 2>&1
check "bless without a claimed session fails loudly" "1" "$?"

# The golden race window (a clone of a golden being swapped mid-bless) is
# closed by the shared lock; these go red if either side sheds it.
check "claim's clone step runs under the golden lock" "yes" \
  "$(grep -q 'with-lock.sh" golden' "$SCRIPTS/claim-session.sh" && echo yes || echo no)"
check "bless's swap runs under the golden lock" "yes" \
  "$(grep -q 'with-lock.sh" golden' "$SCRIPTS/bless-golden.sh" && echo yes || echo no)"

echo
echo "shared metro transform cache (metro-demo.config.js)"

DEMO_CFG="$SCRIPTS/metro-demo.config.js"

# The probe loads the wrapper the way Metro would and reports what came out.
# The stub store classes stand in for metro-cache, which the wrapper must only
# ever receive through the function-form cacheStores - never require itself.
cat > "$WORK/metro-probe.js" <<'EOF'
const cfg = require(process.argv[2])
const Stub = class { constructor(o) { this.root = o.root } }
const stores = typeof cfg.cacheStores === "function"
  ? cfg.cacheStores({ AutoCleanFileStore: Stub, FileStore: Stub })
  : []
console.log(JSON.stringify({
  sourceExts: (cfg.resolver || {}).sourceExts || [],
  transformerSentinel: (cfg.transformer || {}).sentinelField || "",
  asyncRequireModulePath: (cfg.transformer || {}).asyncRequireModulePath || "",
  storeCount: stores.length,
  root: stores.length ? stores[0].root : "",
}))
EOF

FAKE_APP="$WORK/fake-app"
mkdir -p "$FAKE_APP"
cat > "$FAKE_APP/metro.config.js" <<'EOF'
module.exports = {
  resolver: { sourceExts: ["ts", "tsx", "svg-sentinel"] },
  transformer: {
    sentinelField: "transformer-sentinel",
    // Models what @react-native/metro-config really does: a require.resolve()d
    // per-worktree ABSOLUTE path. Hashed into the global transform-cache key,
    // it silently reduces cross-worktree sharing to zero.
    asyncRequireModulePath: "/private/tmp/some-worktree/node_modules/metro-runtime/src/modules/asyncRequire",
  },
}
EOF

out=$(cd "$FAKE_APP" && DEMO_METRO_CACHE_ROOT="$WORK/cache-root" node "$WORK/metro-probe.js" "$DEMO_CFG" 2>&1)
check "app config fields survive the demo wrapper" "yes" \
  "$(echo "$out" | grep -q "svg-sentinel" && echo yes || echo no)"
check "wrapper installs exactly one shared cache store" "yes" \
  "$(echo "$out" | grep -q '"storeCount":1' && echo yes || echo no)"
check "cache root honors DEMO_METRO_CACHE_ROOT" "yes" \
  "$(echo "$out" | grep -qF "\"root\":\"$WORK/cache-root\"" && echo yes || echo no)"
check "app transformer fields survive the wrapper" "yes" \
  "$(echo "$out" | grep -q "transformer-sentinel" && echo yes || echo no)"
# Verified live: with the app's absolute asyncRequireModulePath in the hashed
# transformer config, cross-worktree sharing was exactly 0%; pinned to the bare
# specifier, a second worktree's first bundle went from 39s to 4s.
check "asyncRequireModulePath is pinned to the worktree-independent specifier" "yes" \
  "$(echo "$out" | grep -q '"asyncRequireModulePath":"metro-runtime/src/modules/asyncRequire"' && echo yes || echo no)"

# The fixture app deliberately has no node_modules: together with the loads
# above this is what fails if anyone turns the function-form cacheStores into
# a top-level require of metro-cache.
check "fixture app carries no node_modules for the wrapper to lean on" "absent" \
  "$([ -d "$FAKE_APP/node_modules" ] && echo present || echo absent)"

out=$(cd "$FAKE_APP" && env -u DEMO_METRO_CACHE_ROOT node "$WORK/metro-probe.js" "$DEMO_CFG" 2>&1)
check "default cache root expands to an absolute path under \$HOME" "yes" \
  "$(echo "$out" | grep -qF "\"root\":\"$HOME/" && echo yes || echo no)"

EMPTY_APP="$WORK/empty-app"
mkdir -p "$EMPTY_APP"
out=$(cd "$EMPTY_APP" && node "$WORK/metro-probe.js" "$DEMO_CFG" 2>&1); rc=$?
check "wrapper fails loudly when cwd has no metro.config.js" "nonzero" \
  "$([ "$rc" -ne 0 ] && echo nonzero || echo zero)"
# Suffix match: node reports the symlink-resolved cwd (/private/var/...) while
# bash's $WORK keeps the /var/... spelling on macOS.
check "the failure names the missing config path" "yes" \
  "$(echo "$out" | grep -qF "empty-app/metro.config.js" && echo yes || echo no)"

FN_APP="$WORK/fn-app"
mkdir -p "$FN_APP"
echo "module.exports = () => ({})" > "$FN_APP/metro.config.js"
out=$(cd "$FN_APP" && node "$WORK/metro-probe.js" "$DEMO_CFG" 2>&1); rc=$?
check "wrapper refuses a function-form app config rather than dropping it" "nonzero" \
  "$([ "$rc" -ne 0 ] && echo nonzero || echo zero)"
check "the refusal says object-form only" "yes" \
  "$(echo "$out" | grep -qi "object" && echo yes || echo no)"

echo
echo "js reload flip (reload-app.sh)"

# One fake dev server per scenario: fresh port, fresh observation log.
start_ws_fake() { # start_ws_fake <mode>; sets WS_PORT, WS_LOG, WS_PID
  WS_LOG="$WORK/ws-$1.log"; : > "$WS_LOG"
  rm -f "$WORK/ws-port"
  FAKE_WS_MODE="$1" FAKE_WS_LOG="$WS_LOG" FAKE_WS_PORT_FILE="$WORK/ws-port" \
    python3 "$TESTS_DIR/fixtures/ws-fake.py" &
  WS_PID=$!; STRAYS+=($WS_PID); disown $WS_PID 2>/dev/null
  for _ in $(seq 50); do [ -s "$WORK/ws-port" ] && break; sleep 0.1; done
  WS_PORT=$(cat "$WORK/ws-port" 2>/dev/null || echo "")
}

# --- happy path: broadcast on /message, confirmation via /events -------------
start_ws_fake bundle-done
"$SCRIPTS/reload-app.sh" --port "$WS_PORT" --timeout 10 >/dev/null 2>&1
check "reload exits zero once bundle activity is observed" "0" "$?"
check "the broadcast lands on /message after a real handshake" "yes" \
  "$(grep -q "^connect /message" "$WS_LOG" && echo yes || echo no)"
check "the confirmation listener opens /events" "yes" \
  "$(grep -q "^connect /events" "$WS_LOG" && echo yes || echo no)"
FRAME=$(grep "^frame path=/message" "$WS_LOG" | head -1)
check "payload is the version-2 reload method" "yes" \
  "$(echo "$FRAME" | grep -q '"method": "reload"' && echo "$FRAME" | grep -q '"version": 2' && echo yes || echo no)"
check "payload carries no id/target (broadcast, not a directed request)" "yes" \
  "$(echo "$FRAME" | grep -qv '"id"' && echo "$FRAME" | grep -qv '"target"' && echo yes || echo no)"
check "the client frame is masked as RFC 6455 requires" "yes" \
  "$(echo "$FRAME" | grep -q "masked=1" && echo yes || echo no)"
kill "$WS_PID" 2>/dev/null

# --- no app connected: the silent-no-op broadcast must not report success ----
# This is the assertion that dies if the /events wait is ever skipped: a
# fire-and-forget mutant exits 0 here and ships identical before/after pairs.
start_ws_fake silent
out=$("$SCRIPTS/reload-app.sh" --port "$WS_PORT" --timeout 3 2>&1); rc=$?
check "no bundle activity within the timeout fails the reload" "1" "$rc"
check "the failure points at the terminate+launch fallback" "yes" \
  "$(echo "$out" | grep -qi "terminate" && echo yes || echo no)"
kill "$WS_PID" 2>/dev/null

# --- a broken bundle is a failure, not a confirmed flip ----------------------
start_ws_fake bundle-fail
out=$("$SCRIPTS/reload-app.sh" --port "$WS_PORT" --timeout 10 2>&1); rc=$?
check "a failed bundle build fails the reload" "1" "$rc"
kill "$WS_PID" 2>/dev/null

# --- --no-wait is explicit fire-and-forget -----------------------------------
start_ws_fake silent
"$SCRIPTS/reload-app.sh" --port "$WS_PORT" --no-wait >/dev/null 2>&1
check "--no-wait fires the broadcast and exits zero unconfirmed" "0" "$?"
check "--no-wait still delivered the reload frame" "yes" \
  "$(for _ in $(seq 20); do grep -q "reload" "$WS_LOG" && break; sleep 0.1; done; grep -q "reload" "$WS_LOG" && echo yes || echo no)"
kill "$WS_PID" 2>/dev/null

# --- dead port and missing port fail fast, never hang ------------------------
FREE_PORT=$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()')
"$SCRIPTS/reload-app.sh" --port "$FREE_PORT" --timeout 3 >/dev/null 2>&1
check "nothing listening on the port is an immediate failure" "1" "$?"

out=$(DEMO_PORT= "$SCRIPTS/reload-app.sh" 2>&1); rc=$?
check "reload refuses to run without a port" "1" "$rc"
check "the refusal names the 8081 hazard" "yes" \
  "$(echo "$out" | grep -q "8081" && echo yes || echo no)"

echo
echo "documented behavior matches the scripts"

SKILL_MD="$TESTS_DIR/../SKILL.md"
check "SKILL.md documents the reload flip" "yes" \
  "$(grep -q "reload-app.sh" "$SKILL_MD" && echo yes || echo no)"
check "SKILL.md documents the golden bless workflow" "yes" \
  "$(grep -q "bless-golden.sh" "$SKILL_MD" && echo yes || echo no)"
check "SKILL.md ties golden staleness to the stamp sha" "yes" \
  "$(grep -qi "stamp" "$SKILL_MD" && grep -q "origin/main -- ios/" "$SKILL_MD" && echo yes || echo no)"
check "SKILL.md documents the native-stamp verdict" "yes" \
  "$(grep -q "native-stamp.sh" "$SKILL_MD" && echo yes || echo no)"
check "SKILL.md documents the credential precheck" "yes" \
  "$(grep -q "DEMO_REQUIRED_ENV" "$SKILL_MD" && echo yes || echo no)"
check "SKILL.md documents the 72h retention default" "yes" \
  "$(grep -q "72h" "$SKILL_MD" && echo yes || echo no)"
check "SKILL.md carries no stale 24h default" "no" \
  "$(grep -q "24h" "$SKILL_MD" && echo yes || echo no)"
check "SKILL.md step 4 starts Metro with the demo cache config" "yes" \
  "$(grep -q "metro-demo.config.js" "$SKILL_MD" && echo yes || echo no)"
check "SKILL.md forbids --reset-cache against the shared store" "yes" \
  "$(grep -q -- "--reset-cache" "$SKILL_MD" && echo yes || echo no)"
check "SKILL.md carries no BLINK_ residue" "no" \
  "$(grep -q "BLINK_" "$SKILL_MD" && echo yes || echo no)"
check "SKILL.md documents reset-app.sh for reinstall state" "yes" \
  "$(grep -q "reset-app.sh" "$SKILL_MD" && echo yes || echo no)"
check "SKILL.md documents stubbing the hook that reads server-only state" "yes" \
  "$(grep -qi "stub.*hook" "$SKILL_MD" && echo yes || echo no)"
check "SKILL.md documents the on-screen visible-debug technique" "yes" \
  "$(grep -q "JSON.stringify" "$SKILL_MD" && echo yes || echo no)"
check "SKILL.md documents the maestro hierarchy diagnosis" "yes" \
  "$(grep -q "maestro hierarchy" "$SKILL_MD" && echo yes || echo no)"
check "SKILL.md documents the coordinate-tap fallback" "yes" \
  "$(grep -q 'point:' "$SKILL_MD" && echo yes || echo no)"
check "SKILL.md warns Appium selectors do not transfer" "yes" \
  "$(grep -qi "appium" "$SKILL_MD" && echo yes || echo no)"

echo
echo "build lock"

rm -rf "$DEMO_SIM_REGISTRY/locks"
: > "$WORK/order.log"
"$SCRIPTS/with-lock.sh" native-build 30 bash -c 'echo A-in >> '"$WORK"'/order.log; sleep 2; echo A-out >> '"$WORK"'/order.log' &
LOCK_A=$!
sleep 0.5
"$SCRIPTS/with-lock.sh" native-build 30 bash -c 'echo B-in >> '"$WORK"'/order.log' >/dev/null 2>&1
wait "$LOCK_A" 2>/dev/null   # scoped: a bare `wait` would also block on the decoy sleeps above
check "second holder waits for the first" "A-in A-out B-in" "$(tr '\n' ' ' < "$WORK/order.log" | sed 's/ $//')"

rm -rf "$DEMO_SIM_REGISTRY/locks"
mkdir -p "$DEMO_SIM_REGISTRY/locks/native-build"
echo 999999 > "$DEMO_SIM_REGISTRY/locks/native-build/pid"   # PID that cannot exist
"$SCRIPTS/with-lock.sh" native-build 15 true >/dev/null 2>&1
check "reclaims a lock from a dead holder" "0" "$?"

rm -rf "$DEMO_SIM_REGISTRY/locks"
mkdir -p "$DEMO_SIM_REGISTRY/locks/held"
echo $$ > "$DEMO_SIM_REGISTRY/locks/held/pid"               # this test process: alive
"$SCRIPTS/with-lock.sh" held 12 true >/dev/null 2>&1
check "times out rather than hanging forever" "1" "$?"

rm -rf "$DEMO_SIM_REGISTRY/locks"
"$SCRIPTS/with-lock.sh" native-build 10 false >/dev/null 2>&1
check "releases the lock when the command fails" "absent" \
  "$([ -d "$DEMO_SIM_REGISTRY/locks/native-build" ] && echo present || echo absent)"

echo
echo "-------------------------------------"
printf '%d passed, %d failed\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
