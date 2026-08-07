#!/bin/bash
# Integration tests for the demo-video scripts.
#
# Run after editing anything in ../scripts/. Exits non-zero on any failure.
# No simulator and no network: xcrun and maestro are faked on PATH. ffmpeg is
# real, run against a clip synthesized by lavfi, because the encoding
# guarantees (dimensions, frame rate, palette pass) are only meaningful if a
# real encoder produced them.
#
#   ./tests/run.sh

set -uo pipefail

TESTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS="$TESTS_DIR/../scripts"
FLOWS="$TESTS_DIR/../flows"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/demo-video-tests.XXXXXX")"

export PATH="$TESTS_DIR/fixtures/bin:$PATH"
export FAKE_DEVICES="$WORK/devices.txt"
export FAKE_ADB_DEVICES="$WORK/adb-devices.txt"
export FAKE_ANDROID_ROOT="$WORK/droid-fs"
export FAKE_SIGNAL_LOG="$WORK/signals.log"
export FAKE_ARGS_LOG="$WORK/args.log"
export DEMO_LEAD_IN=0.2 DEMO_LEAD_OUT=0.2
export DEMO_APP_ID_IOS=com.example.demoapp
export DEMO_APP_ID_ANDROID=com.example.androidapp
# Redirecting the registry keeps every test span inside $WORK (telemetry
# derives its store from it).
export DEMO_SIM_REGISTRY="$WORK/registry"
unset DEMO_PORT 2>/dev/null || true

printf 'DEMO-UDID|rn-demo-pr3712|Booted\n' > "$FAKE_DEVICES"
printf 'emulator-5554|rn-demo-pr3712-avd|device\n' > "$FAKE_ADB_DEVICES"
mkdir -p "$FAKE_ANDROID_ROOT"

PASS=0; FAIL=0
trap 'rm -rf "$WORK"' EXIT

ok()  { PASS=$((PASS+1)); printf '  \033[32mPASS\033[0m %s\n' "$1"; }
bad() { FAIL=$((FAIL+1)); printf '  \033[31mFAIL\033[0m %s\n       %s\n' "$1" "$2"; }
check(){ if [ "$2" = "$3" ]; then ok "$1"; else bad "$1" "expected '$2', got '$3'"; fi; }

reset_logs() { : > "$FAKE_SIGNAL_LOG"; : > "$FAKE_ARGS_LOG"; }

# A flow file the fake maestro will accept.
cat > "$WORK/flow.yaml" <<'YAML'
appId: ${APP_ID}
---
- launchApp
YAML

echo
echo "recording lifecycle"

# --- happy path -------------------------------------------------------------
reset_logs
DEMO_UDID=DEMO-UDID "$SCRIPTS/record-flow.sh" after "$WORK/flow.yaml" "$WORK/out" >/dev/null 2>&1
check "clean run exits zero" "0" "$?"
check "recorder was stopped with INT, never TERM" "INT" "$(tr -d ' \n' < "$FAKE_SIGNAL_LOG")"
check "wrote the labelled file" "yes" "$([ -s "$WORK/out/after.mov" ] && echo yes || echo no)"
check "output is a playable container" "yes" \
  "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$WORK/out/after.mov" >/dev/null 2>&1 && echo yes || echo no)"

# --- udid pinning -----------------------------------------------------------
check "pinned --udid on maestro" "yes" \
  "$(grep -q -- "maestro test --udid DEMO-UDID" "$FAKE_ARGS_LOG" && echo yes || echo no)"
check "pinned the udid on recordVideo" "yes" \
  "$(grep -q "recordVideo udid=DEMO-UDID" "$FAKE_ARGS_LOG" && echo yes || echo no)"

# --- warm-up ordering -------------------------------------------------------
# The driver install must land before the recorder opens the file, or every
# demo starts with an installer on screen.
WARMUP_LINE=$(grep -n "_warmup.yaml" "$FAKE_ARGS_LOG" | head -1 | cut -d: -f1)
RECORD_LINE=$(grep -n "recordVideo" "$FAKE_ARGS_LOG" | head -1 | cut -d: -f1)
check "warm-up runs before the recorder starts" "yes" \
  "$([ -n "$WARMUP_LINE" ] && [ -n "$RECORD_LINE" ] && [ "$WARMUP_LINE" -lt "$RECORD_LINE" ] && echo yes || echo "no (warmup=$WARMUP_LINE record=$RECORD_LINE)")"
check "warm-up launches the ios app id" "yes" \
  "$(grep "_warmup.yaml" "$FAKE_ARGS_LOG" | grep -q "APP_ID=com.example.demoapp" && echo yes || echo no)"

# --- failing flow -----------------------------------------------------------
reset_logs
FAKE_MAESTRO_RC=1 DEMO_UDID=DEMO-UDID "$SCRIPTS/record-flow.sh" bad "$WORK/flow.yaml" "$WORK/out" >/dev/null 2>&1
check "a failing flow fails the script" "1" "$?"
check "recorder still stopped cleanly when the flow failed" "INT" "$(tr -d ' \n' < "$FAKE_SIGNAL_LOG")"
check "partial recording kept for diagnosis" "yes" \
  "$([ -s "$WORK/out/bad.mov" ] && echo yes || echo no)"

# --- unplayable output is caught, not published -----------------------------
reset_logs
FAKE_RECORD_CORRUPT=1 DEMO_UDID=DEMO-UDID "$SCRIPTS/record-flow.sh" corrupt "$WORK/flow.yaml" "$WORK/out" >/dev/null 2>&1
check "rejects a recording that never finalised" "1" "$?"

# --- refuses to guess a device ----------------------------------------------
reset_logs
env -u DEMO_UDID "$SCRIPTS/record-flow.sh" x "$WORK/flow.yaml" "$WORK/out" >/dev/null 2>&1
check "refuses to record without a pinned udid" "1" "$?"
check "did not start a recorder without a udid" "" "$(tr -d ' \n' < "$FAKE_SIGNAL_LOG")"

# --- bad input --------------------------------------------------------------
DEMO_UDID=DEMO-UDID "$SCRIPTS/record-flow.sh" "bad/label" "$WORK/flow.yaml" "$WORK/out" >/dev/null 2>&1
check "rejects a label that is not filename-safe" "1" "$?"
DEMO_UDID=DEMO-UDID "$SCRIPTS/record-flow.sh" x "$WORK/nope.yaml" "$WORK/out" >/dev/null 2>&1
check "rejects a missing flow file" "1" "$?"

# --- app identity is configuration, never a baked-in default -----------------
out=$(DEMO_APP_ID_IOS= DEMO_UDID=DEMO-UDID "$SCRIPTS/record-flow.sh" noapp "$WORK/flow.yaml" "$WORK/out" 2>&1)
check "refuses an ios run without DEMO_APP_ID_IOS" "1" "$?"
check "and names the missing variable" "yes" \
  "$(echo "$out" | grep -q "DEMO_APP_ID_IOS" && echo yes || echo no)"

# --- env forwarding into the recorded flow -----------------------------------
reset_logs
DEMO_PORT=8123 DEMO_UDID=DEMO-UDID "$SCRIPTS/record-flow.sh" fwd "$WORK/flow.yaml" "$WORK/out" >/dev/null 2>&1
REAL_FLOW_LINE=$(grep -- "maestro test" "$FAKE_ARGS_LOG" | grep -v "_warmup" | head -1)
check "the recorded flow gets the app id via -e APP_ID" "yes" \
  "$(echo "$REAL_FLOW_LINE" | grep -q -- "-e APP_ID=com.example.demoapp" && echo yes || echo no)"
check "the recorded flow gets the Metro port via -e DEMO_PORT" "yes" \
  "$(echo "$REAL_FLOW_LINE" | grep -q -- "-e DEMO_PORT=8123" && echo yes || echo no)"

reset_logs
DEMO_UDID=DEMO-UDID "$SCRIPTS/record-flow.sh" fwd2 "$WORK/flow.yaml" "$WORK/out" >/dev/null 2>&1
REAL_FLOW_LINE=$(grep -- "maestro test" "$FAKE_ARGS_LOG" | grep -v "_warmup" | head -1)
check "no stray -e DEMO_PORT when the port is unset" "no" \
  "$(echo "$REAL_FLOW_LINE" | grep -q -- "-e DEMO_PORT" && echo yes || echo no)"

# --- the clearState guard ----------------------------------------------------
# clearState wipes the app container including the persisted RCT_jsLocation
# redirect; a flow that clears state without re-passing the redirect as a
# launch argument records the app stuck on splash, loading the user's 8081.
cat > "$WORK/clearflow.yaml" <<'YAML'
appId: ${APP_ID}
---
- clearState
- launchApp
YAML
out=$(DEMO_UDID=DEMO-UDID "$SCRIPTS/record-flow.sh" cleared "$WORK/clearflow.yaml" "$WORK/out" 2>&1)
check "refuses an ios flow that clears state without the redirect" "1" "$?"
check "the refusal teaches the launchApp arguments form" "yes" \
  "$(echo "$out" | grep -q "RCT_jsLocation" && echo yes || echo no)"

cat > "$WORK/argflow.yaml" <<'YAML'
appId: ${APP_ID}
---
- launchApp:
    clearState: true
    arguments:
      RCT_jsLocation: "localhost:${DEMO_PORT}"
YAML
DEMO_PORT=8123 DEMO_UDID=DEMO-UDID "$SCRIPTS/record-flow.sh" argok "$WORK/argflow.yaml" "$WORK/out" >/dev/null 2>&1
check "accepts clearState when the redirect travels as a launch argument" "0" "$?"

DEMO_UDID=DEMO-UDID "$SCRIPTS/record-flow.sh" waived "$WORK/clearflow.yaml" "$WORK/out" --allow-clear-state >/dev/null 2>&1
check "--allow-clear-state waives the guard" "0" "$?"

echo
echo "recording lifecycle (android)"

reset_droid() { reset_logs; rm -rf "$FAKE_ANDROID_ROOT"; mkdir -p "$FAKE_ANDROID_ROOT"; }

# --- happy path -------------------------------------------------------------
reset_droid
DEMO_ANDROID_SERIAL=emulator-5554 "$SCRIPTS/record-flow.sh" after "$WORK/flow.yaml" "$WORK/droid-out" >/dev/null 2>&1
check "android clean run exits zero" "0" "$?"
check "wrote the labelled mp4 locally" "yes" "$([ -s "$WORK/droid-out/after.mp4" ] && echo yes || echo no)"
check "pulled output is a playable container" "yes" \
  "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$WORK/droid-out/after.mp4" >/dev/null 2>&1 && echo yes || echo no)"
check "recorder stopped by on-device SIGINT, not a client kill" "yes" \
  "$(grep -q "^KILL-2" "$FAKE_SIGNAL_LOG" && echo yes || echo no)"
check "pinned the serial on screenrecord" "yes" \
  "$(grep -q "screenrecord serial=emulator-5554" "$FAKE_ARGS_LOG" && echo yes || echo no)"
check "pinned the serial on maestro" "yes" \
  "$(grep -q -- "maestro test --udid emulator-5554" "$FAKE_ARGS_LOG" && echo yes || echo no)"
check "did not touch simctl for an android recording" "0" "$(grep -c "recordVideo" "$FAKE_ARGS_LOG")"
check "device-side recording was cleaned up" "yes" \
  "$([ ! -e "$FAKE_ANDROID_ROOT/sdcard/demo-after.mp4" ] && echo yes || echo no)"
check "warm-up launches the android app id" "yes" \
  "$(grep "_warmup.yaml" "$FAKE_ARGS_LOG" | grep -q "APP_ID=com.example.androidapp" && echo yes || echo no)"

WARMUP_LINE=$(grep -n "_warmup.yaml" "$FAKE_ARGS_LOG" | head -1 | cut -d: -f1)
RECORD_LINE=$(grep -n "screenrecord serial=" "$FAKE_ARGS_LOG" | head -1 | cut -d: -f1)
check "warm-up runs before the android recorder starts" "yes" \
  "$([ -n "$WARMUP_LINE" ] && [ -n "$RECORD_LINE" ] && [ "$WARMUP_LINE" -lt "$RECORD_LINE" ] && echo yes || echo "no (warmup=$WARMUP_LINE record=$RECORD_LINE)")"

# --- failing flow -----------------------------------------------------------
reset_droid
FAKE_MAESTRO_RC=1 DEMO_ANDROID_SERIAL=emulator-5554 "$SCRIPTS/record-flow.sh" bad "$WORK/flow.yaml" "$WORK/droid-out" >/dev/null 2>&1
check "a failing android flow fails the script" "1" "$?"
check "recorder still stopped cleanly when the flow failed" "yes" \
  "$(grep -q "^KILL-2" "$FAKE_SIGNAL_LOG" && echo yes || echo no)"
check "partial recording pulled for diagnosis" "yes" \
  "$([ -s "$WORK/droid-out/bad.mp4" ] && echo yes || echo no)"

# --- unplayable output is caught, not published -----------------------------
reset_droid
FAKE_RECORD_CORRUPT=1 DEMO_ANDROID_SERIAL=emulator-5554 "$SCRIPTS/record-flow.sh" corrupt "$WORK/flow.yaml" "$WORK/droid-out" >/dev/null 2>&1
check "rejects an android recording that never finalised" "1" "$?"

# --- screenrecord's 3-minute cap is reported, not hidden --------------------
reset_droid
out=$(FAKE_SCREENRECORD_SELFSTOP=1 DEMO_ANDROID_SERIAL=emulator-5554 \
  "$SCRIPTS/record-flow.sh" capped "$WORK/flow.yaml" "$WORK/droid-out" 2>&1)
RC=$?
check "a recorder that hit the time cap still yields the file" "0" "$RC"
check "and warns that the tail of the flow is missing" "yes" \
  "$(echo "$out" | grep -qi "3 minute" && echo yes || echo no)"

# --- a lost on-device stop fails honestly instead of hanging ----------------
# The stop signal can be lost (wedged adbd); the script must then escalate on
# the client, pull the unfinalised file, and let ffprobe reject it — observed
# to hang forever without the escalation.
reset_droid
FAKE_STOP_LOST=1 DEMO_ANDROID_SERIAL=emulator-5554 \
  "$SCRIPTS/record-flow.sh" lost "$WORK/flow.yaml" "$WORK/droid-out" >/dev/null 2>&1
check "a lost stop signal fails rather than hangs" "1" "$?"

# --- host-OS default when both platforms are claimed ------------------------
reset_droid
DEMO_UDID=DEMO-UDID DEMO_ANDROID_SERIAL=emulator-5554 DEMO_HOST_OS=Darwin \
  "$SCRIPTS/record-flow.sh" both-mac "$WORK/flow.yaml" "$WORK/droid-out" >/dev/null 2>&1
check "with both claimed, macOS defaults to the ios recorder" "0" "$?"
check "and recorded via recordVideo" "yes" \
  "$(grep -q "recordVideo udid=DEMO-UDID" "$FAKE_ARGS_LOG" && echo yes || echo no)"

reset_droid
DEMO_UDID=DEMO-UDID DEMO_ANDROID_SERIAL=emulator-5554 DEMO_HOST_OS=Linux \
  "$SCRIPTS/record-flow.sh" both-linux "$WORK/flow.yaml" "$WORK/droid-out" >/dev/null 2>&1
check "with both claimed, a non-mac host defaults to android" "0" "$?"
check "and recorded via screenrecord" "yes" \
  "$(grep -q "screenrecord serial=emulator-5554" "$FAKE_ARGS_LOG" && echo yes || echo no)"

# --- the override argument --------------------------------------------------
reset_droid
DEMO_UDID=DEMO-UDID DEMO_ANDROID_SERIAL=emulator-5554 DEMO_HOST_OS=Darwin \
  "$SCRIPTS/record-flow.sh" override "$WORK/flow.yaml" "$WORK/droid-out" --platform android >/dev/null 2>&1
check "--platform overrides the host default" "0" "$?"
check "and recorded via screenrecord" "yes" \
  "$(grep -q "screenrecord serial=emulator-5554" "$FAKE_ARGS_LOG" && echo yes || echo no)"

reset_droid
DEMO_UDID=DEMO-UDID "$SCRIPTS/record-flow.sh" x "$WORK/flow.yaml" "$WORK/droid-out" --platform tvos >/dev/null 2>&1
check "rejects an unknown --platform" "1" "$?"

reset_droid
DEMO_UDID=DEMO-UDID DEMO_ANDROID_SERIAL=emulator-5554 \
  "$SCRIPTS/record-flow.sh" pick "$WORK/flow.yaml" "$WORK/droid-out" --serial emulator-5554 >/dev/null 2>&1
check "--serial disambiguates to android" "0" "$?"

reset_droid
DEMO_ANDROID_SERIAL=emulator-5554 \
  "$SCRIPTS/record-flow.sh" droidclear "$WORK/clearflow.yaml" "$WORK/droid-out" >/dev/null 2>&1
check "android skips the clearState guard (adb reverse, not app data)" "0" "$?"

out=$(DEMO_APP_ID_ANDROID= DEMO_ANDROID_SERIAL=emulator-5554 \
  "$SCRIPTS/record-flow.sh" noapp "$WORK/flow.yaml" "$WORK/droid-out" 2>&1)
check "refuses an android run without DEMO_APP_ID_ANDROID" "1" "$?"

echo
echo "encoding"

# A real clip: 2s of colour bars at phone-ish proportions.
ffmpeg -y -v error -f lavfi -i "testsrc=duration=2:size=590x1278:rate=30" \
  -c:v libx264 -pix_fmt yuv420p "$WORK/src.mov" 2>/dev/null
check "fixture clip was synthesized" "yes" "$([ -s "$WORK/src.mov" ] && echo yes || echo no)"

probe() { ffprobe -v error -select_streams v:0 -show_entries "stream=$1" -of csv=p=0 "$2" 2>/dev/null | tr -d '\r\n '; }

"$SCRIPTS/encode-demo.sh" "$WORK/src.mov" "$WORK/demo.mp4" --format mp4 --width 320 >/dev/null 2>&1
check "mp4 encode exits zero" "0" "$?"
check "mp4 honours --width" "320" "$(probe width "$WORK/demo.mp4")"
check "mp4 is yuv420p for browser playback" "yuv420p" "$(probe pix_fmt "$WORK/demo.mp4")"
check "mp4 carries no audio track" "" \
  "$(ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$WORK/demo.mp4" 2>/dev/null | tr -d '\n')"

"$SCRIPTS/encode-demo.sh" "$WORK/src.mov" "$WORK/demo.gif" --format gif --width 240 --fps 10 >/dev/null 2>&1
check "gif encode exits zero" "0" "$?"
check "gif honours --width" "240" "$(probe width "$WORK/demo.gif")"
check "gif is animated, not a single frame" "yes" \
  "$(FR=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$WORK/demo.gif" 2>/dev/null | tr -d '\r\n '); [ "${FR:-0}" -gt 1 ] && echo yes || echo "no ($FR)")"

# --- screenrecord input (mp4, not mov) --------------------------------------
"$SCRIPTS/encode-demo.sh" "$WORK/demo.mp4" "$WORK/droid.gif" --format gif --width 200 >/dev/null 2>&1
check "encodes an android screenrecord mp4 as input" "0" "$?"

# --- webm (vp9) -------------------------------------------------------------
"$SCRIPTS/encode-demo.sh" "$WORK/src.mov" "$WORK/demo.webm" --format webm --width 320 >/dev/null 2>&1
check "webm encode exits zero" "0" "$?"
check "webm honours --width" "320" "$(probe width "$WORK/demo.webm")"
check "webm is vp9" "vp9" "$(probe codec_name "$WORK/demo.webm")"
check "webm carries no audio track" "" \
  "$(ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$WORK/demo.webm" 2>/dev/null | tr -d '\n')"
check "webm is smaller than the equivalent mp4" "yes" \
  "$([ "$(wc -c < "$WORK/demo.webm")" -lt "$(wc -c < "$WORK/demo.mp4")" ] && echo yes || echo no)"

# --- format validation ------------------------------------------------------
"$SCRIPTS/encode-demo.sh" "$WORK/src.mov" "$WORK/x.avi" --format avi >/dev/null 2>&1
check "rejects a format other than gif/mp4/webm" "1" "$?"
"$SCRIPTS/encode-demo.sh" "$WORK/src.mov" "$WORK/x.gif" >/dev/null 2>&1
check "requires --format" "1" "$?"
"$SCRIPTS/encode-demo.sh" "$WORK/src.mov" "$WORK/x.gif" --format gif --width abc >/dev/null 2>&1
check "rejects a non-numeric width" "1" "$?"

# --- size budget ------------------------------------------------------------
"$SCRIPTS/encode-demo.sh" "$WORK/src.mov" "$WORK/big.gif" --format gif --max-mb 0 >/dev/null 2>&1
check "reports going over the size budget" "3" "$?"
check "over-budget file is still written for inspection" "yes" \
  "$([ -s "$WORK/big.gif" ] && echo yes || echo no)"

echo
echo "publishing"

REPO="$WORK/repo"
mkdir -p "$REPO" && git -C "$REPO" init -q 2>/dev/null
git -C "$REPO" remote add origin git@github.com:acme/sample-app.git
cp "$WORK/demo.gif" "$REPO/before.gif"; cp "$WORK/demo.gif" "$REPO/after.gif"

out=$(cd "$REPO" && "$SCRIPTS/publish-demo.sh" 3712 before.gif after.gif --dry-run 2>&1)
check "dry run exits zero" "0" "$?"
check "targets the repo's real branch convention" "yes" \
  "$(echo "$out" | grep -q "assets/pr-3712-demo" && echo yes || echo no)"
check "emits a literal refspec" "yes" \
  "$(echo "$out" | grep -q "refs/heads/assets/pr-3712-demo" && echo yes || echo no)"
check "emits a raw.githubusercontent embed" "yes" \
  "$(echo "$out" | grep -q "raw.githubusercontent.com/acme/sample-app" && echo yes || echo no)"
check "warns the branch must survive" "yes" \
  "$(echo "$out" | grep -qi "deleting it breaks them" && echo yes || echo no)"

(cd "$REPO" && "$SCRIPTS/publish-demo.sh" 3712 "$WORK/demo.mp4" --dry-run) >/dev/null 2>&1
check "refuses to publish mp4 to a raw branch" "1" "$?"
(cd "$REPO" && "$SCRIPTS/publish-demo.sh" 3712 "$WORK/demo.webm" --dry-run) >/dev/null 2>&1
check "refuses to publish webm to a raw branch" "1" "$?"
(cd "$REPO" && "$SCRIPTS/publish-demo.sh" not-a-pr before.gif --dry-run) >/dev/null 2>&1
check "rejects a non-numeric PR number" "1" "$?"

echo
echo "shipped example flows"
for f in "$FLOWS"/*.yaml; do
  name=$(basename "$f")
  python3 -c "
import sys
raw = open(sys.argv[1]).read()
# Maestro files are two YAML documents; the header must declare an appId.
head = raw.split('---')[0]
sys.exit(0 if 'appId:' in head else 1)
" "$f"
  check "$name declares an appId" "0" "$?"
  python3 -c "
import sys
raw = open(sys.argv[1]).read()
sys.exit(1 if ('clearState' in raw and 'RCT_jsLocation' not in raw) else 0)
" "$f"
  check "$name never clears state without re-passing the Metro redirect" "0" "$?"
done

echo
echo "telemetry"

TELEMETRY_DIR="$WORK/registry/telemetry"
tel_spans() { cat "$TELEMETRY_DIR"/spans-*.jsonl 2>/dev/null; }

# --- a recording emits its phase spans ---------------------------------------
reset_logs; rm -rf "$TELEMETRY_DIR"
DEMO_UDID=DEMO-UDID "$SCRIPTS/record-flow.sh" tele "$WORK/flow.yaml" "$WORK/out" >/dev/null 2>&1
check "record run exits zero with telemetry on" "0" "$?"
for span in vid.record.warmup vid.record.start_wait vid.record.flow vid.record.stop; do
  check "recording emits $span" "1" "$(tel_spans | grep -c "\"span\":\"$span\"")"
done
check "the warmup span says it was not skipped" "yes" \
  "$(tel_spans | grep '"span":"vid.record.warmup"' | grep -q '"skipped":0' && echo yes || echo no)"

reset_logs; rm -rf "$TELEMETRY_DIR"
DEMO_SKIP_WARMUP=1 DEMO_UDID=DEMO-UDID "$SCRIPTS/record-flow.sh" tele2 "$WORK/flow.yaml" "$WORK/out" >/dev/null 2>&1
check "a skipped warmup is labelled skipped, not silently absent" "yes" \
  "$(tel_spans | grep '"span":"vid.record.warmup"' | grep -q '"skipped":1' && echo yes || echo no)"

# --- encode span carries the fields that make it a throughput number ---------
rm -rf "$TELEMETRY_DIR"
"$SCRIPTS/encode-demo.sh" "$WORK/out/tele2.mov" "$WORK/tele.gif" --format gif --width 200 >/dev/null 2>&1
check "encode emits vid.encode.total with format and size" "yes" \
  "$(tel_spans | python3 -c '
import json, sys
for l in sys.stdin:
    r = json.loads(l)
    if r["span"] == "vid.encode.total":
        m = r["meta"]
        print("yes" if m.get("fmt") == "gif" and isinstance(m.get("out_bytes"), int) and m["out_bytes"] > 0 and m.get("in_dur_s") not in ("", None) else "no"); break' 2>/dev/null)"

echo
echo "documented behavior matches the scripts"

SKILL_MD="$TESTS_DIR/../SKILL.md"
check "SKILL.md carries no BLINK_ residue" "no" \
  "$(grep -q "BLINK_" "$SKILL_MD" && echo yes || echo no)"
check "SKILL.md warns clearState wipes the persisted redirect" "yes" \
  "$(grep -i "clearState" "$SKILL_MD" | grep -qi "redirect\|RCT_jsLocation\|8081" && echo yes || echo no)"
check "SKILL.md before/after section uses the reload flip for JS-only changes" "yes" \
  "$(grep -q "reload-app.sh" "$SKILL_MD" && echo yes || echo no)"
check "SKILL.md teaches the launchApp arguments form" "yes" \
  "$(grep -q "RCT_jsLocation" "$SKILL_MD" && echo yes || echo no)"
check "SKILL.md requires eyeballing extracted frames before publishing" "yes" \
  "$(grep -qi "extract" "$SKILL_MD" && grep -qi "frame" "$SKILL_MD" && echo yes || echo no)"

echo
echo "-------------------------------------"
printf '%d passed, %d failed\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
