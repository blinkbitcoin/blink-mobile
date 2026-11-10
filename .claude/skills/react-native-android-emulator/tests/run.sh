#!/bin/bash
# Integration tests for the Android session scripts.
#
# Creates no real emulator: fake `adb` and `emulator` go first on PATH and the
# session registry is redirected into a temp dir. Safe to run at any time,
# including while other agents are mid-run.
#
#   ./tests/run.sh

set -uo pipefail

TESTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS="$TESTS_DIR/../scripts"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/rn-android-tests.XXXXXX")"

export PATH="$TESTS_DIR/fixtures/bin:$PATH"
export FAKE_ADB_DEVICES="$WORK/devices.txt"
export FAKE_ANDROID_ROOT="$WORK/android-root"
export FAKE_ARGS_LOG="$WORK/args.log"
export DEMO_SIM_REGISTRY="$WORK/registry"
export FAKE_AVDS="Pixel_Test_A Pixel_Test_B"
# Trust only what each test sets: a live claimed session in the invoking shell
# would otherwise leak into every assertion.
unset DEMO_ANDROID_SERIAL DEMO_UDID DEMO_PORT DEMO_SESSION_DIR DEMO_APP_ID_ANDROID \
      DEMO_SIM_PREFIX DEMO_EMU_PREFIX DEMO_REQUIRED_ENV 2>/dev/null || true

PASS=0; FAIL=0; STRAYS=()

cleanup() {
  for pid in "${STRAYS[@]:-}"; do [ -n "${pid:-}" ] && kill "$pid" 2>/dev/null; done
  rm -rf "$WORK"
}
trap cleanup EXIT

ok()  { PASS=$((PASS+1)); printf '  \033[32mPASS\033[0m %s\n' "$1"; }
bad() { FAIL=$((FAIL+1)); printf '  \033[31mFAIL\033[0m %s\n       %s\n' "$1" "$2"; }
check(){ if [ "$2" = "$3" ]; then ok "$1"; else bad "$1" "expected '$2', got '$3'"; fi; }

# The baseline is deliberately hostile: a FOREIGN emulator is already attached
# and must survive every test, exactly like the user's simulator in the iOS suite.
reset_world() {
  rm -rf "$DEMO_SIM_REGISTRY" "$FAKE_ANDROID_ROOT"
  mkdir -p "$FAKE_ANDROID_ROOT"
  : > "$FAKE_ARGS_LOG"
  printf 'emulator-5584|Someone_Elses_AVD|device\n' > "$FAKE_ADB_DEVICES"
}
attached() { grep -q "^$1|" "$FAKE_ADB_DEVICES" && echo yes || echo no; }

echo
echo "android session claim"

reset_world
out=$("$SCRIPTS/claim-session.sh" 3712 2>&1) && eval "$out"
check "claim exits zero" "0" "$?"
check "reserves a Metro port in the shared range" "yes" \
  "$([ "${DEMO_PORT:-0}" -ge 8100 ] && [ "${DEMO_PORT:-0}" -le 8499 ] && echo yes || echo "no (${DEMO_PORT:-unset})")"
CONSOLE=$(cat "$DEMO_SESSION_DIR/console-port")
check "the serial is derived from the reserved console port" "emulator-$CONSOLE" "$DEMO_ANDROID_SERIAL"
check "the emulator it booted is attached" "yes" "$(attached "$DEMO_ANDROID_SERIAL")"
check "it booted the AVD it reserved" "yes" \
  "$(grep -q -- "-avd $(cat "$DEMO_SESSION_DIR/avd") -port $CONSOLE" "$FAKE_ARGS_LOG" && echo yes || echo no)"
check "the foreign emulator was left alone" "yes" "$(attached emulator-5584)"
check "the emulator pid is recorded (release kills only this)" "yes" \
  "$([ -s "$DEMO_SESSION_DIR/emulator.pid" ] && echo yes || echo no)"
check "the claim records where it was claimed from" "yes" \
  "$([ -s "$DEMO_SESSION_DIR/head-sha" ] && [ -s "$DEMO_SESSION_DIR/worktree" ] && echo yes || echo no)"

PORT_1="$DEMO_PORT"; SERIAL_1="$DEMO_ANDROID_SERIAL"; AVD_1=$(cat "$DEMO_SESSION_DIR/avd")

# --- idempotency -------------------------------------------------------------
eval "$("$SCRIPTS/claim-session.sh" 3712)"
check "re-claim returns the same port" "$PORT_1" "$DEMO_PORT"
check "re-claim reuses the same emulator" "$SERIAL_1" "$DEMO_ANDROID_SERIAL"
check "re-claim did not boot a second emulator" "1" \
  "$(grep -c -- "-avd $AVD_1 -port" "$FAKE_ARGS_LOG")"

# --- a second session gets its own everything --------------------------------
eval "$("$SCRIPTS/claim-session.sh" 4113)"
check "a second session gets a different port" "different" \
  "$([ "$DEMO_PORT" != "$PORT_1" ] && echo different || echo "same ($DEMO_PORT)")"
check "a second session gets a different serial" "different" \
  "$([ "$DEMO_ANDROID_SERIAL" != "$SERIAL_1" ] && echo different || echo "same")"
check "a second session gets a different AVD" "different" \
  "$([ "$(cat "$DEMO_SESSION_DIR/avd")" != "$AVD_1" ] && echo different || echo "same")"

# --- AVD exhaustion fails loudly rather than adopting -------------------------
# Only two AVDs exist in this world and both are now reserved.
out=$("$SCRIPTS/claim-session.sh" 5000 2>&1); rc=$?
check "a third session fails rather than adopting an emulator" "1" "$rc"
check "and says Android concurrency is bounded by AVD count" "yes" \
  "$(echo "$out" | grep -qi "bounded by AVD count" && echo yes || echo no)"
check "and it did not touch the foreign emulator" "yes" "$(attached emulator-5584)"

"$SCRIPTS/release-session.sh" 3712 --delete >/dev/null 2>&1
"$SCRIPTS/release-session.sh" 4113 --delete >/dev/null 2>&1

# --- an explicitly named AVD --------------------------------------------------
reset_world
eval "$("$SCRIPTS/claim-session.sh" 3712 Pixel_Test_B)"
check "an explicitly named AVD is honored" "Pixel_Test_B" "$(cat "$DEMO_SESSION_DIR/avd")"
"$SCRIPTS/claim-session.sh" 4113 Pixel_Test_B >/dev/null 2>&1
check "the same AVD cannot be claimed twice" "1" "$?"
"$SCRIPTS/claim-session.sh" 4114 No_Such_AVD >/dev/null 2>&1
check "a nonexistent AVD is rejected" "1" "$?"

# --- rejects nonsense ---------------------------------------------------------
"$SCRIPTS/claim-session.sh" not-a-number >/dev/null 2>&1
check "rejects a non-numeric PR number" "1" "$?"

echo
echo "release safety"

reset_world
eval "$("$SCRIPTS/claim-session.sh" 3712)" >/dev/null 2>&1
"$SCRIPTS/release-session.sh" 3712 --delete >/dev/null 2>&1
check "clean release exits zero" "0" "$?"
check "our emulator is gone" "no" "$(attached "$DEMO_ANDROID_SERIAL")"
check "the foreign emulator survives" "yes" "$(attached emulator-5584)"
check "the port reservation is freed" "absent" \
  "$([ -d "$DEMO_SIM_REGISTRY/ports/$DEMO_PORT" ] && echo present || echo absent)"
check "the AVD reservation is freed" "absent" \
  "$([ -d "$DEMO_SIM_REGISTRY/avds/$(cat "$DEMO_SESSION_DIR/avd" 2>/dev/null || echo x)" ] && echo present || echo absent)"

# --- refuses an emulator running a different AVD than we reserved -------------
reset_world
eval "$("$SCRIPTS/claim-session.sh" 3712)" >/dev/null 2>&1
# Someone else's emulator now occupies our serial (AVD name differs).
python3 - "$FAKE_ADB_DEVICES" "$DEMO_ANDROID_SERIAL" <<'PY'
import sys
path, serial = sys.argv[1], sys.argv[2]
rows = [l for l in open(path) if l.strip()]
with open(path, "w") as f:
    for l in rows:
        f.write("%s|Hijacked_AVD|device\n" % serial if l.startswith(serial + "|") else l)
PY
out=$("$SCRIPTS/release-session.sh" 3712 --delete 2>&1); rc=$?
check "release refuses a serial running a foreign AVD" "1" "$rc"
check "and names the mismatch" "yes" \
  "$(echo "$out" | grep -q "Hijacked_AVD" && echo yes || echo no)"
check "the hijacked emulator is left running" "yes" "$(attached "$DEMO_ANDROID_SERIAL")"

# --- collateral damage detection ---------------------------------------------
reset_world
eval "$("$SCRIPTS/claim-session.sh" 3712)" >/dev/null 2>&1
adb -s emulator-5584 emu kill >/dev/null 2>&1     # the mistake we must catch
out=$("$SCRIPTS/release-session.sh" 3712 --delete 2>&1); rc=$?
check "detects a foreign emulator was killed" "1" "$rc"
check "names the damaged device" "yes" \
  "$(echo "$out" | grep -q "emulator-5584" && echo yes || echo no)"

# --- Metro is killed by PID, never by pattern --------------------------------
reset_world
eval "$("$SCRIPTS/claim-session.sh" 3712)" >/dev/null 2>&1
sleep 120 & OURS=$!;   STRAYS+=($OURS); disown $OURS 2>/dev/null
sleep 120 & THEIRS=$!; STRAYS+=($THEIRS); disown $THEIRS 2>/dev/null
echo "$OURS" > "$DEMO_SESSION_DIR/metro.pid"
"$SCRIPTS/release-session.sh" 3712 --delete >/dev/null 2>&1
sleep 0.5
check "stops the Metro it recorded" "gone" "$(kill -0 $OURS 2>/dev/null && echo alive || echo gone)"
check "leaves another agent's process alone" "alive" "$(kill -0 $THEIRS 2>/dev/null && echo alive || echo gone)"

"$SCRIPTS/release-session.sh" 9999 >/dev/null 2>&1
check "release without a claim fails loudly" "1" "$?"

echo
echo "cross-platform port sharing"

# The whole reason the registry is shared: an iOS session and an Android session
# must never land on the same Metro port.
reset_world
IOS_SCRIPTS="$TESTS_DIR/../../react-native-ios-simulator/scripts"
IOS_FIXTURES="$TESTS_DIR/../../react-native-ios-simulator/tests/fixtures/bin"
export FAKE_DEVICES="$WORK/ios-devices.txt"
export FAKE_APP_ROOT="$WORK/ios-apps"
printf 'USER-SIM|iPhone 16 Pro|Booted\n' > "$FAKE_DEVICES"
eval "$("$SCRIPTS/claim-session.sh" 3712)" >/dev/null 2>&1
ANDROID_PORT="$DEMO_PORT"
IOS_PORT=$(PATH="$IOS_FIXTURES:$PATH" "$IOS_SCRIPTS/claim-session.sh" 3712 2>/dev/null | grep '^export DEMO_PORT=' | cut -d= -f2)
check "an iOS claim with the same PR number gets a different port" "different" \
  "$([ -n "$IOS_PORT" ] && [ "$IOS_PORT" != "$ANDROID_PORT" ] && echo different || echo "same ($IOS_PORT vs $ANDROID_PORT)")"

echo
echo "failed claims and re-claims"

# A claim that dies mid-boot must hand back everything it took: with no
# released-at stamp the reaper never would, and a lone AVD would stay
# "reserved" for every later claim on the machine.
reset_world
FAKE_EMULATOR_BOOT_FAILS=1 "$SCRIPTS/claim-session.sh" 3800 >/dev/null 2>&1
check "a claim whose emulator dies exits non-zero" "1" "$?"
check "the failed claim leaves no AVD reserved" "none" \
  "$(grep -rlx "rn-demo-android-pr3800" "$DEMO_SIM_REGISTRY/avds" 2>/dev/null | head -1 | grep -q . && echo held || echo none)"
check "the failed claim leaves no console port reserved" "none" \
  "$(grep -rlx "rn-demo-android-pr3800" "$DEMO_SIM_REGISTRY/emu-ports" 2>/dev/null | head -1 | grep -q . && echo held || echo none)"
check "the failed claim leaves no Metro port reserved" "none" \
  "$(grep -rlx "rn-demo-android-pr3800" "$DEMO_SIM_REGISTRY/ports" 2>/dev/null | head -1 | grep -q . && echo held || echo none)"
"$SCRIPTS/claim-session.sh" 3801 >/dev/null 2>&1
check "the next claim can use the AVD the failed one took" "0" "$?"
"$SCRIPTS/release-session.sh" 3801 --delete >/dev/null 2>&1

# A boot that attaches but never completes: the launcher is killed, but the
# instance itself must be stopped through its console too, or it keeps the
# AVD locked after the reservation is handed back.
reset_world
FAKE_BOOT_COMPLETED=0 DEMO_EMU_BOOT_TIMEOUT=3 "$SCRIPTS/claim-session.sh" 3802 >/dev/null 2>&1
check "a claim whose emulator never finishes booting exits non-zero" "1" "$?"
check "its half-booted emulator is stopped, not left attached" "0" \
  "$(grep -c '|Pixel_Test_A|' "$FAKE_ADB_DEVICES")"
check "the rollback stops it through the console" "yes" \
  "$(grep -q 'emu kill' "$FAKE_ARGS_LOG" && echo yes || echo no)"

# Another emulator grabs the console port between the claim's check and its
# launch: the claim's own emulator dies, and the rollback must leave the
# foreign instance on that serial running.
reset_world
FAKE_EMULATOR_PORT_STOLEN_BY=Someone_Elses_Studio_AVD "$SCRIPTS/claim-session.sh" 3803 >/dev/null 2>&1
check "a claim whose console port was taken exits non-zero" "1" "$?"
check "the foreign emulator on that console port survives the rollback" "1" \
  "$(grep -c '|Someone_Elses_Studio_AVD|' "$FAKE_ADB_DEVICES")"

# Release frees the Metro port but keeps the session dir for retakes; if
# another session took the port meanwhile, the re-claim must move.
reset_world
eval "$("$SCRIPTS/claim-session.sh" 3712)" >/dev/null 2>&1
KEPT_PORT="$DEMO_PORT"
"$SCRIPTS/release-session.sh" 3712 >/dev/null 2>&1
mkdir -p "$DEMO_SIM_REGISTRY/ports/$KEPT_PORT"
echo "rn-demo-pr9999" > "$DEMO_SIM_REGISTRY/ports/$KEPT_PORT/owner"
eval "$("$SCRIPTS/claim-session.sh" 3712)" >/dev/null 2>&1
check "re-claim does not reuse a port another session took" "moved" \
  "$([ "$DEMO_PORT" != "$KEPT_PORT" ] && echo moved || echo "reused $KEPT_PORT")"
check "the other session keeps its reservation" "rn-demo-pr9999" \
  "$(cat "$DEMO_SIM_REGISTRY/ports/$KEPT_PORT/owner" 2>/dev/null)"
"$SCRIPTS/release-session.sh" 3712 --delete >/dev/null 2>&1

echo
echo "pointing the app at this session's Metro"

reset_world
eval "$("$SCRIPTS/claim-session.sh" 3712)" >/dev/null 2>&1
: > "$FAKE_ARGS_LOG"
DEMO_APP_ID_ANDROID=com.example.demoapp "$SCRIPTS/point-app-at-metro.sh" >/dev/null 2>&1
check "point-app-at-metro exits zero" "0" "$?"
PREFS="$FAKE_ANDROID_ROOT/data/data/com.example.demoapp/shared_prefs/com.example.demoapp_preferences.xml"
check "the preference file lands in the app's shared_prefs" "yes" \
  "$([ -f "$PREFS" ] && echo yes || echo no)"
check "it points at 10.0.2.2 and the CLAIMED port, not 8081" "yes" \
  "$(grep -q "10.0.2.2:$DEMO_PORT" "$PREFS" 2>/dev/null && echo yes || echo no)"
check "the pref carries the key the framework reads" "yes" \
  "$(grep -q 'name="debug_http_host"' "$PREFS" 2>/dev/null && echo yes || echo no)"
# The value is only read at process start, so without this the write is inert.
check "the app is force-stopped so the new value is read" "yes" \
  "$(grep -q "force-stop com.example.demoapp" "$FAKE_ARGS_LOG" && echo yes || echo no)"
# Pushing a file rather than printf-ing XML through run-as is what keeps the
# XML header intact.
check "the prefs travel as a pushed file, not inline text" "yes" \
  "$(grep -q "push .* /data/local/tmp/debug_http_host.xml" "$FAKE_ARGS_LOG" && echo yes || echo no)"
check "every adb call is pinned with -s" "0" \
  "$(grep "^adb " "$FAKE_ARGS_LOG" | grep -v "^adb devices" | grep -cv -- "-s $DEMO_ANDROID_SERIAL")"

# A running app can flush its in-memory prefs over our write, so the stop
# must come before the file lands, not after.
check "the app is stopped before the prefs are written" "yes" \
  "$(awk '/force-stop com.example.demoapp/ {stop=NR} /push .* \/data\/local\/tmp\/debug_http_host.xml/ {push=NR} END {print (stop && push && stop < push) ? "yes" : "no"}' "$FAKE_ARGS_LOG")"

# The default prefs file holds more than the redirect; re-pointing must keep
# the rest and replace (not duplicate) an earlier redirect.
cat > "$PREFS" <<'XML'
<?xml version='1.0' encoding='utf-8' standalone='yes' ?>
<map>
    <boolean name="js_dev_mode_debug" value="true" />
    <string name="debug_http_host">10.0.2.2:8081</string>
</map>
XML
DEMO_APP_ID_ANDROID=com.example.demoapp "$SCRIPTS/point-app-at-metro.sh" >/dev/null 2>&1
check "re-pointing keeps the app's other preferences" "yes" \
  "$(grep -q 'name="js_dev_mode_debug"' "$PREFS" && echo yes || echo no)"
check "re-pointing leaves exactly one redirect" "1" "$(grep -c 'name="debug_http_host"' "$PREFS")"
check "the remaining redirect is the claimed port" "yes" \
  "$(grep -q "10.0.2.2:$DEMO_PORT" "$PREFS" && ! grep -q '10.0.2.2:8081' "$PREFS" && echo yes || echo no)"

DEMO_APP_ID_ANDROID= "$SCRIPTS/point-app-at-metro.sh" >/dev/null 2>&1
check "refuses without an app id" "1" "$?"
out=$(DEMO_PORT= DEMO_APP_ID_ANDROID=com.example.demoapp "$SCRIPTS/point-app-at-metro.sh" 2>&1); rc=$?
check "refuses without a claimed port" "1" "$rc"
check "and explains that the app would dial 8081 instead" "yes" \
  "$(echo "$out" | grep -q "8081" && echo yes || echo no)"
FAKE_RUN_AS_DENIED=1 DEMO_APP_ID_ANDROID=com.example.demoapp "$SCRIPTS/point-app-at-metro.sh" >/dev/null 2>&1
check "a non-debuggable build fails loudly" "1" "$?"

echo
echo "reaper"

reset_world
eval "$("$SCRIPTS/claim-session.sh" 3712)" >/dev/null 2>&1
SESSION_1="$DEMO_SESSION_DIR"; AVD_1=$(cat "$SESSION_1/avd")
"$SCRIPTS/release-session.sh" 3712 >/dev/null 2>&1
echo 1 > "$SESSION_1/released-at"            # expired long ago
"$SCRIPTS/reap-stale.sh" >/dev/null 2>&1
check "the reaper sweeps an expired session" "absent" \
  "$([ -d "$SESSION_1" ] && echo present || echo absent)"
check "and frees its AVD reservation" "absent" \
  "$([ -d "$DEMO_SIM_REGISTRY/avds/$AVD_1" ] && echo present || echo absent)"

# A session whose emulator is still attached is never swept, however old.
reset_world
eval "$("$SCRIPTS/claim-session.sh" 3712)" >/dev/null 2>&1
echo 1 > "$DEMO_SESSION_DIR/released-at"
"$SCRIPTS/reap-stale.sh" >/dev/null 2>&1
check "the reaper skips a session whose emulator is still attached" "present" \
  "$([ -d "$DEMO_SESSION_DIR" ] && echo present || echo absent)"

echo
echo "documented behavior matches the scripts"

SKILL_MD="$TESTS_DIR/../SKILL.md"
check "SKILL.md pre-approves this skill's commands (allowed-tools)" "yes" \
  "$(head -5 "$SKILL_MD" | grep "allowed-tools:" | grep -q -- "Bash(adb -s \* exec-out screencap \*)" && echo yes || echo no)"
# Raw `adb emu kill`, `adb kill-server`, `pm clear` or a bare `emulator` launch
# skip every guard the scripts add (serial pinning, AVD reservation), so no
# allowlist may pre-approve adb or emulator wholesale.
check "no allowlist pre-approves adb or emulator wholesale" "none" \
  "$(python3 -c '
import glob, json, os, sys
root = sys.argv[1]
grants = json.load(open(os.path.join(root, "settings.json")))["permissions"]["allow"]
for md in glob.glob(os.path.join(root, "skills", "*", "SKILL.md")):
    for line in open(md).read().split("\n")[:5]:
        if line.startswith("allowed-tools:"):
            grants += [g.strip() + ")" for g in line[len("allowed-tools:"):].split(")") if g.strip()]
bad = sorted({g for g in grants if g in ("Bash(adb *)", "Bash(emulator *)") or g.startswith("Bash(adb -s * shell *")})
print(" ".join(bad) or "none")
' "$TESTS_DIR/../../.." 2>&1)"
check "SKILL.md explains the 10.0.2.2 default that breaks naive sessions" "yes" \
  "$(grep -q "10.0.2.2" "$SKILL_MD" && echo yes || echo no)"
check "SKILL.md corrects the adb reverse folklore rather than repeating it" "yes" \
  "$(grep -qi "adb reverse" "$SKILL_MD" && grep -qi "device-localhost" "$SKILL_MD" && echo yes || echo no)"
check "SKILL.md documents the force-stop requirement" "yes" \
  "$(grep -q "force-stop" "$SKILL_MD" && echo yes || echo no)"
check "SKILL.md points at verify-session.sh rather than assuming success" "yes" \
  "$(grep -q "verify-session.sh" "$SKILL_MD" && echo yes || echo no)"
check "SKILL.md warns that clearState wipes the Metro pointer" "yes" \
  "$(grep -qi "clearState" "$SKILL_MD" && grep -q "debug_http_host" "$SKILL_MD" && echo yes || echo no)"
check "SKILL.md is honest that account-gated screens have no Android path yet" "yes" \
  "$(grep -qi "account-gated screens cannot be demoed" "$SKILL_MD" && echo yes || echo no)"

# The count in SKILL.md is documentation that rots silently - it drifted to 105
# against 97 actual once. Comparing it here makes the drift a red build instead
# of a number nobody checks.
DOC_COUNT=$(grep -o '# [0-9]\+ assertions' "$TESTS_DIR/../SKILL.md" 2>/dev/null | head -1 | grep -o '[0-9]\+' || echo "")
ACTUAL_COUNT=$((PASS + FAIL))
if [ -n "$DOC_COUNT" ] && [ "$DOC_COUNT" != "$ACTUAL_COUNT" ]; then
  bad "SKILL.md documents the suite's own size" "$DOC_COUNT assertions" "$ACTUAL_COUNT"
fi

echo
echo "-------------------------------------"
printf '%d passed, %d failed\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
