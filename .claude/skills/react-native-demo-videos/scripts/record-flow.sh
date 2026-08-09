#!/bin/bash
# Record a Maestro flow running against one isolated device.
#
# iOS: the recorder is stopped with SIGINT and nothing else. `simctl
# recordVideo` writes the QuickTime moov atom (the index every player needs)
# only on a clean interrupt; SIGTERM or SIGKILL leave a file that is the right
# size on disk and plays nowhere. A trap guarantees the INT is sent even when
# the flow throws.
#
# Android: same rule, one hop further away. `screenrecord` finalises its MP4
# only when the *on-device* process gets SIGINT — so the stop is
# `adb shell kill -2 <pid>`, never a kill of the adb client, whose death the
# device may see too late or not at all. The file then has to be pulled off
# the device.
#
# Usage: record-flow.sh <label> <flow.yaml> [output-dir] [--platform ios|android]
#                       [--udid U | --serial S]
#   iOS:     DEMO_UDID (from claim-session.sh) or --udid    -> <label>.mov
#   Android: DEMO_ANDROID_SERIAL (e.g. emulator-5554) or --serial -> <label>.mp4
#   With both env vars set, the host OS decides (macOS -> iOS, else Android);
#   --platform (or --udid/--serial) overrides.
#
#   record-flow.sh after flows/dismiss-receipt.yaml ./demo
#     -> ./demo/after.mov

set -uo pipefail

# Telemetry is best-effort and optional: this skill still works when the
# simulator skill's lib is absent (skills get copied around individually).
TEL_LIB="$(dirname "${BASH_SOURCE[0]}")/../../react-native-ios-simulator/lib/telemetry.sh"
{ [ -f "$TEL_LIB" ] && . "$TEL_LIB"; } 2>/dev/null || true
type tel_emit >/dev/null 2>&1 || { tel_now() { echo 0; }; tel_emit() { :; }; tel_span() { while [ $# -gt 0 ] && [ "$1" != "--" ]; do shift; done; [ $# -gt 0 ] && shift; "$@"; }; }

LABEL=""; FLOW=""; OUTDIR="."
UDID="${DEMO_UDID:-}"; SERIAL="${DEMO_ANDROID_SERIAL:-}"; FORCE=""
LEAD_IN="${DEMO_LEAD_IN:-1.5}"     # a beat of the start state before the first tap
LEAD_OUT="${DEMO_LEAD_OUT:-2.0}"   # let the end state settle; a hard cut reads as truncated
SKIP_WARMUP="${DEMO_SKIP_WARMUP:-}"
ALLOW_CLEAR_STATE=""

while [ $# -gt 0 ]; do
  case "$1" in
    --udid) UDID="${2:?--udid needs a value}"; FORCE=ios; shift 2 ;;
    --serial) SERIAL="${2:?--serial needs a value}"; FORCE=android; shift 2 ;;
    --platform) FORCE="${2:?--platform needs ios or android}"; shift 2 ;;
    --lead-in) LEAD_IN="${2:?}"; shift 2 ;;
    --lead-out) LEAD_OUT="${2:?}"; shift 2 ;;
    --skip-warmup) SKIP_WARMUP=1; shift ;;
    --allow-clear-state) ALLOW_CLEAR_STATE=1; shift ;;
    -*) echo "FATAL: unknown option '$1'" >&2; exit 64 ;;
    *)
      if   [ -z "$LABEL" ]; then LABEL="$1"
      elif [ -z "$FLOW" ];  then FLOW="$1"
      else OUTDIR="$1"; fi
      shift ;;
  esac
done

die() { echo "FATAL: $*" >&2; exit 1; }

[ -n "$LABEL" ] || die "usage: record-flow.sh <label> <flow.yaml> [output-dir] [--platform ios|android] [--udid U | --serial S]"
[ -n "$FLOW" ]  || die "no flow file given"
[ -f "$FLOW" ]  || die "flow file not found: $FLOW"
case "$FORCE" in ""|ios|android) : ;; *) die "--platform must be 'ios' or 'android', got '$FORCE'" ;; esac

# One recording, one device. A claimed device picks its platform; when both
# are claimed, default by host OS — an iOS simulator only exists on macOS, so
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
       Recording without a pinned device would target whichever one is booted,
       which is usually the user's."
  fi
fi
[ "$PLATFORM" = ios     ] && [ -z "$UDID" ]   && die "--udid needs a value (or DEMO_UDID)"
[ "$PLATFORM" = android ] && [ -z "$SERIAL" ] && die "--serial needs a value (or DEMO_ANDROID_SERIAL)"

case "$LABEL" in
  *[!a-zA-Z0-9._-]*) die "label '$LABEL' must be filename-safe" ;;
esac

command -v maestro >/dev/null 2>&1 || die "maestro is not installed"
mkdir -p "$OUTDIR"

# The app under test is configuration, never a baked-in default: a wrong silent
# default records some other app's splash screen and reports success.
if [ "$PLATFORM" = android ]; then
  DEVICE="$SERIAL"
  APP_ID="${DEMO_APP_ID_ANDROID:-}"
  [ -n "$APP_ID" ] || die "no app id: set DEMO_APP_ID_ANDROID to your app's Android application id"
  OUT="$OUTDIR/$LABEL.mp4"            # screenrecord emits MP4 natively
  DEV_PATH="/sdcard/demo-$LABEL.mp4"
else
  DEVICE="$UDID"
  APP_ID="${DEMO_APP_ID_IOS:-}"
  [ -n "$APP_ID" ] || die "no app id: set DEMO_APP_ID_IOS to your app's iOS bundle id"
  OUT="$OUTDIR/$LABEL.mov"
fi
rm -f "$OUT"

# --- The clearState guard (iOS only) -----------------------------------------
# clearState wipes the app data container, which is where the persisted
# RCT_jsLocation Metro redirect lives; the next launchApp then silently loads
# the user's 8081 bundler and the recording shows a stuck splash. Launch
# arguments are immune (they live in the process argument domain, per launch),
# so a clearState flow must re-pass the redirect on EVERY launchApp:
#
#   - launchApp:
#       clearState: true
#       arguments:
#         RCT_jsLocation: "localhost:${DEMO_PORT}"
#
# Android is exempt: Metro reaches an emulator over adb reverse, not app data.
if [ "$PLATFORM" = ios ] && [ -z "$ALLOW_CLEAR_STATE" ]; then
  if grep -q "clearState" "$FLOW" && ! grep -q "RCT_jsLocation" "$FLOW"; then
    die "flow clears app state without re-passing the Metro redirect.
       clearState wipes the persisted RCT_jsLocation default, so every launchApp
       in this flow must carry: arguments: { RCT_jsLocation: \"localhost:\${DEMO_PORT}\" }
       (or use reset-app.sh from the simulator skill instead; --allow-clear-state waives this check)"
  fi
fi

# --- Warm-up ----------------------------------------------------------------
# Maestro installs its driver onto a device the first time it drives it (~20s,
# with an installer visible on screen). Recording that would put a black screen
# and a progress bar at the head of every demo, so it happens before the
# recorder starts. Failure here is not fatal: the real flow will report it.
T_WARMUP=$(tel_now)
# The warmup is only needed once per device per Maestro version - the driver
# it installs persists. Three ways to know it already happened, checked in
# order of directness (iOS only: the session markers live in the iOS session
# dir, and an Android emulator never shares a device with an iOS session):
#   manual   DEMO_SKIP_WARMUP=1, the caller's own judgment
#   session  an earlier maestro run in this session left the warmed marker
#   golden   the clone carries a driver baked by bless-golden.sh, and the
#            stamped maestro version still matches - after a CLI upgrade the
#            driver silently re-installs, so a mismatch must warm up again
WARM_REASON=""
if [ -n "$SKIP_WARMUP" ]; then
  WARM_REASON="manual"
elif [ "$PLATFORM" = ios ] && [ -n "${DEMO_SESSION_DIR:-}" ] && [ -f "$DEMO_SESSION_DIR/maestro-warmed" ]; then
  WARM_REASON="session"
elif [ "$PLATFORM" = ios ] && [ -n "${DEMO_SESSION_DIR:-}" ] && [ -f "$DEMO_SESSION_DIR/golden-stamp" ]; then
  STAMP_MV=$(grep '^maestro-version=' "$DEMO_SESSION_DIR/golden-stamp" 2>/dev/null | cut -d= -f2- || true)
  CUR_MV=$(maestro --version 2>/dev/null | head -1 || true)
  if [ -n "$STAMP_MV" ] && [ "$STAMP_MV" = "$CUR_MV" ]; then
    WARM_REASON="golden"
  fi
fi
if [ -z "$WARM_REASON" ]; then
  WARMUP="$(dirname "${BASH_SOURCE[0]}")/../flows/_warmup.yaml"
  if [ -f "$WARMUP" ]; then
    echo "warming up the maestro driver..."
    maestro test --udid "$DEVICE" -e APP_ID="$APP_ID" "$WARMUP" >/dev/null 2>&1
    [ "$PLATFORM" = ios ] && [ -n "${DEMO_SESSION_DIR:-}" ] && touch "$DEMO_SESSION_DIR/maestro-warmed" 2>/dev/null
  fi
  tel_emit vid.record.warmup "$T_WARMUP" platform="$PLATFORM" skipped=0
else
  tel_emit vid.record.warmup "$T_WARMUP" platform="$PLATFORM" skipped=1 reason="$WARM_REASON"
fi

# --- Recorder ---------------------------------------------------------------
stop_recorder_ios() {
  kill -0 "$REC_PID" 2>/dev/null || { REC_PID=""; return 0; }
  kill -INT "$REC_PID" 2>/dev/null
  # Give it a moment to finalise the container before anything reads the file.
  for _ in $(seq 50); do
    kill -0 "$REC_PID" 2>/dev/null || break
    sleep 0.1
  done
  wait "$REC_PID" 2>/dev/null
  REC_PID=""
}

stop_recorder_android() {
  if kill -0 "$REC_PID" 2>/dev/null; then
    # SIGINT must land on the *device-side* screenrecord: that is the only
    # signal path that finalises the moov atom. Killing the adb client races
    # the device's view of the disconnect and often leaves the file corrupt.
    DPID=$(adb -s "$SERIAL" shell pidof screenrecord 2>/dev/null | tr -d '\r' | awk '{print $1}')
    [ -n "$DPID" ] && adb -s "$SERIAL" shell kill -2 "$DPID" 2>/dev/null
    for _ in $(seq 100); do
      kill -0 "$REC_PID" 2>/dev/null || break
      sleep 0.1
    done
    # If the on-device SIGINT was lost, the client never exits on its own.
    # Killing the client now cannot corrupt anything that isn't already lost,
    # and the pull below surfaces the unfinalised file, which ffprobe rejects
    # — an honest failure beats hanging here forever.
    kill -0 "$REC_PID" 2>/dev/null && kill -KILL "$REC_PID" 2>/dev/null
    wait "$REC_PID" 2>/dev/null
  else
    # The client exited before we asked it to stop: screenrecord caps a
    # recording at 3 minutes and finalises the file itself when it hits it.
    wait "$REC_PID" 2>/dev/null
    echo "WARNING: the recorder stopped before the flow finished (screenrecord caps at 3 minutes); the tail of the flow is not in the video" >&2
  fi
  REC_PID=""
  adb -s "$SERIAL" pull "$DEV_PATH" "$OUT" >/dev/null 2>&1 || echo "WARNING: could not pull $DEV_PATH off the device" >&2
  adb -s "$SERIAL" shell rm -f "$DEV_PATH" 2>/dev/null
}

stop_recorder() {
  [ -n "${REC_PID:-}" ] || return 0
  if [ "$PLATFORM" = android ]; then stop_recorder_android; else stop_recorder_ios; fi
}
trap 'stop_recorder' EXIT INT TERM

echo "recording $DEVICE -> $OUT"
T_REC_START=$(tel_now)
# The recorder is launched through a shim that resets SIGINT to its default
# disposition before exec'ing.
#
# Why this is not paranoia: a non-interactive shell starts background jobs with
# SIGINT set to SIG_IGN, that disposition survives fork and exec, and bash will
# not restore a signal that was ignored when the shell started. So if this
# script is itself run in the background — which agents do constantly — a plain
# `xcrun ... &` produces a recorder that cannot be interrupted, and every
# recording comes out without a moov atom and plays nowhere. `set -m` fixes the
# foreground case only; this shim fixes both, because SIG_DFL also survives
# exec. Verified in both invocation modes. (The android stop path signals the
# on-device process instead, but the shim is kept so an interactive Ctrl-C
# still reaches the adb client.)
SHIM='import os, signal, sys; signal.signal(signal.SIGINT, signal.SIG_DFL); os.execvp(sys.argv[1], sys.argv[1:])'
if [ "$PLATFORM" = android ]; then
  # --time-limit 180 is also screenrecord's hard maximum; being explicit makes
  # the cap visible in ps output when a recording dies at exactly 3 minutes.
  python3 -c "$SHIM" \
    adb -s "$SERIAL" shell screenrecord --time-limit 180 "$DEV_PATH" &
  REC_PID=$!

  # screenrecord writes to the device filesystem, so the local file cannot be
  # polled; the on-device process appearing is the start signal.
  STARTED=""
  for _ in $(seq 100); do
    DPID=$(adb -s "$SERIAL" shell pidof screenrecord 2>/dev/null | tr -d '\r' | awk '{print $1}')
    if [ -n "$DPID" ]; then STARTED=1; break; fi
    kill -0 "$REC_PID" 2>/dev/null || break
    sleep 0.1
  done
  [ -n "$STARTED" ] || die "screenrecord never started on $SERIAL (recorder process died)"
else
  python3 -c "$SHIM" \
    xcrun simctl io "$UDID" recordVideo --codec h264 --mask black "$OUT" &
  REC_PID=$!

  # recordVideo takes about a second to open the file; starting the flow before
  # then loses the opening frames. Newer simulator runtimes (seen on iOS 26.5)
  # buffer the recording in memory and write the file only at finalize, so a
  # zero-byte file does NOT mean the recorder isn't rolling — after 2s of a live
  # recorder process, trust it and move on. A dead process is still fatal.
  STARTED=""
  for i in $(seq 100); do
    if [ -s "$OUT" ]; then STARTED=1; break; fi
    kill -0 "$REC_PID" 2>/dev/null || break
    if [ "$i" -ge 20 ]; then STARTED=1; break; fi
    sleep 0.1
  done
  [ -n "$STARTED" ] || die "recorder never started writing $OUT (recorder process died)"
fi
tel_emit vid.record.start_wait "$T_REC_START" platform="$PLATFORM"

sleep "$LEAD_IN"

# --- The flow ---------------------------------------------------------------
# APP_ID and DEMO_PORT are forwarded so flows can stay app-agnostic
# (`appId: ${APP_ID}`) and clearState flows can re-pass the Metro redirect as a
# launch argument. Unused variables are harmless.
T_FLOW=$(tel_now)
maestro test --udid "$DEVICE" -e APP_ID="$APP_ID" ${DEMO_PORT:+-e DEMO_PORT="$DEMO_PORT"} "$FLOW"
FLOW_RC=$?
tel_emit vid.record.flow "$T_FLOW" platform="$PLATFORM" rc="$FLOW_RC" \
  ok="$([ "$FLOW_RC" -eq 0 ] && echo 1 || echo 0)"
# A successful flow proves the driver works - later recordings in this
# session need no warmup even if this one's was skipped manually.
if [ "$FLOW_RC" -eq 0 ] && [ "$PLATFORM" = ios ] && [ -n "${DEMO_SESSION_DIR:-}" ]; then
  touch "$DEMO_SESSION_DIR/maestro-warmed" 2>/dev/null || true
fi

sleep "$LEAD_OUT"
T_STOP=$(tel_now)
stop_recorder
tel_emit vid.record.stop "$T_STOP" platform="$PLATFORM"
trap - EXIT INT TERM

# --- Validate ---------------------------------------------------------------
[ -s "$OUT" ] || die "no video was written to $OUT"
if command -v ffprobe >/dev/null 2>&1; then
  DURATION=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT" 2>/dev/null)
  [ -n "$DURATION" ] || die "$OUT is unplayable - the recorder was probably stopped with the wrong signal"
  echo "recorded ${DURATION}s -> $OUT"
fi

# A flow that failed still leaves a usable partial recording for diagnosis, but
# it must not be reported as a successful demo.
[ "$FLOW_RC" -eq 0 ] || die "flow failed (exit $FLOW_RC); $OUT kept for diagnosis"
