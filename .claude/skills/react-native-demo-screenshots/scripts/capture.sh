#!/bin/bash
# Capture a screenshot from one isolated device, once the screen has settled.
#
# Shooting blind is the usual way to get a useless screenshot: a splash screen,
# a half-finished transition, or a skeleton loader. This waits for two
# consecutive identical frames before keeping one, so what lands on the PR is a
# settled screen.
#
# Works against an iOS simulator (simctl) or an Android emulator (adb).
#
# Usage: capture.sh <label> [output-dir] [--platform ios|android] [--udid U | --serial S]
#                   [--settle N] [--timeout N]
#   iOS:     BLINK_UDID (from the react-native-ios-simulator skill) or --udid
#   Android: BLINK_ANDROID_SERIAL (e.g. emulator-5554) or --serial
#   With both env vars set, the host OS decides (macOS -> iOS, else Android);
#   --platform (or --udid/--serial) overrides.
#
#   capture.sh after ./shots     ->  ./shots/after.png

set -uo pipefail

LABEL=""; OUTDIR="."
UDID="${BLINK_UDID:-}"; SERIAL="${BLINK_ANDROID_SERIAL:-}"; FORCE=""
SETTLE="${SHOT_SETTLE:-0.6}"     # gap between comparison frames
TIMEOUT="${SHOT_TIMEOUT:-30}"    # give up waiting for stability after this
NO_WAIT=""

while [ $# -gt 0 ]; do
  case "$1" in
    --udid)     UDID="${2:?--udid needs a value}"; FORCE=ios; shift 2 ;;
    --serial)   SERIAL="${2:?--serial needs a value}"; FORCE=android; shift 2 ;;
    --platform) FORCE="${2:?--platform needs ios or android}"; shift 2 ;;
    --settle)  SETTLE="${2:?}"; shift 2 ;;
    --timeout) TIMEOUT="${2:?}"; shift 2 ;;
    --no-wait) NO_WAIT=1; shift ;;
    -*) echo "FATAL: unknown option '$1'" >&2; exit 64 ;;
    *) if [ -z "$LABEL" ]; then LABEL="$1"; else OUTDIR="$1"; fi; shift ;;
  esac
done

die() { echo "FATAL: $*" >&2; exit 1; }

[ -n "$LABEL" ] || die "usage: capture.sh <label> [output-dir] [--platform ios|android] [--udid U | --serial S]"
case "$FORCE" in ""|ios|android) : ;; *) die "--platform must be 'ios' or 'android', got '$FORCE'" ;; esac

# One capture, one device. A claimed device picks its platform; when both are
# claimed, default by host OS — an iOS simulator only exists on macOS, so
# macOS prefers it and any other host prefers Android. --platform overrides.
PLATFORM="$FORCE"
if [ -z "$PLATFORM" ]; then
  if [ -n "$UDID" ] && [ -n "$SERIAL" ]; then
    case "${BLINK_HOST_OS:-$(uname -s)}" in   # BLINK_HOST_OS is a test seam
      Darwin) PLATFORM=ios ;;
      *)      PLATFORM=android ;;
    esac
  elif [ -n "$SERIAL" ]; then PLATFORM=android
  elif [ -n "$UDID" ];   then PLATFORM=ios
  else
    die "no device: set BLINK_UDID (claim-session.sh) or BLINK_ANDROID_SERIAL, or pass --udid/--serial.
       Capturing without a pinned device targets whichever one is booted,
       which is usually the user's."
  fi
fi
[ "$PLATFORM" = ios     ] && [ -z "$UDID" ]   && die "--udid needs a value (or BLINK_UDID)"
[ "$PLATFORM" = android ] && [ -z "$SERIAL" ] && die "--serial needs a value (or BLINK_ANDROID_SERIAL)"

case "$LABEL" in
  *[!a-zA-Z0-9._-]*) die "label '$LABEL' must be filename-safe" ;;
esac

mkdir -p "$OUTDIR"
OUT="$OUTDIR/$LABEL.png"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/capture.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

if [ "$PLATFORM" = android ]; then
  # exec-out is binary-safe stdout; `shell screencap` would mangle line endings.
  shoot() { adb -s "$SERIAL" exec-out screencap -p > "$1" 2>/dev/null; }
else
  shoot() { xcrun simctl io "$UDID" screenshot "$1" >/dev/null 2>&1; }
fi

if [ -n "$NO_WAIT" ]; then
  shoot "$OUT" || die "screenshot failed"
else
  # Two identical frames in a row means nothing is animating. Comparing file
  # digests is enough and avoids depending on an image differ.
  DEADLINE=$(python3 -c "import time; print(time.time() + $TIMEOUT)")
  PREV=""
  STABLE=""
  while :; do
    shoot "$TMP/frame.png" || die "screenshot failed - is ${UDID:-$SERIAL} booted?"
    [ -s "$TMP/frame.png" ] || die "screenshot produced an empty file"
    CUR=$(shasum -a 256 "$TMP/frame.png" | cut -d' ' -f1)
    if [ -n "$PREV" ] && [ "$CUR" = "$PREV" ]; then STABLE=1; break; fi
    PREV="$CUR"
    NOW=$(python3 -c "import time; print(time.time())")
    OVER=$(python3 -c "print(1 if $NOW >= $DEADLINE else 0)")
    [ "$OVER" = "1" ] && break
    sleep "$SETTLE"
  done
  cp "$TMP/frame.png" "$OUT"
  [ -n "$STABLE" ] || echo "WARNING: screen never settled within ${TIMEOUT}s; captured anyway" >&2
fi

[ -s "$OUT" ] || die "no screenshot was written to $OUT"

# A PNG that is not a PNG means simctl wrote an error into the file.
if command -v magick >/dev/null 2>&1; then
  DIMS=$(magick identify -format "%m %wx%h" "$OUT" 2>/dev/null) || die "$OUT is not a readable image"
  case "$DIMS" in
    PNG*) echo "captured $DIMS -> $OUT" ;;
    *) die "$OUT is not a PNG ($DIMS)" ;;
  esac
else
  echo "captured -> $OUT"
fi
