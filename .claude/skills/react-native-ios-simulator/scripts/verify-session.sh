#!/bin/bash
# Prove the session is what it claims to be, instead of assuming it.
#
# Two failures cost whole sessions before this existed, and both are silent:
#
#   1. The app never reaches YOUR Metro. On Android an emulator dials
#      10.0.2.2:8081 by default, so a session on a claimed port sees zero
#      requests - indistinguishable from a broken bundler. On iOS the same
#      shape appears when the persisted RCT_jsLocation redirect was wiped.
#      This asserts Metro actually served a bundle, by watching the dev
#      server's own /events stream - the same channel reload-app.sh uses to
#      confirm a reload.
#
#   2. The checkout moved. A shared clone switched to another branch mid-session
#      means Metro serves code that is not the code under test; that once
#      manufactured a phantom "Rendered fewer hooks than expected" regression
#      and cost hours. The claim records worktree + HEAD; this compares them.
#
# Platform-neutral: it talks to Metro and to git, never to a device.
#
# Usage: verify-session.sh [--port N] [--timeout S] [--skip-bundle] [--skip-head]
#   --port         defaults to $DEMO_PORT
#   --timeout      seconds to wait for bundle activity (default 45)
#   --skip-bundle  only check HEAD drift and the 8081 neighbour
#   --skip-head    only check the bundle request
#
# Run it AFTER launching the app. Exit 0 means: your Metro served your app,
# from the checkout you claimed.

set -euo pipefail

TEL_LIB="$(dirname "${BASH_SOURCE[0]}")/../lib/telemetry.sh"
{ [ -f "$TEL_LIB" ] && . "$TEL_LIB"; } 2>/dev/null || true
type tel_emit >/dev/null 2>&1 || { tel_now() { echo 0; }; tel_emit() { :; }; tel_span() { while [ $# -gt 0 ] && [ "$1" != "--" ]; do shift; done; [ $# -gt 0 ] && shift; "$@"; }; }

die() { echo "FATAL: $*" >&2; exit 1; }

PORT="${DEMO_PORT:-}"
TIMEOUT="${VERIFY_TIMEOUT:-45}"
SKIP_BUNDLE=""
SKIP_HEAD=""

while [ $# -gt 0 ]; do
  case "$1" in
    --port)        PORT="${2:?--port needs a value}"; shift 2 ;;
    --timeout)     TIMEOUT="${2:?--timeout needs a value}"; shift 2 ;;
    --skip-bundle) SKIP_BUNDLE=1; shift ;;
    --skip-head)   SKIP_HEAD=1; shift ;;
    *) die "unknown argument '$1' (usage: verify-session.sh [--port N] [--timeout S] [--skip-bundle] [--skip-head])" ;;
  esac
done

[ -n "$PORT" ] || die "no port: eval a claim-session.sh first, or pass --port"
case "$PORT" in ''|*[!0-9]*) die "port must be numeric, got '$PORT'" ;; esac

T_VERIFY=$(tel_now)
FAILED=""

# --- 1. HEAD drift -----------------------------------------------------------
# The session dir remembers where the demo was claimed from. If that checkout
# has moved, everything Metro serves from here on is a different branch's code.
if [ -z "$SKIP_HEAD" ] && [ -n "${DEMO_SESSION_DIR:-}" ] && [ -f "$DEMO_SESSION_DIR/head-sha" ]; then
  CLAIMED_SHA=$(cat "$DEMO_SESSION_DIR/head-sha")
  CLAIMED_TREE=$(cat "$DEMO_SESSION_DIR/worktree" 2>/dev/null || echo "")
  if [ -n "$CLAIMED_TREE" ] && [ -d "$CLAIMED_TREE" ]; then
    CURRENT_SHA=$(git -C "$CLAIMED_TREE" rev-parse HEAD 2>/dev/null || echo "")
    if [ -n "$CURRENT_SHA" ] && [ "$CURRENT_SHA" != "$CLAIMED_SHA" ]; then
      echo "CHECKOUT DRIFT: $CLAIMED_TREE was at ${CLAIMED_SHA:0:9} when this session was claimed, and is now at ${CURRENT_SHA:0:9}." >&2
      echo "       Metro has been serving a different branch's code. Anything captured since the switch is evidence about the wrong tree -" >&2
      echo "       this is how a phantom regression gets attributed to the change under test. Re-claim from a detached worktree." >&2
      FAILED=1
    else
      echo "checkout: $CLAIMED_TREE still at ${CLAIMED_SHA:0:9}"
    fi
  fi
fi

# --- 2. Who else is on 8081 --------------------------------------------------
# Informational, never fatal: it explains WHY this session runs on its own port.
if lsof -nP -iTCP:8081 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "note: port 8081 is held by another process (the user's Metro, or another agent's) - this session's port is $PORT"
fi

# --- 3. Did Metro actually serve our app? ------------------------------------
if [ -z "$SKIP_BUNDLE" ]; then
  curl -sf "http://localhost:$PORT/status" >/dev/null 2>&1 \
    || die "nothing is listening on $PORT - start Metro for this session first"

  BUNDLE_SEEN=$(PORT="$PORT" TIMEOUT="$TIMEOUT" python3 <<'PY'
import base64, json, os, socket, struct, sys, time

port, timeout = int(os.environ["PORT"]), float(os.environ["TIMEOUT"])

# Minimal RFC 6455 client - same shape as reload-app.sh, kept dependency-free
# so this works from any cwd with no node_modules.
def ws_connect(path):
    s = socket.create_connection(("127.0.0.1", port), timeout=5)
    key = base64.b64encode(os.urandom(16)).decode()
    s.sendall((
        "GET %s HTTP/1.1\r\nHost: 127.0.0.1:%d\r\nUpgrade: websocket\r\n"
        "Connection: Upgrade\r\nSec-WebSocket-Key: %s\r\n"
        "Sec-WebSocket-Version: 13\r\n\r\n" % (path, port, key)
    ).encode())
    buf = b""
    while b"\r\n\r\n" not in buf:
        chunk = s.recv(4096)
        if not chunk:
            raise ConnectionError("closed during handshake")
        buf += chunk
    head, leftover = buf.split(b"\r\n\r\n", 1)
    if b" 101" not in head.split(b"\r\n", 1)[0]:
        raise ConnectionError("handshake refused")
    return s, leftover

def parse_frame(buf):
    if len(buf) < 2:
        return None
    opcode, b2 = buf[0] & 0x0F, buf[1]
    n, off = b2 & 0x7F, 2
    if n == 126:
        if len(buf) < 4: return None
        n, off = struct.unpack(">H", buf[2:4])[0], 4
    elif n == 127:
        if len(buf) < 10: return None
        n, off = struct.unpack(">Q", buf[2:10])[0], 10
    if b2 & 0x80:
        if len(buf) < off + 4 + n: return None
        mask, payload = buf[off:off+4], buf[off+4:off+4+n]
        payload = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
        return opcode, payload, buf[off+4+n:]
    if len(buf) < off + n: return None
    return opcode, buf[off:off+n], buf[off+n:]

try:
    sock, buf = ws_connect("/events")
except OSError as e:
    print("ERROR:%s" % e)
    sys.exit(0)

sock.settimeout(0.5)
deadline = time.time() + timeout
while time.time() < deadline:
    frame = parse_frame(buf)
    while frame:
        opcode, payload, buf = frame
        if opcode == 0x8:
            break
        if opcode == 0x1:
            try:
                etype = json.loads(payload).get("type", "")
            except ValueError:
                etype = ""
            # bundle_build_done fires for cache-warm serves too, which is
            # exactly the common case for a second launch.
            if etype in ("bundle_build_started", "bundle_build_done", "bundle_transform_progressed"):
                print("SEEN")
                sys.exit(0)
        frame = parse_frame(buf)
    try:
        chunk = sock.recv(4096)
    except socket.timeout:
        continue
    if not chunk:
        break
    buf += chunk
print("NONE")
PY
  )

  case "$BUNDLE_SEEN" in
    SEEN)
      echo "bundle: Metro on $PORT served a bundle request - the app is talking to this session"
      ;;
    ERROR:*)
      echo "FATAL: could not watch Metro's /events on $PORT (${BUNDLE_SEEN#ERROR:})" >&2
      FAILED=1
      ;;
    *)
      echo "NO BUNDLE REQUEST on port $PORT within ${TIMEOUT}s. The app is not talking to this session's Metro." >&2
      echo "       Likely causes, in the order they usually bite:" >&2
      echo "         1. the app is pointed elsewhere - on Android an emulator dials 10.0.2.2:8081 unless" >&2
      echo "            point-app-at-metro.sh has set debug_http_host (and force-stopped the app afterwards);" >&2
      echo "            on iOS the persisted RCT_jsLocation redirect was wiped (clearState) - use reset-app.sh;" >&2
      echo "         2. the app is not running, or crashed before requesting a bundle;" >&2
      echo "         3. it IS running against a different Metro - check who holds 8081." >&2
      FAILED=1
      ;;
  esac
fi

tel_emit session.verify.total "$T_VERIFY" port="$PORT" \
  ok="$([ -z "$FAILED" ] && echo 1 || echo 0)"

[ -z "$FAILED" ] || exit 1
echo "session verified"
