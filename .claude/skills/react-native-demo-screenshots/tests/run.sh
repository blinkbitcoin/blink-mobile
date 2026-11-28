#!/bin/bash
# Integration tests for the screenshot scripts.
#
# xcrun is faked (writes real PNGs); ImageMagick is real, because the crop and
# validation guarantees are only meaningful if a real image tool enforced them.
# No simulator, no network.
#
#   ./tests/run.sh

set -uo pipefail

TESTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS="$TESTS_DIR/../scripts"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/shot-tests.XXXXXX")"

export PATH="$TESTS_DIR/fixtures/bin:$PATH"
export FAKE_DEVICES="$WORK/devices.txt"
export FAKE_ADB_DEVICES="$WORK/adb-devices.txt"
export FAKE_ARGS_LOG="$WORK/args.log"
export FAKE_FRAME_COUNTER="$WORK/frames.n"
export SHOT_SETTLE=0.05

printf 'DEMO-UDID|rn-demo-pr3712|Booted\n' > "$FAKE_DEVICES"
printf 'emulator-5554|rn-demo-pr3712-avd|device\n' > "$FAKE_ADB_DEVICES"

PASS=0; FAIL=0
trap 'rm -rf "$WORK"' EXIT

ok()  { PASS=$((PASS+1)); printf '  \033[32mPASS\033[0m %s\n' "$1"; }
bad() { FAIL=$((FAIL+1)); printf '  \033[31mFAIL\033[0m %s\n       %s\n' "$1" "$2"; }
check(){ if [ "$2" = "$3" ]; then ok "$1"; else bad "$1" "expected '$2', got '$3'"; fi; }
reset(){ : > "$FAKE_ARGS_LOG"; rm -f "$FAKE_FRAME_COUNTER"; }

echo
echo "capture"

reset
DEMO_UDID=DEMO-UDID "$SCRIPTS/capture.sh" after "$WORK/shots" >/dev/null 2>&1
check "capture exits zero" "0" "$?"
check "wrote the labelled png" "yes" "$([ -s "$WORK/shots/after.png" ] && echo yes || echo no)"
check "output is a real PNG" "PNG" "$(magick identify -format '%m' "$WORK/shots/after.png" 2>/dev/null)"
check "pinned the udid" "yes" "$(grep -q "screenshot udid=DEMO-UDID" "$FAKE_ARGS_LOG" && echo yes || echo no)"

# --- stability polling ------------------------------------------------------
# Three distinct frames then a repeat: capture must keep shooting until two
# consecutive frames match, so it never publishes a mid-animation screen.
reset
FAKE_FRAMES="red green blue blue" DEMO_UDID=DEMO-UDID \
  "$SCRIPTS/capture.sh" settled "$WORK/shots" >/dev/null 2>&1
SHOTS=$(grep -c "screenshot udid=" "$FAKE_ARGS_LOG")
check "waits for the screen to settle before keeping a frame" "yes" \
  "$([ "$SHOTS" -ge 4 ] && echo yes || echo "no (only $SHOTS frames)")"
check "kept the settled frame, not an animating one" "blue" \
  "$(magick "$WORK/shots/settled.png" -format '%[pixel:p{1,1}]' info: 2>/dev/null | tr '[:upper:]' '[:lower:]' | sed 's/srgb(0,0,255)/blue/')"

# --- stability can be waived ------------------------------------------------
reset
FAKE_FRAMES="red green blue" DEMO_UDID=DEMO-UDID \
  "$SCRIPTS/capture.sh" nowait "$WORK/shots" --no-wait >/dev/null 2>&1
check "--no-wait shoots exactly once" "1" "$(grep -c "screenshot udid=" "$FAKE_ARGS_LOG")"

# --- a screen that never settles still yields a file ------------------------
reset
out=$(FAKE_NEVER_SETTLE=1 SHOT_TIMEOUT=1 DEMO_UDID=DEMO-UDID \
  "$SCRIPTS/capture.sh" busy "$WORK/shots" 2>&1)
check "an unsettled screen still produces a file" "yes" "$([ -s "$WORK/shots/busy.png" ] && echo yes || echo no)"
check "and says so rather than pretending" "yes" \
  "$(echo "$out" | grep -qi "never settled" && echo yes || echo no)"

# --- guards -----------------------------------------------------------------
reset
env -u DEMO_UDID "$SCRIPTS/capture.sh" x "$WORK/shots" >/dev/null 2>&1
check "refuses to capture without a pinned udid" "1" "$?"
check "did not shoot anything without a udid" "0" "$(grep -c "screenshot udid=" "$FAKE_ARGS_LOG")"

DEMO_UDID=DEMO-UDID "$SCRIPTS/capture.sh" "bad/label" "$WORK/shots" >/dev/null 2>&1
check "rejects a label that is not filename-safe" "1" "$?"

DEMO_UDID=NO-SUCH-DEVICE "$SCRIPTS/capture.sh" x "$WORK/shots" >/dev/null 2>&1
check "fails when the device does not exist" "1" "$?"

FAKE_SHOT_BROKEN=1 DEMO_UDID=DEMO-UDID "$SCRIPTS/capture.sh" broken "$WORK/shots" --no-wait >/dev/null 2>&1
check "detects a file that is not really a PNG" "1" "$?"

echo
echo "capture (android)"

# --- android happy path -----------------------------------------------------
reset
DEMO_ANDROID_SERIAL=emulator-5554 "$SCRIPTS/capture.sh" droid "$WORK/shots" >/dev/null 2>&1
check "android capture exits zero" "0" "$?"
check "wrote the labelled png" "yes" "$([ -s "$WORK/shots/droid.png" ] && echo yes || echo no)"
check "output is a real PNG" "PNG" "$(magick identify -format '%m' "$WORK/shots/droid.png" 2>/dev/null)"
check "pinned the serial on screencap" "yes" "$(grep -q "screencap serial=emulator-5554" "$FAKE_ARGS_LOG" && echo yes || echo no)"
check "did not touch simctl for an android shot" "0" "$(grep -c "screenshot udid=" "$FAKE_ARGS_LOG")"

# --- stability polling works on the adb path too ----------------------------
reset
FAKE_FRAMES="red green blue blue" DEMO_ANDROID_SERIAL=emulator-5554 \
  "$SCRIPTS/capture.sh" droid-settled "$WORK/shots" >/dev/null 2>&1
SHOTS=$(grep -c "screencap serial=" "$FAKE_ARGS_LOG")
check "waits for the screen to settle on android" "yes" \
  "$([ "$SHOTS" -ge 4 ] && echo yes || echo "no (only $SHOTS frames)")"
check "kept the settled frame on android" "blue" \
  "$(magick "$WORK/shots/droid-settled.png" -format '%[pixel:p{1,1}]' info: 2>/dev/null | tr '[:upper:]' '[:lower:]' | sed 's/srgb(0,0,255)/blue/')"

# --- host-OS default when both platforms are claimed ------------------------
reset
DEMO_UDID=DEMO-UDID DEMO_ANDROID_SERIAL=emulator-5554 DEMO_HOST_OS=Darwin \
  "$SCRIPTS/capture.sh" both-mac "$WORK/shots" >/dev/null 2>&1
check "with both claimed, macOS defaults to the ios simulator" "0" "$?"
check "and shot via simctl" "yes" "$(grep -q "screenshot udid=DEMO-UDID" "$FAKE_ARGS_LOG" && echo yes || echo no)"
check "and not via adb" "0" "$(grep -c "screencap serial=" "$FAKE_ARGS_LOG")"

reset
DEMO_UDID=DEMO-UDID DEMO_ANDROID_SERIAL=emulator-5554 DEMO_HOST_OS=Linux \
  "$SCRIPTS/capture.sh" both-linux "$WORK/shots" >/dev/null 2>&1
check "with both claimed, a non-mac host defaults to android" "0" "$?"
check "and shot via adb" "yes" "$(grep -q "screencap serial=emulator-5554" "$FAKE_ARGS_LOG" && echo yes || echo no)"

# --- the override argument --------------------------------------------------
reset
DEMO_UDID=DEMO-UDID DEMO_ANDROID_SERIAL=emulator-5554 DEMO_HOST_OS=Darwin \
  "$SCRIPTS/capture.sh" override "$WORK/shots" --platform android >/dev/null 2>&1
check "--platform overrides the host default" "0" "$?"
check "and it used adb" "yes" "$(grep -q "screencap serial=emulator-5554" "$FAKE_ARGS_LOG" && echo yes || echo no)"

"$SCRIPTS/capture.sh" x "$WORK/shots" --platform tvos >/dev/null 2>&1
check "rejects an unknown --platform" "1" "$?"

DEMO_UDID=DEMO-UDID "$SCRIPTS/capture.sh" x "$WORK/shots" --platform android >/dev/null 2>&1
check "--platform android without a serial fails" "1" "$?"

reset
DEMO_UDID=DEMO-UDID DEMO_ANDROID_SERIAL=emulator-5554 \
  "$SCRIPTS/capture.sh" pick-droid "$WORK/shots" --serial emulator-5554 >/dev/null 2>&1
check "--serial disambiguates to android" "0" "$?"
check "and it used adb" "yes" "$(grep -q "screencap serial=emulator-5554" "$FAKE_ARGS_LOG" && echo yes || echo no)"

reset
DEMO_UDID=DEMO-UDID DEMO_ANDROID_SERIAL=emulator-5554 \
  "$SCRIPTS/capture.sh" pick-ios "$WORK/shots" --udid DEMO-UDID >/dev/null 2>&1
check "--udid disambiguates to ios" "0" "$?"
check "and it used simctl" "yes" "$(grep -q "screenshot udid=DEMO-UDID" "$FAKE_ARGS_LOG" && echo yes || echo no)"

reset
DEMO_ANDROID_SERIAL=no-such-emulator "$SCRIPTS/capture.sh" x "$WORK/shots" >/dev/null 2>&1
check "fails when the emulator does not exist" "1" "$?"

FAKE_SHOT_BROKEN=1 DEMO_ANDROID_SERIAL=emulator-5554 \
  "$SCRIPTS/capture.sh" droid-broken "$WORK/shots" --no-wait >/dev/null 2>&1
check "detects adb output that is not really a PNG" "1" "$?"

echo
echo "crop pairs"

magick -size 200x400 xc:red   "$WORK/before.png" 2>/dev/null
magick -size 200x400 xc:green "$WORK/after.png"  2>/dev/null

"$SCRIPTS/crop-pair.sh" "$WORK/before.png" "$WORK/after.png" --crop 100x50+10+20 --out-dir "$WORK/cropped" >/dev/null 2>&1
check "crop exits zero" "0" "$?"
check "before was cropped to the box" "100x50" "$(magick identify -format '%wx%h' "$WORK/cropped/before.png" 2>/dev/null)"
check "after got the identical box" "100x50" "$(magick identify -format '%wx%h' "$WORK/cropped/after.png" 2>/dev/null)"
check "originals were left alone" "200x400" "$(magick identify -format '%wx%h' "$WORK/before.png" 2>/dev/null)"

# --- the dishonest-comparison guards ----------------------------------------
magick -size 300x500 xc:blue "$WORK/mismatch.png" 2>/dev/null
"$SCRIPTS/crop-pair.sh" "$WORK/before.png" "$WORK/mismatch.png" --crop 100x50+0+0 >/dev/null 2>&1
check "refuses a pair shot at different sizes" "1" "$?"

"$SCRIPTS/crop-pair.sh" "$WORK/before.png" "$WORK/after.png" --crop 500x50+0+0 >/dev/null 2>&1
check "refuses a box that does not fit" "1" "$?"

"$SCRIPTS/crop-pair.sh" "$WORK/before.png" "$WORK/after.png" --crop "not-a-box" >/dev/null 2>&1
check "rejects a malformed crop box" "1" "$?"

"$SCRIPTS/crop-pair.sh" "$WORK/before.png" "$WORK/after.png" >/dev/null 2>&1
check "requires --crop" "1" "$?"

echo
echo "documented behavior matches the scripts"

SKILL_MD="$TESTS_DIR/../SKILL.md"
check "SKILL.md carries no BLINK_ residue" "no" \
  "$(grep -q "BLINK_" "$SKILL_MD" && echo yes || echo no)"
check "SKILL.md pairs section uses the reload flip, not a blind fast refresh" "yes" \
  "$(grep -q "reload-app.sh" "$SKILL_MD" && echo yes || echo no)"
check "SKILL.md rejects a simulator per side, with the honesty rationale" "yes" \
  "$(grep -qi "simulator per side" "$SKILL_MD" && echo yes || echo no)"

echo
echo "-------------------------------------"
printf '%d passed, %d failed\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
