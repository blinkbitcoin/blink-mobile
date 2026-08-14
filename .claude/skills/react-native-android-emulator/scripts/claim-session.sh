#!/bin/bash
# Claim an isolated Android emulator + Metro port for one PR's demo run.
#
# The iOS twin proves ownership with a per-session device NAME; an emulator has
# no renameable identity, so ownership here rests on three facts recorded at
# claim time and re-checked at release:
#
#   console port  reserved in the shared registry and passed as `emulator -port
#                 <N>`, which FIXES the serial at emulator-<N>. The serial is
#                 ours by construction, not by convention.
#   emulator pid  the process we started; release kills that and nothing else
#                 (never pkill, never `adb emu kill` on a serial we found).
#   avd name      reserved too, because an AVD cannot run twice concurrently,
#                 and cross-checked live with `adb -s <serial> emu avd name`.
#
# Usage: claim-session.sh <pr-number> [avd-name]
#   With no AVD name, the first free AVD from `emulator -list-avds` is taken.
#   Concurrency is bounded by how many AVDs exist - unlike iOS, where simctl
#   creates devices on demand. When all are reserved the claim FAILS with the
#   list rather than adopting somebody's running emulator.
#
# Emits the same eval-able contract as the iOS claim, plus DEMO_ANDROID_SERIAL:
#   eval "$(claim-session.sh 3712)"

set -euo pipefail

# Telemetry is best-effort: a broken, unreadable or absent lib must never break
# a claim - the fallbacks below turn every tel_* call into a no-op.
TEL_LIB="$(dirname "${BASH_SOURCE[0]}")/../../react-native-ios-simulator/lib/telemetry.sh"
{ [ -f "$TEL_LIB" ] && . "$TEL_LIB"; } 2>/dev/null || true
type tel_emit >/dev/null 2>&1 || { tel_now() { echo 0; }; tel_emit() { :; }; tel_span() { while [ $# -gt 0 ] && [ "$1" != "--" ]; do shift; done; [ $# -gt 0 ] && shift; "$@"; }; }
T_CLAIM=$(tel_now)

# Reservations are NOT best-effort: an unreserved port silently steals another
# agent's bundler, so a missing lib is fatal.
PORTS_LIB="$(dirname "${BASH_SOURCE[0]}")/../../react-native-ios-simulator/lib/ports.sh"
[ -f "$PORTS_LIB" ] || { echo "FATAL: missing $PORTS_LIB - the Android skill shares the iOS skill's registry; they ship together" >&2; exit 1; }
. "$PORTS_LIB"

die() { echo "FATAL: $*" >&2; exit 1; }

PR="${1:?usage: claim-session.sh <pr-number> [avd-name]}"
WANT_AVD="${2:-}"

case "$PR" in
  ''|*[!0-9]*) die "pr-number must be numeric, got '$PR'" ;;
esac

command -v adb >/dev/null 2>&1 || die "adb is not on PATH (Android SDK platform-tools)"
command -v emulator >/dev/null 2>&1 || die "emulator is not on PATH (Android SDK emulator)"

REGISTRY="${DEMO_SIM_REGISTRY:-$HOME/.claude/rn-sim-sessions}"
# Same keying rule as iOS: the full session name, because the registry is
# machine-wide and two repos can hold the same PR number at once.
SESSION_NAME="${DEMO_EMU_PREFIX:-${DEMO_SIM_PREFIX:-rn-demo}}-android-pr${PR}"
SESSION_DIR="$REGISTRY/${SESSION_NAME}"

DEMO_SIM_NAME="$SESSION_NAME"   # session label for telemetry spans

# Sweep expired sessions first, then un-mark our own: an active claim is never
# reaped.
T_REAP=$(tel_now)
"$(dirname "${BASH_SOURCE[0]}")/reap-stale.sh" >/dev/null 2>&1 || true
tel_emit android.claim.reap "$T_REAP"
mkdir -p "$SESSION_DIR"
rm -f "$SESSION_DIR/released-at"

# --- Pre-flight snapshot -----------------------------------------------------
# Every device attached before we touch anything. release-session.sh asserts
# this exact set is still attached afterwards - the Android twin of the iOS
# collateral-damage assertion.
adb devices | tail -n +2 | awk 'NF>=2 {print $1}' > "$SESSION_DIR/preflight-devices.txt" 2>/dev/null || : > "$SESSION_DIR/preflight-devices.txt"
PREFLIGHT_COUNT=$(grep -c . "$SESSION_DIR/preflight-devices.txt" || true)

# DEMO_REQUIRED_ENV lists the names of credentials this repo's real-account
# flows need; unset ones are reported, never blocking - most demos need no
# account at all. (Same contract as the iOS claim.)
MISSING_CREDS=""
for CRED_NAME in ${DEMO_REQUIRED_ENV:-}; do
  [ -n "$CRED_NAME" ] || continue
  [ -z "${!CRED_NAME:-}" ] && MISSING_CREDS="$MISSING_CREDS $CRED_NAME"
done
MISSING_CREDS="${MISSING_CREDS# }"

# --- Where the demo runs from ------------------------------------------------
# Recorded so verify-session.sh can catch the trap that manufactured a phantom
# regression once: the checkout moving to another branch mid-session, after
# which Metro serves code that is not the code under test.
if git rev-parse --show-toplevel >/dev/null 2>&1; then
  git rev-parse --show-toplevel > "$SESSION_DIR/worktree"
  git rev-parse HEAD > "$SESSION_DIR/head-sha"
fi

# --- Metro port --------------------------------------------------------------
if [ -f "$SESSION_DIR/port" ]; then
  PORT=$(cat "$SESSION_DIR/port")   # idempotent re-claim
else
  PORT=$(reserve_metro_port "$REGISTRY" "$SESSION_NAME" "$PR") || exit 1
  echo "$PORT" > "$SESSION_DIR/port"
fi

# A foreign Metro on 8081 is the normal state on a shared Mac, and the reason
# "just run on 8081" is not available. Name it here rather than leaving the
# next agent to find it with lsof.
FOREIGN_8081=""
lsof -nP -iTCP:8081 -sTCP:LISTEN >/dev/null 2>&1 && FOREIGN_8081=1

# --- Emulator ----------------------------------------------------------------
serial_of() { echo "emulator-$1"; }
device_attached() { adb devices | grep -q "^$1[[:space:]]"; }

if [ -f "$SESSION_DIR/console-port" ] && [ -f "$SESSION_DIR/avd" ] \
   && device_attached "$(serial_of "$(cat "$SESSION_DIR/console-port")")"; then
  # Idempotent re-claim: our emulator is still running.
  CONSOLE_PORT=$(cat "$SESSION_DIR/console-port")
  AVD=$(cat "$SESSION_DIR/avd")
  SERIAL=$(serial_of "$CONSOLE_PORT")
  CLAIM_ORIGIN="reclaim"
else
  # --- pick an AVD ---
  AVAILABLE_AVDS=$(emulator -list-avds 2>/dev/null | grep -v '^$' || true)
  [ -n "$AVAILABLE_AVDS" ] || die "no AVDs exist - create one with:
       \$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager create avd -n demo -k '<system-image>'"

  AVD=""
  if [ -n "$WANT_AVD" ]; then
    echo "$AVAILABLE_AVDS" | grep -qx "$WANT_AVD" || die "no such AVD '$WANT_AVD'. Available:
$AVAILABLE_AVDS"
    reserve_slot "$REGISTRY" avds "$WANT_AVD" "$SESSION_NAME" \
      || die "AVD '$WANT_AVD' is reserved by another session ($(cat "$REGISTRY/avds/$WANT_AVD/owner" 2>/dev/null))"
    AVD="$WANT_AVD"
  else
    while IFS= read -r candidate; do
      [ -n "$candidate" ] || continue
      if reserve_slot "$REGISTRY" avds "$candidate" "$SESSION_NAME"; then
        AVD="$candidate"; break
      fi
    done <<< "$AVAILABLE_AVDS"
    # Unlike iOS, we cannot conjure another device: an AVD is a real on-disk
    # config and running one twice corrupts it. Fail with the reason.
    [ -n "$AVD" ] || die "every AVD is reserved by another session - Android concurrency is bounded by AVD count.
       Reserved: $(ls "$REGISTRY/avds" 2>/dev/null | tr '\n' ' ')
       Create another with: \$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager create avd -n demo2 -k '<system-image>'"
  fi
  echo "$AVD" > "$SESSION_DIR/avd"

  # --- reserve a console port; the serial follows from it ---
  CONSOLE_PORT=""
  if [ -f "$SESSION_DIR/console-port" ]; then
    CONSOLE_PORT=$(cat "$SESSION_DIR/console-port")
    reserve_slot "$REGISTRY" emu-ports "$CONSOLE_PORT" "$SESSION_NAME" || CONSOLE_PORT=""
  fi
  if [ -z "$CONSOLE_PORT" ]; then
    # Console ports are even and live in 5554..5680; the serial is
    # emulator-<console port>, which is what makes it ours by construction.
    for candidate in $(seq 5554 2 5680); do
      device_attached "$(serial_of "$candidate")" && continue
      if reserve_slot "$REGISTRY" emu-ports "$candidate" "$SESSION_NAME"; then
        CONSOLE_PORT="$candidate"; break
      fi
    done
    [ -n "$CONSOLE_PORT" ] || die "no free emulator console port in 5554..5680"
  fi
  echo "$CONSOLE_PORT" > "$SESSION_DIR/console-port"
  SERIAL=$(serial_of "$CONSOLE_PORT")

  # --- boot it ---
  # -no-snapshot-load so the session starts from a known state; the AVD's own
  # snapshot would otherwise resurrect whatever the last session left behind.
  T_BOOT=$(tel_now)
  emulator -avd "$AVD" -port "$CONSOLE_PORT" -no-snapshot-load -no-boot-anim \
    ${DEMO_EMU_ARGS:-} >"$SESSION_DIR/emulator.log" 2>&1 &
  EMU_PID=$!
  echo "$EMU_PID" > "$SESSION_DIR/emulator.pid"
  echo "created" > "$SESSION_DIR/origin"
  CLAIM_ORIGIN="created"

  # Boot wait: attached, then the framework is actually up. A screenshot or an
  # install against a half-booted emulator fails in ways that read like a
  # broken app.
  BOOT_TIMEOUT="${DEMO_EMU_BOOT_TIMEOUT:-180}"
  BOOT_DEADLINE=$(( $(date +%s) + BOOT_TIMEOUT ))
  until device_attached "$SERIAL"; do
    kill -0 "$EMU_PID" 2>/dev/null || die "the emulator process died during boot - see $SESSION_DIR/emulator.log"
    [ "$(date +%s)" -lt "$BOOT_DEADLINE" ] || die "emulator $SERIAL never attached within ${BOOT_TIMEOUT}s"
    sleep 2
  done
  until [ "$(adb -s "$SERIAL" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do
    kill -0 "$EMU_PID" 2>/dev/null || die "the emulator process died during boot - see $SESSION_DIR/emulator.log"
    [ "$(date +%s)" -lt "$BOOT_DEADLINE" ] || die "emulator $SERIAL attached but never finished booting within ${BOOT_TIMEOUT}s"
    sleep 2
  done
  tel_emit android.claim.boot "$T_BOOT" avd="$AVD" console_port="$CONSOLE_PORT"
fi

echo "$SERIAL" > "$SESSION_DIR/serial"
echo "$SESSION_NAME" > "$SESSION_DIR/name"

# Cross-check the live AVD identity: the serial is ours by construction, and
# this catches the one case construction cannot - a foreign emulator that was
# already sitting on the console port we reserved.
LIVE_AVD=$(adb -s "$SERIAL" emu avd name 2>/dev/null | head -1 | tr -d '\r' || true)
if [ -n "$LIVE_AVD" ] && [ "$LIVE_AVD" != "$AVD" ]; then
  die "refusing $SERIAL - it is running AVD '$LIVE_AVD', not the '$AVD' this session reserved"
fi

tel_emit android.claim.total "$T_CLAIM" origin="${CLAIM_ORIGIN:-reclaim}" \
  serial="$SERIAL" port="$PORT" avd="$AVD"

cat <<EOF
# Claimed Android session for PR #$PR
export DEMO_PR=$PR
export DEMO_SIM_NAME="$SESSION_NAME"
export DEMO_ANDROID_SERIAL=$SERIAL
export DEMO_PORT=$PORT
export DEMO_SESSION_DIR="$SESSION_DIR"
# AVD $AVD on console port $CONSOLE_PORT; devices attached before this session: $PREFLIGHT_COUNT
EOF

if [ -n "$FOREIGN_8081" ]; then
  echo "# note: port 8081 is held by another process - that is why this session runs on $PORT."
  echo "#       The app must be pointed at $PORT with point-app-at-metro.sh; an emulator"
  echo "#       otherwise dials 10.0.2.2:8081 and loads somebody else's bundle."
fi

if [ -n "${MISSING_CREDS:-}" ]; then
  echo "# note: missing credentials: $MISSING_CREDS"
fi
