#!/bin/bash
# Point the app on this session's emulator at this session's Metro port.
#
# WHY THIS EXISTS, because the obvious alternatives all fail quietly:
#
# A React Native app on a stock emulator resolves its dev server to
# 10.0.2.2:8081 - the host loopback, on a port constant compiled into the
# framework (AndroidInfoHelpers.getServerHost, which picks 10.0.2.2 purely from
# a Build.FINGERPRINT heuristic). On a Mac where several agents each hold a
# Metro, 8081 belongs to somebody else, so the app loads SOMEBODY ELSE'S BUNDLE
# or fails with "Unable to load script" and no requests in your Metro log -
# which reads like a broken bundler rather than a request that went elsewhere.
#
# `adb reverse tcp:<p> tcp:<p>` does not fix it, and not because reverse
# forwarding is broken on emulators (it works fine, and RN's own CLI runs it
# unconditionally). It binds DEVICE-localhost, and the app is dialing 10.0.2.2 -
# an address the tunnel never sees. The tunnel is aimed at a door nobody knocks
# on.
#
# `setprop metro.host <ip>` does override the emulator heuristic, and carries
# NO PORT (the framework appends its own), so it cannot express a claimed port.
#
# What does work is the persisted override the dev menu writes:
# `debug_http_host = <host>:<port>` in the app's default SharedPreferences.
# We set it to 10.0.2.2:<claimed port> - host loopback, our port, no tunnel.
#
# Two details that are load-bearing, both learned the expensive way:
#
#   * PUSH A FILE. Piping XML through `run-as ... sh -c 'printf ...'` mangles
#     the header and yields prefs Android silently ignores. adb push + run-as cp
#     moves bytes verbatim.
#   * FORCE-STOP AFTER WRITING. PackagerConnectionSettings caches the resolved
#     host in a companion object - process-static. A value written after
#     auto-detection has already run is ignored until the process restarts.
#
# Requires a debuggable build (run-as); that is the demo case by definition.
#
# Usage: point-app-at-metro.sh [--serial S] [--port N] [--app-id ID] [--host H]
#   defaults: $DEMO_ANDROID_SERIAL, $DEMO_PORT, $DEMO_APP_ID_ANDROID, 10.0.2.2

set -euo pipefail

TEL_LIB="$(dirname "${BASH_SOURCE[0]}")/../../react-native-ios-simulator/lib/telemetry.sh"
{ [ -f "$TEL_LIB" ] && . "$TEL_LIB"; } 2>/dev/null || true
type tel_emit >/dev/null 2>&1 || { tel_now() { echo 0; }; tel_emit() { :; }; tel_span() { while [ $# -gt 0 ] && [ "$1" != "--" ]; do shift; done; [ $# -gt 0 ] && shift; "$@"; }; }

die() { echo "FATAL: $*" >&2; exit 1; }

SERIAL="${DEMO_ANDROID_SERIAL:-}"
PORT="${DEMO_PORT:-}"
APP_ID="${DEMO_APP_ID_ANDROID:-}"
HOST="10.0.2.2"

while [ $# -gt 0 ]; do
  case "$1" in
    --serial) SERIAL="${2:?--serial needs a value}"; shift 2 ;;
    --port)   PORT="${2:?--port needs a value}"; shift 2 ;;
    --app-id) APP_ID="${2:?--app-id needs a value}"; shift 2 ;;
    --host)   HOST="${2:?--host needs a value}"; shift 2 ;;
    *) die "unknown argument '$1' (usage: point-app-at-metro.sh [--serial S] [--port N] [--app-id ID] [--host H])" ;;
  esac
done

# No guessing: an unpinned adb command targets whichever single device is
# attached, which on a shared Mac is somebody else's emulator.
[ -n "$SERIAL" ] || die "no serial: eval claim-session.sh first (an unpinned adb call would target whichever emulator is attached)"
[ -n "$PORT" ] || die "no port: eval claim-session.sh first (without a claimed port the app would dial 10.0.2.2:8081 - another agent's Metro)"
[ -n "$APP_ID" ] || die "no app id: set DEMO_APP_ID_ANDROID to your app's application id (see AGENTS.md)"
case "$PORT" in ''|*[!0-9]*) die "port must be numeric, got '$PORT'" ;; esac

adb devices | grep -q "^$SERIAL[[:space:]]" || die "$SERIAL is not attached"

T_POINT=$(tel_now)
PREFS_FILE="/data/data/$APP_ID/shared_prefs/${APP_ID}_preferences.xml"
TMP_LOCAL="$(mktemp -t debug-http-host)"
trap 'rm -f "$TMP_LOCAL"' EXIT

# The dev menu writes exactly this shape; anything else and the framework
# ignores the file rather than telling you.
cat > "$TMP_LOCAL" <<EOF
<?xml version='1.0' encoding='utf-8' standalone='yes' ?>
<map>
    <string name="debug_http_host">$HOST:$PORT</string>
</map>
EOF

adb -s "$SERIAL" push "$TMP_LOCAL" /data/local/tmp/debug_http_host.xml >/dev/null \
  || die "adb push failed"
adb -s "$SERIAL" shell run-as "$APP_ID" mkdir -p "/data/data/$APP_ID/shared_prefs" 2>/dev/null || true
adb -s "$SERIAL" shell run-as "$APP_ID" cp /data/local/tmp/debug_http_host.xml "$PREFS_FILE" \
  || die "run-as cp failed - is $APP_ID installed, and is this a debuggable build?"
adb -s "$SERIAL" shell rm -f /data/local/tmp/debug_http_host.xml 2>/dev/null || true

# The value is only consulted at process start (see the companion-object cache
# above), so this force-stop is what makes the write take effect.
adb -s "$SERIAL" shell am force-stop "$APP_ID" 2>/dev/null || true

tel_emit android.point_at_metro.total "$T_POINT" port="$PORT" host="$HOST"

echo "$APP_ID on $SERIAL now points at $HOST:$PORT (app force-stopped; next launch picks it up)"
echo "verify it actually landed with verify-session.sh after launching - a silent"
echo "miss looks exactly like a broken bundler."
