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
#   iOS:     DEMO_UDID (from the react-native-ios-simulator skill) or --udid
#   Android: DEMO_ANDROID_SERIAL (e.g. emulator-5554) or --serial
#   With both env vars set, the host OS decides (macOS -> iOS, else Android);
#   --platform (or --udid/--serial) overrides.
#
#   capture.sh after ./shots     ->  ./shots/after.png

set -uo pipefail

# Telemetry is best-effort and optional: this skill still works when the
# simulator skill's lib is absent (skills get copied around individually).
TEL_LIB="$(dirname "${BASH_SOURCE[0]}")/../../react-native-ios-simulator/lib/telemetry.sh"
{ [ -f "$TEL_LIB" ] && . "$TEL_LIB"; } 2>/dev/null || true
type tel_emit >/dev/null 2>&1 || { tel_now() { echo 0; }; tel_emit() { :; }; tel_span() { while [ $# -gt 0 ] && [ "$1" != "--" ]; do shift; done; [ $# -gt 0 ] && shift; "$@"; }; }

LABEL=""; OUTDIR="."
UDID="${DEMO_UDID:-}"; SERIAL="${DEMO_ANDROID_SERIAL:-}"; FORCE=""
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
    case "${DEMO_HOST_OS:-$(uname -s)}" in   # DEMO_HOST_OS is a test seam
      Darwin) PLATFORM=ios ;;
      *)      PLATFORM=android ;;
    esac
  elif [ -n "$SERIAL" ]; then PLATFORM=android
  elif [ -n "$UDID" ];   then PLATFORM=ios
  else
    die "no device: set DEMO_UDID (claim-session.sh) or DEMO_ANDROID_SERIAL, or pass --udid/--serial.
       Capturing without a pinned device targets whichever one is booted,
       which is usually the user's."
  fi
fi
[ "$PLATFORM" = ios     ] && [ -z "$UDID" ]   && die "--udid needs a value (or DEMO_UDID)"
[ "$PLATFORM" = android ] && [ -z "$SERIAL" ] && die "--serial needs a value (or DEMO_ANDROID_SERIAL)"

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

# One span for the whole capture - never per frame: a python3 spawn inside the
# settle loop would distort the very latency being measured. Frame count and
# stability land in meta; `ok` mirrors stability so the report can keep
# timed-out captures out of the latency percentiles (they are failure samples).
T_CAPTURE=$(tel_now)
FRAMES=0

if [ -n "$NO_WAIT" ]; then
  shoot "$OUT" || die "screenshot failed"
  FRAMES=1
else
  # Two identical frames in a row means nothing is animating. Comparing file
  # digests is enough and avoids depending on an image differ.
  #
  # The deadline uses `date +%s`: 1s resolution is plenty for a 30s budget,
  # and the two python3 spawns per frame this replaced cost 40-100ms each
  # iteration - drift injected into the very loop whose latency the telemetry
  # is supposed to report honestly.
  START_S=$(date +%s)
  TIMEOUT_S=${TIMEOUT%.*}
  [ -n "$TIMEOUT_S" ] && [ "$TIMEOUT_S" -ge 1 ] 2>/dev/null || TIMEOUT_S=1
  PREV=""
  STABLE=""
  while :; do
    shoot "$TMP/frame.png" || die "screenshot failed - is ${UDID:-$SERIAL} booted?"
    FRAMES=$((FRAMES + 1))
    [ -s "$TMP/frame.png" ] || die "screenshot produced an empty file"
    CUR=$(shasum -a 256 "$TMP/frame.png" | cut -d' ' -f1)
    if [ -n "$PREV" ] && [ "$CUR" = "$PREV" ]; then STABLE=1; break; fi
    PREV="$CUR"
    [ $(( $(date +%s) - START_S )) -ge "$TIMEOUT_S" ] && break
    sleep "$SETTLE"
  done
  cp "$TMP/frame.png" "$OUT"
  [ -n "$STABLE" ] || echo "WARNING: screen never settled within ${TIMEOUT}s; captured anyway" >&2
fi

[ -s "$OUT" ] || die "no screenshot was written to $OUT"

if [ -n "$NO_WAIT" ]; then
  tel_emit shot.capture.total "$T_CAPTURE" platform="$PLATFORM" frames=1 no_wait=1
else
  STABLE_FLAG="$([ -n "$STABLE" ] && echo 1 || echo 0)"
  tel_emit shot.capture.total "$T_CAPTURE" platform="$PLATFORM" frames="$FRAMES" \
    settle="$SETTLE" stable="$STABLE_FLAG" ok="$STABLE_FLAG"
fi

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
